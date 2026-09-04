import asyncio
import hmac
import ipaddress
import json
import logging
import re
import shutil
import uuid
from pathlib import Path
from typing import List, Literal, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from core.checkpoint import CheckpointDatabase, JobRecord
from core.config import DEFAULT_LITERARY_SYSTEM_PROMPT, settings
from core.credentials import ProviderCredentialStore
from core.engine import TranslationEngine
from core.glossary import Glossary, GlossaryManager
from core.llm_client import LLMClient, LLMResponseError
from core.security import UploadValidationError, save_upload_limited, validate_llm_endpoint


logger = logging.getLogger("tradoc.api")
MODEL_DISCOVERY_TIMEOUT_SECONDS = 20.0


def _is_loopback_hostname(hostname: Optional[str]) -> bool:
    if not hostname:
        return False
    normalized = hostname.strip("[]").lower()
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


async def verify_app_secret(
    request: Request,
    x_app_secret: Optional[str] = Header(None, alias="X-App-Secret"),
) -> None:
    expected = (settings.APP_SECRET or "").strip()
    if expected and (not x_app_secret or not hmac.compare_digest(x_app_secret.strip(), expected)):
        raise HTTPException(status_code=401, detail="Accès refusé.")

    # Mutating browser requests must come from the served app or an explicitly
    # allowed origin. This remains useful even when APP_SECRET is disabled locally.
    origin = request.headers.get("origin")
    if origin and request.method not in {"GET", "HEAD", "OPTIONS"}:
        allowed = {value.strip().rstrip("/") for value in settings.ALLOWED_ORIGINS.split(",") if value.strip()}
        origin_url = urlparse(origin)
        request_host = urlparse(f"//{request.headers.get('host', '')}")
        same_host = origin_url.netloc.lower() == request.headers.get("host", "").lower()
        local_dev_proxy = _is_loopback_hostname(origin_url.hostname) and _is_loopback_hostname(
            request_host.hostname
        )
        trusted_lan_proxy = settings.TRUSTED_LAN_PROXY and _is_loopback_hostname(request_host.hostname)
        if not same_host and not local_dev_proxy and not trusted_lan_proxy and origin.rstrip("/") not in allowed:
            raise HTTPException(status_code=403, detail="Origine non autorisée.")


router = APIRouter(dependencies=[Depends(verify_app_secret)])
db = CheckpointDatabase(settings.DB_PATH)
glossary_mgr = GlossaryManager(settings.GLOSSARY_DIR)
credential_store = ProviderCredentialStore(settings.CREDENTIALS_PATH)
engine = TranslationEngine(db, glossary_mgr)

active_tasks: dict[str, asyncio.Task] = {}
_task_lock = asyncio.Lock()


class ConnectionTestRequest(BaseModel):
    endpoint: Optional[str] = Field(default=None, max_length=2_000)
    api_key: Optional[str] = Field(default=None, max_length=20_000)
    api_type: str = Field(default="openai", min_length=1, max_length=50)


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    models: List[str] = Field(default_factory=list)


class TestTranslationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100_000)
    model: str = Field(min_length=1, max_length=300)
    endpoint: Optional[str] = Field(default=None, max_length=2_000)
    api_key: Optional[str] = Field(default=None, max_length=20_000)
    api_type: str = Field(default="openai", min_length=1, max_length=50)
    glossary_name: Optional[str] = None
    system_prompt: Optional[str] = Field(default=None, max_length=100_000)
    temperature: float = Field(default=0.15, ge=0, le=2)


class TestTranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    execution_time_ms: float
    model_used: str


class CredentialRequest(BaseModel):
    provider: str = Field(min_length=1, max_length=50)
    api_key: Optional[str] = Field(default=None, max_length=20_000)
    endpoint: Optional[str] = Field(default=None, max_length=2_000)


class InterfaceSettingsRequest(BaseModel):
    language: Literal["en", "fr", "es", "de"]


def _provider_values(api_type: str, endpoint: Optional[str], api_key: Optional[str]) -> tuple[str, str]:
    provider = (api_type or settings.API_TYPE).strip().lower()
    resolved_endpoint = (endpoint or credential_store.get_endpoint(provider) or settings.LLM_ENDPOINT).strip()
    resolved_key = api_key if api_key is not None else credential_store.get_api_key(provider)
    if resolved_key is None:
        resolved_key = settings.LLM_API_KEY
    return resolved_endpoint, resolved_key


