import asyncio
import re
import time
import uuid
import logging
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any
from datetime import datetime

from core.config import settings, DEFAULT_LITERARY_SYSTEM_PROMPT
from core.checkpoint import CheckpointDatabase, JobRecord, SegmentRecord
from core.chunker import SemanticChunker, estimate_tokens
from core.cleaner import simplify_html_for_prompt
from core.parser_epub import EpubParser
from core.parser_pdf import PdfParser
from core.glossary import GlossaryManager
from core.llm_client import LLMClient, ProviderDownError

logger = logging.getLogger("tradoc.engine")

class TranslationEngine:
    def __init__(self, db: CheckpointDatabase, glossary_mgr: GlossaryManager):
        self.db = db
        self.glossary_mgr = glossary_mgr
        self.listeners: List[Callable[[Dict[str, Any]], None]] = []

    def add_listener(self, listener: Callable[[Dict[str, Any]], None]):
        self.listeners.append(listener)

    def _broadcast_event(self, event_type: str, data: Dict[str, Any]):
        event = {"type": event_type, "timestamp": datetime.now().isoformat(), **data}
        for cb in self.listeners:
            try:
                cb(event)
            except Exception:
                pass

    async def prepare_job(
        self,
        input_file: Path,
        source_lang: str = "en",
        target_lang: str = "fr",
        model: Optional[str] = None,
        glossary_name: Optional[str] = None,
        system_prompt: Optional[str] = None,
        chunk_token_size: int = 1000,
        temperature: float = 1.50,
        concurrency: int = 1,
        max_segments: Optional[int] = None
    ) -> JobRecord:
        """Parses document, chunks text, creates DB records, and returns job object."""
        file_ext = input_file.suffix.lower()
        if file_ext not in [".epub", ".pdf"]:
            raise ValueError(f"Format non supporté: {file_ext}. Formats supportés: .epub, .pdf")

        file_type = "epub" if file_ext == ".epub" else "pdf"

        print(f"\n[TraDoc Engine] 📚 Analyse du fichier: {input_file.name} ({file_type.upper()})...")

        # Run CPU-heavy EPUB/PDF parsing in thread pool to avoid blocking FastAPI event loop
        def _parse():
            if file_type == "epub":
                parser = EpubParser(input_file)
                return parser.extract_nodes()
            else:
                parser = PdfParser(input_file)
                return parser.extract_nodes()

        node_meta, node_texts = await asyncio.to_thread(_parse)
        print(f"[TraDoc Engine] ✂️ {len(node_texts)} blocs de texte extraits. Découpage sémantique en cours...")

        # Chunk nodes
        chunker = SemanticChunker(target_chunk_tokens=chunk_token_size)
        chunks = chunker.create_chunks(node_texts)
        
        # Mode Test / Échantillon limit
        if max_segments and max_segments > 0:
            chunks = chunks[:max_segments]
            print(f"[TraDoc Engine] 🧪 Mode Test actif : Restreint aux {len(chunks)} premiers chunks sémantiques.")
        else:
            print(f"[TraDoc Engine] 🧩 {len(chunks)} chunks sémantiques créés (~{chunk_token_size} tokens/chunk).")

        job_id = str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()

        prompt = system_prompt or DEFAULT_LITERARY_SYSTEM_PROMPT

        # Attach glossary if specified
        if glossary_name:
            glossary = self.glossary_mgr.load_glossary(glossary_name)
            if glossary:
                prompt += "\n" + glossary.to_prompt_text()

        job = JobRecord(
            id=job_id,
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
            created_at=now
        )

        segments = [
            SegmentRecord(
                job_id=job_id,
                chunk_index=chunk.index,
                original_text=chunk.text,
                translated_text=None,
                status="PENDING",
                node_indices=chunk.node_indices,
                tokens_est=chunk.token_estimate,
                updated_at=now
            )
            for chunk in chunks
        ]

        await self.db.create_job(job, segments)
        print(f"[TraDoc Engine] ✅ Job {job_id} enregistré dans SQLite ({len(chunks)} segments).")
        self._broadcast_event("job_created", {"job_id": job_id, "total_chunks": len(chunks)})
        return job

    async def run_job(
        self,
        job_id: str,
        llm_client: LLMClient,
        concurrency: Optional[int] = None,
        temperature: Optional[float] = None
    ):
        """Executes translation job using worker tasks with asyncio.Semaphore concurrency limit."""
        job = await self.db.get_job(job_id)
        if not job:
            raise ValueError(f"Job non trouvé: {job_id}")

        await self.db.update_job_status(job_id, "PROCESSING")
        self._broadcast_event("job_started", {"job_id": job_id})

        segments = await self.db.get_segments(job_id)
        pending_segments = [s for s in segments if s.status in ("PENDING", "FAILED")]

        active_concurrency = concurrency if (concurrency and concurrency > 0) else (job.concurrency if (job.concurrency and job.concurrency > 0) else (settings.CONCURRENCY or 1))
        active_temperature = temperature if (temperature is not None) else (job.temperature if (job.temperature is not None) else settings.TEMPERATURE)

        print(f"\n[TraDoc Engine] 🚀 Démarrage de la traduction du job {job_id} ({job.file_name})")
        print(f"[TraDoc Engine] 🔗 Target Endpoint: {llm_client.endpoint} | Modèle actif: {job.model}")
        print(f"[TraDoc Engine] ⚡ Concurrence: {active_concurrency} requêtes parallèles | Température: {active_temperature} | Segments restants: {len(pending_segments)}/{len(segments)}")

        semaphore = asyncio.Semaphore(active_concurrency)

        async def worker(segment: SegmentRecord):
            async with semaphore:
                current_job = await self.db.get_job(job_id)
                if current_job and current_job.status in ("PAUSED", "CANCELLED"):
                    return

                try:
                    self._broadcast_event("segment_started", {
                        "job_id": job_id,
                        "chunk_index": segment.chunk_index
                    })
                    
                    active_temp = current_job.temperature if (current_job and current_job.temperature is not None) else temperature
                    active_model = current_job.model if (current_job and current_job.model) else job.model
                    active_prompt = current_job.system_prompt if (current_job and current_job.system_prompt) else job.system_prompt

                    prompt_text = simplify_html_for_prompt(segment.original_text)
                    translated = await llm_client.translate_chunk(
                        system_prompt=active_prompt,
                        text_chunk=prompt_text,
                        model=active_model,
                        temperature=active_temp
                    )
                    
                    await self.db.update_segment_done(job_id, segment.chunk_index, translated)
                    
                    updated_job = await self.db.get_job(job_id)
                    done_cnt = updated_job.completed_chunks if updated_job else 0
                    print(f"[TraDoc Engine] Chunk #{segment.chunk_index + 1}/{job.total_chunks} traduit avec succès. ({done_cnt}/{job.total_chunks})")

                    self._broadcast_event("segment_completed", {
                        "job_id": job_id,
                        "chunk_index": segment.chunk_index,
                        "completed_chunks": done_cnt,
                        "total_chunks": job.total_chunks
                    })
                except ProviderDownError as pde:
                    error_msg = str(pde)
                    print(f"\n[TraDoc Engine WARNING] ⚠️ Serveur LLM injoignable ({error_msg}). Auto-pause du job {job_id} pour préserver les segments...")
                    await self.db.update_job_status(job_id, "PAUSED")
                    self._broadcast_event("job_auto_paused", {
                        "job_id": job_id,
                        "chunk_index": segment.chunk_index,
                        "reason": "Le serveur LLM distant n'est plus accessible (PC en veille ou interruption réseau). Le projet a été mis en pause automatiquement."
                    })
                    return
                except Exception as e:
                    error_msg = str(e)
                    print(f"[TraDoc Engine ERROR] ❌ Chunk #{segment.chunk_index + 1} échoué: {error_msg}")
                    await self.db.update_segment_failed(job_id, segment.chunk_index, error_msg)
                    self._broadcast_event("segment_failed", {
                        "job_id": job_id,
                        "chunk_index": segment.chunk_index,
                        "error": error_msg
                    })

        tasks = [asyncio.create_task(worker(s)) for s in pending_segments]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # Finalize job status
        final_job = await self.db.get_job(job_id)
        if final_job and final_job.status == "PROCESSING":
            all_segments = await self.db.get_segments(job_id)
            all_done = all(s.status == "DONE" for s in all_segments)
            
            if all_done:
                now_str = datetime.now().isoformat()
                await self.db.update_job_status(job_id, "COMPLETED", completed_at=now_str)
                print(f"[TraDoc Engine] 🎉 Tous les segments traduits. Reconstitution du fichier de sortie...")
                await self.rebuild_output_file(job_id)
                self._broadcast_event("job_completed", {"job_id": job_id})
            else:
                failed_count = sum(1 for s in all_segments if s.status == "FAILED")
                if failed_count > 0:
                    await self.db.update_job_status(job_id, "FAILED")
                    print(f"[TraDoc Engine WARNING] ⚠️ Traduction terminée avec {failed_count} segments en échec.")
                    self._broadcast_event("job_failed", {"job_id": job_id, "failed_segments": failed_count})

    async def rebuild_output_file(self, job_id: str) -> Path:
        """Re-assembles original document with translated segments into data/output/."""
        job = await self.db.get_job(job_id)
        if not job:
            raise ValueError("Job not found")

        segments = await self.db.get_segments(job_id)
        
        translated_node_map: Dict[int, str] = {}
        for seg in segments:
            translated_text = seg.translated_text or seg.original_text
            # Extract distinct HTML block elements (<p>, <h1>, <li>, etc.) or fallback to newline split
            blocks = re.findall(r'<(?:p|h[1-6]|li|blockquote|caption|figcaption)[^>]*>.*?</(?:p|h[1-6]|li|blockquote|caption|figcaption)>', translated_text, re.DOTALL | re.IGNORECASE)
            if not blocks:
                blocks = [line.strip() for line in translated_text.split("\n") if line.strip()]
            if not blocks:
                blocks = [translated_text]

            for idx, node_idx in enumerate(seg.node_indices):
                translated_node_map[node_idx] = blocks[idx] if idx < len(blocks) else blocks[-1]

        max_idx = max(translated_node_map.keys()) if translated_node_map else 0
        translated_nodes = [translated_node_map.get(i, "") for i in range(max_idx + 1)]

        input_path = settings.INPUT_DIR / job.file_name
        output_path = settings.OUTPUT_DIR / f"traduit_{job.file_name}"

        def _rebuild():
            if job.file_type == "epub":
                parser = EpubParser(input_path)
                node_meta, _ = parser.extract_nodes()
                parser.reconstruct_epub(node_meta, translated_nodes, output_path)
            else:
                parser = PdfParser(input_path)
                parser.export_translated_epub(f"Traduction - {job.file_name}", translated_nodes, output_path)
            return output_path

        out_path = await asyncio.to_thread(_rebuild)
        print(f"[TraDoc Engine] 📖 Fichier reconstruit avec succès: {out_path}")
        return out_path
