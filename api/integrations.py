"""Versioned API for other apps (for example Bunko) that use TraDoc as an engine.

Every request carries ``Authorization: Bearer tdk_…`` for a connection created
in Settings › Integrations. A connection only sees the projects it created;
those projects also appear in the TraDoc interface like any other project.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from api.routes import (
    _provider_values,
    db,
    delete_job,
    download_translated_book,
    model_catalog,
    pause_job,
    start_job,
    upload_and_create_job,
    verify_request_origin,
)
from core import __version__
from core.checkpoint import ApiClient, JobRecord
from core.config import settings

API_VERSION = 1
SUPPORTED_FORMATS = ["epub", "pdf", "docx", "md", "txt"]
LOCAL_PROVIDERS = {"lm-studio", "ollama"}
STATUS_NAMES = {
    "PENDING": "pending",
    "PROCESSING": "running",
    "PAUSED": "paused",
    "COMPLETED": "completed",
    "FAILED": "failed",
}


async def require_client(request: Request) -> ApiClient:
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    client = await db.authenticate_api_client(token.strip()) if scheme.lower() == "bearer" else None
    if not client:
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid integration token.",
            headers={"WWW-Authenticate": 'Bearer realm="tradoc"'},
        )
    return client


router = APIRouter(dependencies=[Depends(verify_request_origin)])


class Progress(BaseModel):
    completed: int
    total: int
    percent: int


class TranslationOut(BaseModel):
    id: str
    status: Literal["pending", "running", "paused", "completed", "failed"]
    progress: Progress
    file_name: str
    source_lang: str
    target_lang: str
    provider: str
    model: str
    external_ref: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


def _translation(job: JobRecord) -> TranslationOut:
    total = max(job.total_chunks, 0)
    percent = round(job.completed_chunks * 100 / total) if total else 0
    return TranslationOut(
        id=job.id,
        status=STATUS_NAMES.get(job.status, "pending"),
        progress=Progress(completed=job.completed_chunks, total=total, percent=percent),
        file_name=job.file_name,
        source_lang=job.source_lang,
        target_lang=job.target_lang,
        provider=job.api_type,
        model=job.model,
        external_ref=job.external_ref,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


async def _own_job(job_id: str, client: ApiClient) -> JobRecord:
    job = await db.get_job(job_id)
    if not job or job.client_id != client.id:
        raise HTTPException(status_code=404, detail="Translation not found.")
    return job


@router.get("/info")
async def info(client: ApiClient = Depends(require_client)):
    """Lets a connecting app check its token and discover what TraDoc accepts."""
    return {
        "name": "TraDoc",
        "version": __version__,
        "api_version": API_VERSION,
        "client": {"id": client.id, "name": client.name},
        "formats": SUPPORTED_FORMATS,
        "default": {"provider": client.default_provider, "model": client.default_model},
    }


@router.get("/models")
async def models(_: ApiClient = Depends(require_client)):
    return await model_catalog()


@router.post("/translations", response_model=TranslationOut, status_code=202)
async def create_translation(
    file: UploadFile = File(...),
    source_lang: str = Form("en"),
    target_lang: str = Form("fr"),
    provider: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    glossary: Optional[str] = Form(None),
    external_ref: Optional[str] = Form(None),
    start: bool = Form(True),
    client: ApiClient = Depends(require_client),
):
    """Imports a document and, by default, starts translating it right away."""
    if external_ref is not None and len(external_ref) > 200:
        raise HTTPException(status_code=422, detail="external_ref is too long (200 characters max).")
    chosen_provider = (provider or client.default_provider or settings.API_TYPE or "openai").strip().lower()
    chosen_model = model
    if not chosen_model and chosen_provider == (client.default_provider or "").lower():
        chosen_model = client.default_model
    if not chosen_model:
        raise HTTPException(
            status_code=422,
            detail="No model: send `model`, or set a default model for this connection in TraDoc.",
        )
    local = chosen_provider in LOCAL_PROVIDERS
    endpoint, _ = _provider_values(chosen_provider, None, None)
    job = await upload_and_create_job(
        file=file,
        source_lang=source_lang,
        target_lang=target_lang,
        model=chosen_model,
        glossary_name=glossary or None,
        system_prompt=None,
        chunk_size=1000 if local else 6000,
        temperature=0.15,
        concurrency=1 if local else 4,
        max_segments=None,
        job_type="translation",
        api_type=chosen_provider,
        endpoint=endpoint,
        enable_proofreading=False,
        enable_prompt_caching=False,
    )
    await db.set_job_origin(job.id, client, external_ref)
    if start:
        await _start(job.id)
    return _translation(await db.get_job(job.id))


async def _start(job_id: str) -> None:
    await start_job(
        job_id,
        endpoint=None,
        api_key=None,
        api_type=None,
        model=None,
        concurrency=None,
        temperature=None,
        enable_proofreading=None,
        enable_prompt_caching=None,
    )


@router.get("/translations", response_model=List[TranslationOut])
async def list_translations(client: ApiClient = Depends(require_client)):
    return [_translation(job) for job in await db.list_client_jobs(client.id)]


@router.get("/translations/{job_id}", response_model=TranslationOut)
async def get_translation(job_id: str, client: ApiClient = Depends(require_client)):
    return _translation(await _own_job(job_id, client))


@router.get("/translations/{job_id}/result")
async def get_result(job_id: str, partial: bool = False, client: ApiClient = Depends(require_client)):
    """The rebuilt translated document. Before completion, pass `partial=true` for a preview."""
    job = await _own_job(job_id, client)
    if job.status != "COMPLETED" and not partial:
        raise HTTPException(status_code=409, detail="The translation is not finished yet.")
    return await download_translated_book(job_id)


@router.post("/translations/{job_id}/pause", response_model=TranslationOut)
async def pause_translation(job_id: str, client: ApiClient = Depends(require_client)):
    await _own_job(job_id, client)
    await pause_job(job_id)
    return _translation(await db.get_job(job_id))


@router.post("/translations/{job_id}/resume", response_model=TranslationOut)
async def resume_translation(job_id: str, client: ApiClient = Depends(require_client)):
    await _own_job(job_id, client)
    await _start(job_id)
    return _translation(await db.get_job(job_id))


@router.delete("/translations/{job_id}")
async def delete_translation(job_id: str, client: ApiClient = Depends(require_client)):
    await _own_job(job_id, client)
    await delete_job(job_id)
    return {"id": job_id, "deleted": True}