async def _new_client(
    api_type: str,
    endpoint: Optional[str],
    api_key: Optional[str],
    enable_prompt_caching: bool = False,
) -> LLMClient:
    resolved_endpoint, resolved_key = _provider_values(api_type, endpoint, api_key)
    validated = await validate_llm_endpoint(resolved_endpoint, api_type)
    return LLMClient(
        endpoint=validated,
        api_key=resolved_key,
        api_type=api_type,
        timeout=settings.REQUEST_TIMEOUT,
        enable_prompt_caching=enable_prompt_caching,
    )


def _safe_filename(filename: Optional[str]) -> str:
    original = Path(filename or "document.epub").name
    stem = re.sub(r"[^\w .()-]", "_", Path(original).stem, flags=re.UNICODE).strip(" .") or "document"
    return f"{stem[:160]}{Path(original).suffix.lower()}"


async def _cancel_task(job_id: str) -> None:
    async with _task_lock:
        task = active_tasks.get(job_id)
        if task and not task.done():
            task.cancel()
    if task and not task.done():
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
    async with _task_lock:
        if active_tasks.get(job_id) is task:
            active_tasks.pop(job_id, None)


@router.get("/settings/credentials")
async def credential_metadata():
    return credential_store.metadata()


@router.get("/settings/interface")
async def interface_settings():
    language = await db.get_app_setting("ui_language", "en")
    if language not in {"en", "fr", "es", "de"}:
        language = "en"
    return {"language": language}


@router.put("/settings/interface")
async def save_interface_settings(req: InterfaceSettingsRequest):
    await db.set_app_setting("ui_language", req.language)
    return {"language": req.language}


@router.post("/settings/credentials")
async def save_credentials(req: CredentialRequest):
    endpoint = req.endpoint
    if endpoint:
        endpoint = await validate_llm_endpoint(endpoint, req.provider)
    credential_store.set(req.provider, req.api_key, endpoint)
    return {"message": "Identifiants enregistrés côté serveur.", "metadata": credential_store.metadata().get(req.provider.lower())}


@router.post("/settings/test-connection", response_model=ConnectionTestResponse)
async def test_connection(req: ConnectionTestRequest):
    try:
        client = await _new_client(req.api_type, req.endpoint, req.api_key)
        async with client:
            models = await asyncio.wait_for(
                client.fetch_models(),
                timeout=MODEL_DISCOVERY_TIMEOUT_SECONDS,
            )
        if not models:
            return ConnectionTestResponse(
                success=False,
                message="Endpoint joignable, mais aucun modèle exploitable n'a été détecté.",
                models=[],
            )
        preview = ", ".join(models[:3])
        return ConnectionTestResponse(
            success=True,
            message=f"Connexion validée — {len(models)} modèle(s) détecté(s) : {preview}",
            models=models,
        )
    except TimeoutError:
        return ConnectionTestResponse(
            success=False,
            message="Le serveur LLM met trop de temps à répondre.",
            models=[],
        )
    except LLMResponseError as exc:
        return ConnectionTestResponse(success=False, message=str(exc), models=[])
    except ValueError as exc:
        return ConnectionTestResponse(success=False, message=str(exc), models=[])


@router.post("/settings/models")
async def list_remote_models(req: ConnectionTestRequest):
    client = await _new_client(req.api_type, req.endpoint, req.api_key)
    try:
        async with client:
            models = await asyncio.wait_for(
                client.fetch_models(),
                timeout=MODEL_DISCOVERY_TIMEOUT_SECONDS,
            )
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="Le serveur LLM met trop de temps à répondre.") from exc
    return {"models": models}


@router.post("/settings/test-translation", response_model=TestTranslationResponse)
async def test_translation(req: TestTranslationRequest):
    import time

    started = time.perf_counter()
    client = await _new_client(req.api_type, req.endpoint, req.api_key)
    prompt = req.system_prompt or DEFAULT_LITERARY_SYSTEM_PROMPT
    if req.glossary_name:
        glossary = glossary_mgr.load_glossary(req.glossary_name)
        if glossary:
            prompt += "\n" + glossary.to_prompt_text()
    try:
        async with client:
            translated = await client.translate_chunk(prompt, req.text, req.model, req.temperature)
    except Exception as exc:
        logger.warning("Sandbox translation failed: %s", type(exc).__name__)
        raise HTTPException(status_code=400, detail="Le test de traduction a échoué. Vérifiez le fournisseur et le modèle.") from exc
    return TestTranslationResponse(
        original_text=req.text,
        translated_text=translated,
        execution_time_ms=round((time.perf_counter() - started) * 1000, 2),
        model_used=req.model,
    )


