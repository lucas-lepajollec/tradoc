import asyncio
import logging
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from bs4 import BeautifulSoup

from core.checkpoint import CheckpointDatabase, JobRecord, SegmentRecord
from core.chunker import SemanticChunker
from core.cleaner import (
    StructureValidationError,
    extract_html_blocks,
    simplify_html_for_prompt,
    verify_and_repair_html,
)
from core.config import DEFAULT_PROOFREADING_SYSTEM_PROMPT, get_literary_system_prompt, settings
from core.glossary import GlossaryManager
from core.llm_client import LLMClient, ProviderDownError
from core.parser_docx import DocxParser
from core.parser_epub import EpubParser
from core.parser_pdf import PdfParser
from core.parser_text import TextParser


logger = logging.getLogger("tradoc.engine")


class TranslationEngine:
    def __init__(self, db: CheckpointDatabase, glossary_mgr: GlossaryManager):
        self.db = db
        self.glossary_mgr = glossary_mgr
        self.listeners: List[Callable[[Dict[str, Any]], None]] = []
        self._rebuild_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)

    def add_listener(self, listener: Callable[[Dict[str, Any]], None]) -> None:
        if listener not in self.listeners:
            self.listeners.append(listener)

    def remove_listener(self, listener: Callable[[Dict[str, Any]], None]) -> None:
        try:
            self.listeners.remove(listener)
        except ValueError:
            pass

    def _broadcast_event(self, event_type: str, data: Dict[str, Any]) -> None:
        event = {"type": event_type, "timestamp": datetime.now().isoformat(), **data}
        for callback in list(self.listeners):
            try:
                callback(event)
            except Exception:
                logger.debug("Event listener failed", exc_info=True)

    @staticmethod
    def _relative_to_data(path: Path) -> str:
        return path.resolve().relative_to(settings.DATA_DIR.resolve()).as_posix()

    @staticmethod
    def _resolve_data_path(stored_path: Optional[str], fallback: Path) -> Path:
        candidate = settings.DATA_DIR / stored_path if stored_path else fallback
        resolved = candidate.resolve()
        try:
            resolved.relative_to(settings.DATA_DIR.resolve())
        except ValueError as exc:
            raise ValueError("Chemin de projet invalide.") from exc
        return resolved

    @staticmethod
    def _parser_for(file_type: str, path: Path, parser_version: int = 5):
        if file_type == "epub":
            return EpubParser(path, legacy=parser_version < 2)
        if file_type == "pdf":
            return PdfParser(path, legacy=parser_version < 2)
        if file_type == "docx":
            return DocxParser(path, legacy=parser_version < 2)
        if file_type in {"md", "txt"}:
            return TextParser(
                path,
                legacy=parser_version < 3,
                normalize_fenced_headings=parser_version >= 4,
                strip_converter_fences=parser_version >= 5,
            )
        raise ValueError(f"Parser non trouvé pour {file_type}")

    async def prepare_job(
        self,
        input_file: Path,
        source_lang: str = "en",
        target_lang: str = "fr",
        model: Optional[str] = None,
        glossary_name: Optional[str] = None,
        system_prompt: Optional[str] = None,
        chunk_token_size: int = 1000,
        temperature: float = 1.5,
        concurrency: int = 1,
        max_segments: Optional[int] = None,
        job_type: str = "translation",
        job_id: Optional[str] = None,
        output_file: Optional[Path] = None,
        parser_version: int = 5,
        api_type: str = "openai",
        endpoint: Optional[str] = None,
        enable_proofreading: bool = False,
        enable_prompt_caching: bool = False,
    ) -> JobRecord:
        file_ext = input_file.suffix.lower()
        if file_ext not in {".epub", ".pdf", ".docx", ".md", ".txt"}:
            raise ValueError("Format non supporté. Utilisez EPUB, PDF, DOCX, MD ou TXT.")
        if not 200 <= chunk_token_size <= 10000:
            raise ValueError("La taille de segment doit être comprise entre 200 et 10 000 tokens.")
        if not 1 <= concurrency <= 32:
            raise ValueError("La concurrence doit être comprise entre 1 et 32.")
        if not 0 <= temperature <= 2:
            raise ValueError("La température doit être comprise entre 0 et 2.")

        file_type = file_ext.lstrip(".")
        parser = self._parser_for(file_type, input_file, parser_version)
        _, node_texts = await asyncio.to_thread(parser.extract_nodes)
        if not node_texts:
            raise ValueError("Aucun texte traduisible n'a été détecté dans ce document.")

        chunks = SemanticChunker(target_chunk_tokens=chunk_token_size).create_chunks(node_texts)
        if max_segments and max_segments > 0:
            chunks = chunks[:max_segments]
        if not chunks:
            raise ValueError("Aucun segment n'a pu être créé.")

        resolved_job_id = job_id or uuid.uuid4().hex[:12]
        now = datetime.now().isoformat()
        if system_prompt:
            prompt = system_prompt
        elif job_type == "proofreading":
            prompt = DEFAULT_PROOFREADING_SYSTEM_PROMPT
        else:
            prompt = get_literary_system_prompt(source_lang, target_lang)

        if glossary_name:
            glossary = self.glossary_mgr.load_glossary(glossary_name)
            if glossary:
                prompt += "\n" + glossary.to_prompt_text()

        default_output = input_file.parent.parent / "output" / f"traduit_{input_file.name}"
        resolved_output = output_file or default_output
        resolved_output.parent.mkdir(parents=True, exist_ok=True)
        job = JobRecord(
            id=resolved_job_id,
            file_name=input_file.name,
            file_type=file_type,
            source_lang=source_lang,
            target_lang=target_lang,
            model=model or settings.LLM_MODEL,
            status="PENDING",
            total_chunks=len(chunks),
            completed_chunks=0,
            glossary_name=glossary_name,
            system_prompt=prompt,
            temperature=temperature,
            concurrency=concurrency,
            chunk_size=chunk_token_size,
            job_type=job_type,
            source_path=self._relative_to_data(input_file),
            output_path=self._relative_to_data(resolved_output),
            parser_version=parser_version,
            api_type=api_type,
            endpoint=endpoint,
            enable_proofreading=enable_proofreading,
            enable_prompt_caching=enable_prompt_caching,
            created_at=now,
        )
        segments = [
            SegmentRecord(
                job_id=resolved_job_id,
                chunk_index=chunk.index,
                original_text=chunk.text,
                status="PENDING",
                node_indices=chunk.node_indices,
                tokens_est=chunk.token_estimate,
                updated_at=now,
            )
            for chunk in chunks
        ]
        await self.db.create_job(job, segments)
        self._broadcast_event("job_created", {"job_id": resolved_job_id, "total_chunks": len(chunks)})
        return job

    async def _translate_with_structure_retry(
        self,
        client: LLMClient,
        source_html: str,
        system_prompt: str,
        model: str,
        temperature: float,
        check_cancelled,
        recover_structure: bool = False,
    ) -> str:
        source_blocks = extract_html_blocks(source_html)
        prompt_text = simplify_html_for_prompt(source_html)
        structure_instruction = ""
        if source_blocks:
            structure_instruction = (
                "\n\nFORMAT PRIORITAIRE : reproduis exactement chaque balise de bloc reçue, "
                "dans le même ordre. Commence par la première balise réellement présente dans "
                "le texte, même si une consigne précédente mentionne <p>."
            )
        structured_prompt = f"{system_prompt}{structure_instruction}"
        raw = await client.translate_chunk(
            system_prompt=structured_prompt,
            text_chunk=prompt_text,
            model=model,
            temperature=temperature,
            check_cancelled=check_cancelled,
        )
        try:
            return verify_and_repair_html(source_html, raw)
        except StructureValidationError as first_error:
            block_names = [BeautifulSoup(block, "html.parser").find().name for block in source_blocks]
            repair_prompt = (
                f"{structured_prompt}\n\nCORRECTION DE FORMAT OBLIGATOIRE : conserve exactement "
                f"{len(block_names)} blocs dans cet ordre ({', '.join(block_names)}). "
                "Ne fusionne, ne supprime et n'ajoute aucun bloc."
            )
            raw = await client.translate_chunk(
                system_prompt=repair_prompt,
                text_chunk=prompt_text,
                model=model,
                temperature=temperature,
                max_retries=2,
                check_cancelled=check_cancelled,
            )
            try:
                return verify_and_repair_html(source_html, raw)
            except StructureValidationError as second_error:
                if recover_structure and len(source_blocks) > 1:
                    # Markdown converters often create many short sibling blocks.
                    # Some models merge or omit one when translating a large batch.
                    # Retry only that Markdown segment in bounded subgroups, then
                    # validate the reassembled result against the original segment.
                    subgroup_size = 8 if len(source_blocks) > 8 else max(1, len(source_blocks) // 2)
                    recovered: List[str] = []
                    for start in range(0, len(source_blocks), subgroup_size):
                        subgroup = "\n\n".join(source_blocks[start:start + subgroup_size])
                        recovered.append(
                            await self._translate_with_structure_retry(
                                client,
                                subgroup,
                                system_prompt,
                                model,
                                temperature,
                                check_cancelled,
                                recover_structure=True,
                            )
                        )
                    combined = "\n".join(recovered)
                    return verify_and_repair_html(source_html, combined)
                raise StructureValidationError(f"{first_error} Nouvelle tentative: {second_error}") from second_error

    async def run_job(
        self,
        job_id: str,
        llm_client: LLMClient,
        concurrency: Optional[int] = None,
        temperature: Optional[float] = None,
        enable_proofreading: Optional[bool] = None,
    ) -> None:
        job = await self.db.get_job(job_id)
        if not job:
            raise ValueError("Job non trouvé.")
        if job.status != "PROCESSING":
            transitioned = await self.db.transition_job_status(job_id, ["PENDING", "PAUSED", "FAILED"], "PROCESSING")
            if not transitioned:
                raise RuntimeError("Ce projet ne peut pas être démarré dans son état actuel.")

        self._broadcast_event("job_started", {"job_id": job_id})
        segments = await self.db.get_segments(job_id)
        pending = [segment for segment in segments if segment.status in {"PENDING", "FAILED"}]
        active_concurrency = max(1, min(32, concurrency or job.concurrency or settings.CONCURRENCY))
        active_temperature = temperature if temperature is not None else job.temperature
        proofreading = job.enable_proofreading if enable_proofreading is None else enable_proofreading
        semaphore = asyncio.Semaphore(active_concurrency)

        async def check_cancelled() -> None:
            current = await self.db.get_job(job_id)
            if not current or current.status in {"PAUSED", "CANCELLED"}:
                raise asyncio.CancelledError()

        async def worker(segment: SegmentRecord) -> None:
            async with semaphore:
                await check_cancelled()
                if not await self.db.update_segment_processing(job_id, segment.chunk_index):
                    return
                self._broadcast_event("segment_started", {"job_id": job_id, "chunk_index": segment.chunk_index})
                try:
                    current = await self.db.get_job(job_id)
                    if not current:
                        raise asyncio.CancelledError()
                    translated = await self._translate_with_structure_retry(
                        llm_client,
                        segment.original_text,
                        current.system_prompt or job.system_prompt or "",
                        current.model,
                        current.temperature if current.temperature is not None else active_temperature,
                        check_cancelled,
                        recover_structure=job.file_type == "md",
                    )
                    if proofreading:
                        try:
                            translated = await self._translate_with_structure_retry(
                                llm_client,
                                translated,
                                DEFAULT_PROOFREADING_SYSTEM_PROMPT,
                                current.model,
                                0.15,
                                check_cancelled,
                                recover_structure=job.file_type == "md",
                            )
                        except Exception:
                            logger.warning("Proofreading pass skipped for job %s segment %s", job_id, segment.chunk_index)
                    await check_cancelled()
                    await self.db.update_segment_done(job_id, segment.chunk_index, translated)
                    updated = await self.db.get_job(job_id)
                    self._broadcast_event(
                        "segment_completed",
                        {
                            "job_id": job_id,
                            "chunk_index": segment.chunk_index,
                            "completed_chunks": updated.completed_chunks if updated else 0,
                            "total_chunks": job.total_chunks,
                            "translated_text": translated,
                        },
                    )
                except asyncio.CancelledError:
                    raise
                except ProviderDownError:
                    await self.db.update_job_status(job_id, "PAUSED")
                    self._broadcast_event("job_auto_paused", {"job_id": job_id, "reason": "Serveur LLM indisponible."})
                except Exception as exc:
                    logger.warning("Segment %s/%s failed: %s", job_id, segment.chunk_index, exc)
                    await self.db.update_segment_failed(job_id, segment.chunk_index, str(exc))
                    self._broadcast_event(
                        "segment_failed",
                        {"job_id": job_id, "chunk_index": segment.chunk_index, "error": "La traduction du segment a échoué."},
                    )

        try:
            if pending:
                await asyncio.gather(*(worker(segment) for segment in pending))
            current = await self.db.get_job(job_id)
            if not current or current.status != "PROCESSING":
                await self.db.reset_processing_segments(job_id)
                return
            if await self.db.count_unfinished_segments(job_id):
                await self.db.update_job_status(job_id, "FAILED")
                self._broadcast_event("job_failed", {"job_id": job_id})
                return
            # Completion is committed only after a fresh output has been rebuilt.
            await self.rebuild_output_file(job_id)
            await self.db.update_job_status(job_id, "COMPLETED", datetime.now().isoformat())
            self._broadcast_event("job_completed", {"job_id": job_id})
        except asyncio.CancelledError:
            await self.db.reset_processing_segments(job_id)
            current = await self.db.get_job(job_id)
            if current and current.status == "PROCESSING":
                await self.db.update_job_status(job_id, "PAUSED")
            raise
        except Exception:
            await self.db.reset_processing_segments(job_id)
            await self.db.update_job_status(job_id, "FAILED")
            self._broadcast_event("job_failed", {"job_id": job_id})
            raise

    async def run_proofreading_job(self, job_id: str, llm_client: LLMClient, concurrency: int = 1) -> None:
        job = await self.db.get_job(job_id)
        if not job:
            raise ValueError("Job non trouvé.")
        segments = await self.db.get_segments(job_id)
        target_segments = [segment for segment in segments if segment.translated_text]
        if not target_segments:
            raise ValueError("Aucune traduction à relire.")
        semaphore = asyncio.Semaphore(max(1, min(32, concurrency)))
        failures = 0
        results: Dict[int, str] = {}

        async def worker(segment: SegmentRecord) -> None:
            nonlocal failures
            async with semaphore:
                try:
                    result = await self._translate_with_structure_retry(
                        llm_client,
                        segment.translated_text or "",
                        DEFAULT_PROOFREADING_SYSTEM_PROMPT,
                        job.model,
                        0.15,
                        None,
                        recover_structure=job.file_type == "md",
                    )
                    results[segment.chunk_index] = result
                except Exception:
                    failures += 1
                    logger.exception("Proofreading failed for %s/%s", job_id, segment.chunk_index)

        self._broadcast_event("proofread_started", {"job_id": job_id})
        await asyncio.gather(*(worker(segment) for segment in target_segments))
        if failures:
            raise RuntimeError(f"La relecture a échoué sur {failures} segment(s).")
        # Commit only after every segment succeeded, so a failed/cancelled editorial
        # pass never leaves a half-proofread document in the database.
        await self.db.update_segments_done_batch(job_id, results)
        for segment in target_segments:
            self._broadcast_event("proofread_segment_completed", {"job_id": job_id, "chunk_index": segment.chunk_index})
        await self.rebuild_output_file(job_id)
        await self.db.update_job_status(job_id, "COMPLETED", datetime.now().isoformat())
        self._broadcast_event("proofread_job_completed", {"job_id": job_id})

    @staticmethod
    def _merge_node_fragments(fragments: List[str]) -> str:
        if len(fragments) == 1:
            return fragments[0]
        soups = [BeautifulSoup(fragment, "html.parser") for fragment in fragments]
        tags = [soup.find() for soup in soups]
        if not all(tags) or len({tag.name for tag in tags if tag}) != 1:
            raise StructureValidationError("Fragments incompatibles pour la reconstruction.")
        first = tags[0]
        combined_inner = " ".join(tag.decode_contents().strip() for tag in tags if tag)
        first.clear()
        fragment_soup = BeautifulSoup(combined_inner, "html.parser")
        for child in list(fragment_soup.contents):
            first.append(child)
        return str(first)

    async def rebuild_output_file(self, job_id: str, allow_partial: bool = False) -> Path:
        async with self._rebuild_locks[job_id]:
            job = await self.db.get_job(job_id)
            if not job:
                raise ValueError("Job non trouvé.")
            # get_segments performs one ordered SELECT and returns detached records.
            # This gives an active export a stable snapshot even while workers keep
            # committing newer translations in the background.
            segments = await self.db.get_segments(job_id)
            if not segments:
                raise RuntimeError("Aucun segment à exporter.")
            if not allow_partial and any(
                segment.status != "DONE" or not segment.translated_text for segment in segments
            ):
                raise RuntimeError("Tous les segments doivent être terminés avant l'export.")

            translated_node_indices = {
                node_index
                for segment in segments
                if segment.status == "DONE" and segment.translated_text
                for node_index in segment.node_indices
            }
            source_copy_preview = allow_partial and job.file_type in {"epub", "pdf", "docx"}
            node_fragments: defaultdict[int, List[str]] = defaultdict(list)
            for segment in segments:
                is_translated = segment.status == "DONE" and bool(segment.translated_text)
                # Binary formats are copied from the source for previews. Only parse
                # a pending segment when it contains another fragment of a node that
                # is partially translated; all unrelated source nodes stay untouched.
                if source_copy_preview and not (
                    is_translated or translated_node_indices.intersection(segment.node_indices)
                ):
                    continue
                segment_text = segment.translated_text if is_translated else segment.original_text if allow_partial else ""
                blocks = extract_html_blocks(segment_text)
                if len(blocks) != len(segment.node_indices):
                    raise StructureValidationError(
                        f"Le segment {segment.chunk_index + 1} ne peut pas être remappé sans perte."
                    )
                for node_index, block in zip(segment.node_indices, blocks):
                    if not source_copy_preview or node_index in translated_node_indices:
                        node_fragments[node_index].append(block)

            input_path = self._resolve_data_path(job.source_path, settings.INPUT_DIR / job.file_name)
            final_output_path = self._resolve_data_path(
                job.output_path, settings.OUTPUT_DIR / f"traduit_{job.file_name}"
            )
            if not input_path.is_file():
                raise FileNotFoundError("Le fichier source du projet est introuvable.")
            output_path = (
                final_output_path.with_name(f".partial-{uuid.uuid4().hex}{final_output_path.suffix}")
                if allow_partial
                else final_output_path
            )
            output_path.parent.mkdir(parents=True, exist_ok=True)
            temp_output = output_path.with_name(
                f".{output_path.stem}.{uuid.uuid4().hex}.tmp{output_path.suffix}"
            )

            def rebuild() -> Path:
                parser = self._parser_for(job.file_type, input_path, job.parser_version)
                node_meta, original_nodes = parser.extract_nodes()
                available_indices = set(range(len(original_nodes)))
                if not set(node_fragments).issubset(available_indices):
                    raise StructureValidationError("Certains blocs du document ne peuvent pas être remappés.")
                if not allow_partial and set(node_fragments) != available_indices:
                    raise StructureValidationError("Certains blocs du document ne disposent pas d'une traduction.")
                translated_nodes = [
                    self._merge_node_fragments(node_fragments[index])
                    if index in node_fragments
                    else original_nodes[index]
                    for index in range(len(original_nodes))
                ]
                if job.file_type == "epub":
                    parser.reconstruct_epub(
                        node_meta,
                        translated_nodes,
                        temp_output,
                        changed_node_indices=translated_node_indices if allow_partial else None,
                    )
                elif job.file_type == "pdf":
                    if allow_partial:
                        parser.reconstruct_partial_pdf(
                            node_meta,
                            translated_nodes,
                            temp_output,
                            changed_node_indices=translated_node_indices,
                        )
                    else:
                        parser.reconstruct_pdf(node_meta, translated_nodes, temp_output)
                elif job.file_type == "docx":
                    parser.reconstruct_docx(
                        node_meta,
                        translated_nodes,
                        temp_output,
                        changed_node_indices=translated_node_indices if allow_partial else None,
                    )
                else:
                    parser.reconstruct_text(node_meta, translated_nodes, temp_output)
                if not temp_output.is_file() or temp_output.stat().st_size == 0:
                    raise RuntimeError("Le fichier de sortie généré est invalide.")
                temp_output.replace(output_path)
                return output_path

            try:
                return await asyncio.to_thread(rebuild)
            finally:
                temp_output.unlink(missing_ok=True)