@router.post("/settings/sandbox-extract")
async def sandbox_extract(file: UploadFile = File(...), limit_tokens: int = Form(1000)):
    from core.chunker import estimate_tokens

    limit_tokens = max(200, min(10_000, limit_tokens))
    suffix = Path(file.filename or "").suffix.lower()
    temp_path = settings.TEMP_DIR / f"sandbox_{uuid.uuid4().hex}{suffix}"
    try:
        await save_upload_limited(file, temp_path)
        parser = engine._parser_for(suffix.lstrip("."), temp_path)
        _, nodes = await asyncio.to_thread(parser.extract_nodes)
        selected, total = [], 0
        front_matter = {
            "table of contents", "contents", "sommaire", "copyright", "all rights reserved",
            "isbn", "publisher", "title page", "cataloging-in-publication", "dédicace", "dedication",
        }
        started = False
        for node in nodes:
            plain = re.sub(r"<[^>]*>", "", node).strip()
            lowered = plain.lower()
            if not started:
                if any(term in lowered for term in front_matter) or len(plain) < 40 or "href=" in node.lower():
                    continue
                started = True
            selected.append(node.strip())
            total += estimate_tokens(node)
            if total >= limit_tokens:
                break
        if not selected:
            for node in nodes:
                if node.strip():
                    selected.append(node.strip())
                    total += estimate_tokens(node)
                    if total >= limit_tokens:
                        break
        return {"text": "\n\n".join(selected), "tokens": total}
    except UploadValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.warning("Sandbox extraction failed: %s", type(exc).__name__)
        raise HTTPException(status_code=400, detail="Impossible d'extraire ce document.") from exc
    finally:
        temp_path.unlink(missing_ok=True)


@router.post("/jobs/upload", response_model=JobRecord)
async def upload_and_create_job(
    file: UploadFile = File(...),
    source_lang: str = Form("en"),
    target_lang: str = Form("fr"),
    model: str = Form(...),
    glossary_name: Optional[str] = Form(None),
    system_prompt: Optional[str] = Form(None),
    chunk_size: int = Form(1000),
    temperature: float = Form(0.15),
    concurrency: int = Form(1),
    max_segments: Optional[int] = Form(None),
    job_type: str = Form("translation"),
    api_type: str = Form("openai"),
    endpoint: Optional[str] = Form(None),
    enable_proofreading: bool = Form(False),
    enable_prompt_caching: bool = Form(False),
):
    if job_type not in {"translation", "proofreading"}:
        raise HTTPException(status_code=422, detail="Type de projet invalide.")
    if not re.fullmatch(r"[a-zA-Z-]{2,20}", source_lang) or not re.fullmatch(r"[a-zA-Z-]{2,20}", target_lang):
        raise HTTPException(status_code=422, detail="Code de langue invalide.")
    if not model.strip() or len(model) > 300:
        raise HTTPException(status_code=422, detail="Nom de modèle invalide.")
    if system_prompt and len(system_prompt) > 100_000:
        raise HTTPException(status_code=422, detail="Le prompt système est trop long.")
    if max_segments is not None and not 1 <= max_segments <= 100_000:
        raise HTTPException(status_code=422, detail="Limite de segments invalide.")
    if len(api_type) > 50 or (endpoint and len(endpoint) > 2_000):
        raise HTTPException(status_code=422, detail="Configuration fournisseur invalide.")
    job_id = uuid.uuid4().hex[:12]
    job_dir = settings.JOBS_DIR / job_id
    filename = _safe_filename(file.filename)
    input_path = job_dir / "input" / filename
    output_path = job_dir / "output" / f"traduit_{filename}"
    try:
        if endpoint:
            endpoint = await validate_llm_endpoint(endpoint, api_type)
        await save_upload_limited(file, input_path)
        return await engine.prepare_job(
            input_path,
            source_lang=source_lang,
            target_lang=target_lang,
            model=model,
            glossary_name=glossary_name,
            system_prompt=system_prompt,
            chunk_token_size=chunk_size,
            temperature=temperature,
            concurrency=concurrency,
            max_segments=max_segments,
            job_type=job_type,
            job_id=job_id,
            output_file=output_path,
            api_type=api_type,
            endpoint=endpoint,
            enable_proofreading=enable_proofreading,
            enable_prompt_caching=enable_prompt_caching,
        )
    except UploadValidationError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        logger.exception("Job creation failed")
        raise HTTPException(status_code=400, detail="Impossible de préparer ce document.") from exc


@router.post("/jobs/{job_id}/clone-for-proofread", response_model=JobRecord)
async def clone_job_for_proofreading(job_id: str, model: Optional[str] = Form(None)):
    original = await db.get_job(job_id)
    if not original:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    if original.status != "COMPLETED" or await db.count_unfinished_segments(job_id):
        raise HTTPException(status_code=409, detail="La traduction doit être terminée avant la relecture.")
    translated = await engine.rebuild_output_file(job_id)
    new_id = uuid.uuid4().hex[:12]
    job_dir = settings.JOBS_DIR / new_id
    source_path = job_dir / "input" / translated.name
    output_path = job_dir / "output" / f"relu_{translated.name}"
    try:
        source_path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(shutil.copy2, translated, source_path)
        return await engine.prepare_job(
            source_path,
            source_lang=original.target_lang,
            target_lang=original.target_lang,
            model=model or original.model,
            glossary_name=original.glossary_name,
            chunk_token_size=original.chunk_size,
            temperature=0.15,
            concurrency=original.concurrency,
            job_type="proofreading",
            job_id=new_id,
            output_file=output_path,
            api_type=original.api_type,
            endpoint=original.endpoint,
            enable_prompt_caching=original.enable_prompt_caching,
        )
    except Exception:
        shutil.rmtree(job_dir, ignore_errors=True)
        raise


@router.get("/jobs", response_model=List[JobRecord])
async def list_jobs():
    return await db.list_jobs()


@router.get("/jobs/{job_id}", response_model=JobRecord)
async def get_job_detail(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return job


@router.get("/jobs/{job_id}/segments")
async def get_job_segments(job_id: str):
    if not await db.get_job(job_id):
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return await db.get_segments(job_id)


@router.post("/jobs/{job_id}/start")
async def start_job(
    job_id: str,
    endpoint: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    api_type: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    concurrency: Optional[int] = Form(None),
    temperature: Optional[float] = Form(None),
    enable_proofreading: Optional[bool] = Form(None),
    enable_prompt_caching: Optional[bool] = Form(None),
):
    if concurrency is not None and not 1 <= concurrency <= 32:
        raise HTTPException(status_code=422, detail="Concurrence invalide.")
    if temperature is not None and not 0 <= temperature <= 2:
        raise HTTPException(status_code=422, detail="Température invalide.")
    if model is not None and (not model.strip() or len(model) > 300):
        raise HTTPException(status_code=422, detail="Nom de modèle invalide.")
    if (api_type and len(api_type) > 50) or (endpoint and len(endpoint) > 2_000):
        raise HTTPException(status_code=422, detail="Configuration fournisseur invalide.")
    async with _task_lock:
        existing = active_tasks.get(job_id)
        if existing and not existing.done():
            raise HTTPException(status_code=409, detail="Ce projet est déjà en cours.")
        job = await db.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Projet introuvable.")
        provider = api_type or job.api_type or settings.API_TYPE
        resolved_endpoint = endpoint or job.endpoint
        if resolved_endpoint:
            resolved_endpoint = await validate_llm_endpoint(resolved_endpoint, provider)
        updates = {
            "temperature": temperature,
            "concurrency": concurrency,
            "model": model,
            "api_type": provider,
            "endpoint": resolved_endpoint,
            "enable_proofreading": enable_proofreading,
            "enable_prompt_caching": enable_prompt_caching,
        }
        await db.update_job_config(job_id, **updates)
        job = await db.get_job(job_id)
        client = await _new_client(
            job.api_type,
            job.endpoint,
            api_key,
            job.enable_prompt_caching,
        )
        if not await db.transition_job_status(job_id, ["PENDING", "PAUSED", "FAILED"], "PROCESSING"):
            await client.aclose()
            raise HTTPException(status_code=409, detail="Ce projet ne peut pas être relancé dans son état actuel.")

        async def run_wrapper():
            try:
                async with client:
                    await engine.run_job(job_id, client)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Background job %s failed", job_id)
            finally:
                async with _task_lock:
                    if active_tasks.get(job_id) is asyncio.current_task():
                        active_tasks.pop(job_id, None)

        task = asyncio.create_task(run_wrapper(), name=f"tradoc-job-{job_id}")
        active_tasks[job_id] = task
    return {"message": "Projet démarré.", "job_id": job_id}


@router.post("/jobs/{job_id}/update-config")
async def update_job_config(
    job_id: str,
    temperature: Optional[float] = Form(None),
    concurrency: Optional[int] = Form(None),
    model: Optional[str] = Form(None),
):
    if temperature is not None and not 0 <= temperature <= 2:
        raise HTTPException(status_code=422, detail="Température invalide.")
    if concurrency is not None and not 1 <= concurrency <= 32:
        raise HTTPException(status_code=422, detail="Concurrence invalide.")
    if model is not None and (not model.strip() or len(model) > 300):
        raise HTTPException(status_code=422, detail="Nom de modèle invalide.")
    if not await db.update_job_config(job_id, temperature=temperature, concurrency=concurrency, model=model):
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return {"message": "Configuration mise à jour.", "job_id": job_id}


@router.post("/jobs/{job_id}/proofread")
async def run_offline_proofreading(
    job_id: str,
    endpoint: Optional[str] = Form(None),
    api_key: Optional[str] = Form(None),
    api_type: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    concurrency: int = Form(1),
):
    if not 1 <= concurrency <= 32:
        raise HTTPException(status_code=422, detail="Concurrence invalide.")
    if model is not None and (not model.strip() or len(model) > 300):
        raise HTTPException(status_code=422, detail="Nom de modèle invalide.")
    if (api_type and len(api_type) > 50) or (endpoint and len(endpoint) > 2_000):
        raise HTTPException(status_code=422, detail="Configuration fournisseur invalide.")
    async with _task_lock:
        if job_id in active_tasks and not active_tasks[job_id].done():
            raise HTTPException(status_code=409, detail="Ce projet est déjà en cours.")
        job = await db.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Projet introuvable.")
        if job.status != "COMPLETED":
            raise HTTPException(status_code=409, detail="La traduction doit être terminée.")
        provider = api_type or job.api_type
        resolved_endpoint = endpoint or job.endpoint
        if resolved_endpoint:
            resolved_endpoint = await validate_llm_endpoint(resolved_endpoint, provider)
        await db.update_job_config(job_id, model=model, api_type=provider, endpoint=resolved_endpoint)
        job = await db.get_job(job_id)
        client = await _new_client(job.api_type, job.endpoint, api_key, job.enable_prompt_caching)
        await db.update_job_status(job_id, "PROCESSING")

        async def wrapper():
            try:
                async with client:
                    await engine.run_proofreading_job(job_id, client, concurrency)
            except asyncio.CancelledError:
                await db.update_job_status(job_id, "COMPLETED", job.completed_at)
                raise
            except Exception:
                await db.update_job_status(job_id, "COMPLETED", job.completed_at)
                logger.exception("Offline proofreading %s failed", job_id)
                engine._broadcast_event("proofread_job_failed", {"job_id": job_id})
            finally:
                async with _task_lock:
                    if active_tasks.get(job_id) is asyncio.current_task():
                        active_tasks.pop(job_id, None)

        active_tasks[job_id] = asyncio.create_task(wrapper(), name=f"tradoc-proofread-{job_id}")
    return {"message": "Relecture lancée.", "job_id": job_id}


@router.post("/jobs/{job_id}/pause")
async def pause_job(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    await db.update_job_status(job_id, "PAUSED")
    await _cancel_task(job_id)
    await db.reset_processing_segments(job_id)
    engine._broadcast_event("job_paused", {"job_id": job_id})
    return {"message": "Projet mis en pause.", "job_id": job_id}


@router.post("/jobs/{job_id}/retry")
async def retry_failed_segments(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    if job_id in active_tasks and not active_tasks[job_id].done():
        raise HTTPException(status_code=409, detail="Mettez d'abord le projet en pause.")
    await db.reset_failed_segments(job_id)
    await db.reset_processing_segments(job_id)
    await db.update_job_status(job_id, "PENDING")
    engine._broadcast_event("job_retried", {"job_id": job_id})
    return {"message": "Segments en échec réinitialisés.", "job_id": job_id}


@router.get("/jobs/{job_id}/download")
async def download_translated_book(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    unfinished_count = await db.count_unfinished_segments(job_id)
    is_partial = job.status != "COMPLETED" or unfinished_count > 0
    if is_partial and job.completed_chunks <= 0:
        raise HTTPException(status_code=409, detail="Aucun segment traduit n'est encore disponible pour l'aperçu.")
    try:
        output = await engine.rebuild_output_file(job_id, allow_partial=is_partial)
    except Exception as exc:
        logger.exception("Export rebuild failed for %s", job_id)
        raise HTTPException(status_code=500, detail="La reconstruction du document a échoué.") from exc
    media_types = {
        ".epub": "application/epub+zip",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".md": "text/markdown; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
    }
    download_name = f"apercu_partiel_{job.file_name}" if is_partial else output.name
    response_headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-TraDoc-Export": "partial" if is_partial else "final",
    }
    return FileResponse(
        output,
        filename=download_name,
        media_type=media_types.get(output.suffix.lower(), "application/octet-stream"),
        headers=response_headers,
        background=BackgroundTask(output.unlink, missing_ok=True) if is_partial else None,
    )


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    await _cancel_task(job_id)
    if not await db.delete_job(job_id):
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    job_dir = (settings.JOBS_DIR / job_id).resolve()
    try:
        job_dir.relative_to(settings.JOBS_DIR.resolve())
        if job_dir.is_dir():
            await asyncio.to_thread(shutil.rmtree, job_dir)
    except (ValueError, OSError):
        logger.exception("Could not remove storage for job %s", job_id)

    # Legacy jobs may live in shared folders. Delete only unreferenced exact files.
    for stored in (job.source_path, job.output_path):
        if stored and await db.count_jobs_using_path(stored, job_id) == 0:
            candidate = (settings.DATA_DIR / stored).resolve()
            try:
                candidate.relative_to(settings.DATA_DIR.resolve())
                if candidate.is_file() and settings.JOBS_DIR.resolve() not in candidate.parents:
                    candidate.unlink()
            except (ValueError, OSError):
                logger.warning("Could not remove legacy file for %s", job_id)
    if not job.source_path and await db.count_jobs_with_filename(job.file_name, job_id) == 0:
        for candidate in (
            settings.INPUT_DIR / job.file_name,
            settings.OUTPUT_DIR / f"traduit_{job.file_name}",
        ):
            try:
                if candidate.is_file():
                    candidate.unlink()
            except OSError:
                logger.warning("Could not remove legacy file %s", candidate)
    engine._broadcast_event("job_deleted", {"job_id": job_id})
    return {"message": "Projet et fichiers supprimés.", "job_id": job_id}


@router.get("/glossaries", response_model=List[str])
async def list_glossaries():
    return glossary_mgr.list_glossaries()


@router.get("/glossaries/{name}")
async def get_glossary(name: str):
    glossary = glossary_mgr.load_glossary(name)
    if not glossary:
        raise HTTPException(status_code=404, detail="Glossaire introuvable.")
    return glossary


@router.post("/glossaries")
async def save_glossary(glossary: Glossary):
    if not glossary_mgr.save_glossary(glossary):
        raise HTTPException(status_code=500, detail="Le glossaire n'a pas pu être enregistré.")
    return {"message": "Glossaire enregistré."}


@router.delete("/glossaries/{name}")
async def delete_glossary(name: str):
    if not glossary_mgr.delete_glossary(name):
        raise HTTPException(status_code=404, detail="Glossaire introuvable.")
    return {"message": "Glossaire supprimé."}


@router.get("/events")
async def sse_events(request: Request):
    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)

        def on_event(event):
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            queue.put_nowait(event)

        engine.add_listener(on_event)
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while not await request.is_disconnected():
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            engine.remove_listener(on_event)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"},
    )
