import asyncio
import json
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Query, Header, Depends
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import time
from core.config import settings, DEFAULT_LITERARY_SYSTEM_PROMPT
from core.checkpoint import CheckpointDatabase, JobRecord, SegmentRecord
from core.glossary import GlossaryManager, Glossary, GlossaryItem
from core.llm_client import LLMClient
from core.engine import TranslationEngine
from core.parser_epub import EpubParser
from core.parser_pdf import PdfParser
from core.parser_docx import DocxParser
from core.parser_text import TextParser

async def verify_app_secret(x_app_secret: Optional[str] = Header(None, alias="X-App-Secret")):
    if settings.APP_SECRET and settings.APP_SECRET.strip():
        if not x_app_secret or x_app_secret.strip() != settings.APP_SECRET.strip():
            raise HTTPException(status_code=401, detail="Accès refusé : Token d'application (X-App-Secret) invalide ou manquant.")

router = APIRouter(dependencies=[Depends(verify_app_secret)])

# Global instances initialized in app startup
db = CheckpointDatabase(settings.DB_PATH)
glossary_mgr = GlossaryManager(settings.GLOSSARY_DIR)
engine = TranslationEngine(db, glossary_mgr)

# Active running background tasks
active_tasks: dict[str, asyncio.Task] = {}

class ConnectionTestRequest(BaseModel):
    endpoint: str
    api_key: Optional[str] = "lm-studio"
    api_type: Optional[str] = "openai"

class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    models: List[str] = []

class TestTranslationRequest(BaseModel):
    text: str
    model: str
    endpoint: Optional[str] = None
    api_key: Optional[str] = "lm-studio"
    api_type: Optional[str] = "openai"
    glossary_name: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = 1.5

class TestTranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    execution_time_ms: float
    model_used: str

@router.post("/settings/test-connection", response_model=ConnectionTestResponse)
async def test_connection(req: ConnectionTestRequest):
    client = LLMClient(endpoint=req.endpoint, api_key=req.api_key or "", api_type=req.api_type or "openai")
    success, message = await client.check_connection()
    models = await client.fetch_models() if success else []
    return ConnectionTestResponse(success=success, message=message, models=models)

@router.post("/settings/test-translation", response_model=TestTranslationResponse)
async def test_translation(req: TestTranslationRequest):
    start_time = time.time()
    endpoint_url = req.endpoint or settings.LLM_ENDPOINT
    client = LLMClient(endpoint=endpoint_url, api_key=req.api_key or settings.LLM_API_KEY, api_type=req.api_type or settings.API_TYPE)
    
    prompt = req.system_prompt or DEFAULT_LITERARY_SYSTEM_PROMPT
    if req.glossary_name:
        glossary = glossary_mgr.load_glossary(req.glossary_name)
        if glossary:
            prompt += "\n" + glossary.to_prompt_text()

    model_to_use = req.model or settings.LLM_MODEL

    try:
        temp_to_use = req.temperature if req.temperature is not None else settings.TEMPERATURE
        translated = await client.translate_chunk(
            system_prompt=prompt,
            text_chunk=req.text,
            model=model_to_use,
            temperature=temp_to_use
        )
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return TestTranslationResponse(
            original_text=req.text,
            translated_text=translated,
            execution_time_ms=elapsed_ms,
            model_used=model_to_use
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/settings/sandbox-extract")
async def sandbox_extract(
    file: UploadFile = File(...),
    limit_tokens: int = Form(1000)
):
    import uuid
    import shutil
    import re
    from core.parser_epub import EpubParser
    from core.chunker import estimate_tokens

    temp_path = settings.DATA_DIR / f"temp_sandbox_{uuid.uuid4().hex[:8]}.epub"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        ext = temp_path.suffix.lower()
        if ext == ".epub":
            parser = EpubParser(temp_path)
            _, node_texts = parser.extract_nodes()
        elif ext == ".pdf":
            parser = PdfParser(temp_path)
            _, node_texts = parser.extract_nodes()
        elif ext == ".docx":
            parser = DocxParser(temp_path)
            _, node_texts = parser.extract_nodes()
        elif ext in [".md", ".txt"]:
            parser = TextParser(temp_path)
            _, node_texts = parser.extract_nodes()
        else:
            raise ValueError(f"Format non supporté: {ext}")
        
        selected_nodes = []
        current_tokens = 0
        has_started = False

        front_matter_keywords = [
            "table of contents", "contents", "sommaire", "copyright", 
            "all rights reserved", "isbn", "publisher", "title page",
            "cataloging-in-publication", "dédicace", "dedication"
        ]

        for node in node_texts:
            node_clean = node.strip()
            if not node_clean:
                continue

            pure_text = re.sub(r'<[^>]*>', '', node_clean).strip()
            pure_lower = pure_text.lower()

            if not has_started:
                is_front_matter = any(kw in pure_lower for kw in front_matter_keywords)
                is_too_short = len(pure_text) < 40
                has_link = "<a " in node_clean.lower() or "href=" in node_clean.lower()
                is_chapter_title = bool(re.match(r'^(chapter|chapitre)\s+\d+', pure_lower))

                if is_front_matter or is_too_short or has_link or is_chapter_title:
                    continue
                
                # Found the first real narrative paragraph!
                has_started = True

            node_tokens = estimate_tokens(node_clean)
            selected_nodes.append(node_clean)
            current_tokens += node_tokens
            if current_tokens >= limit_tokens:
                break

        # Fallback if no narrative paragraph was found
        if not selected_nodes:
            for node in node_texts:
                node_clean = node.strip()
                if not node_clean:
                    continue
                node_tokens = estimate_tokens(node_clean)
                selected_nodes.append(node_clean)
                current_tokens += node_tokens
                if current_tokens >= limit_tokens:
                    break

        if temp_path.exists():
            temp_path.unlink()
            
        return {"text": "\n\n".join(selected_nodes)}
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/models")
async def list_remote_models(
    endpoint: str = Query(default_factory=lambda: settings.LLM_ENDPOINT),
    api_key: str = Query(default_factory=lambda: settings.LLM_API_KEY)
):
    client = LLMClient(endpoint=endpoint, api_key=api_key)
    models = await client.fetch_models()
    return {"endpoint": endpoint, "models": models}

@router.post("/jobs/upload")
async def upload_and_create_job(
    file: UploadFile = File(...),
    source_lang: str = Form("en"),
    target_lang: str = Form("fr"),
    model: str = Form(...),
    glossary_name: Optional[str] = Form(None),
    system_prompt: Optional[str] = Form(None),
    chunk_size: int = Form(1000),
    temperature: float = Form(default_factory=lambda: settings.TEMPERATURE),
    concurrency: int = Form(default_factory=lambda: settings.CONCURRENCY),
    max_segments: Optional[int] = Form(None),
    job_type: str = Form("translation")
):
    try:
        safe_filename = Path(file.filename or "book.epub").name
        dest_path = settings.INPUT_DIR / safe_filename
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        job = await engine.prepare_job(
            input_file=dest_path,
            source_lang=source_lang,
            target_lang=target_lang,
            model=model,
            glossary_name=glossary_name,
            system_prompt=system_prompt,
            chunk_token_size=chunk_size,
            temperature=temperature,
            concurrency=concurrency,
            max_segments=max_segments,
            job_type=job_type
        )
        return job
    except PermissionError:
        raise HTTPException(
            status_code=400,
            detail="Permission refusée lors de l'écriture dans le dossier 'data/input'. "
                   "Sur votre serveur Docker, exécutez la commande : chmod -R 777 ./data (ou chown -R 1000:1000 ./data)."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/jobs/{job_id}/clone-for-proofread")
async def clone_job_for_proofreading(
    job_id: str,
    model: Optional[str] = Form(None)
):
    original_job = await db.get_job(job_id)
    if not original_job:
        raise HTTPException(status_code=404, detail="Job original non trouvé")

    input_file = settings.INPUT_DIR / original_job.file_name
    if not input_file.exists():
        raise HTTPException(status_code=404, detail=f"Fichier d'origine non trouvé: {original_job.file_name}")

    proofread_job = await engine.prepare_job(
        input_file=input_file,
        source_lang=original_job.source_lang,
        target_lang=original_job.target_lang,
        model=model or original_job.model,
        glossary_name=original_job.glossary_name,
        system_prompt=DEFAULT_PROOFREADING_SYSTEM_PROMPT,
        chunk_token_size=original_job.chunk_size,
        temperature=0.15,
        concurrency=original_job.concurrency,
        job_type="proofreading"
    )
    return proofread_job

@router.get("/jobs", response_model=List[JobRecord])
async def list_jobs():
    return await db.list_jobs()

@router.get("/jobs/{job_id}")
async def get_job_detail(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job non trouvé")
    return job

@router.get("/jobs/{job_id}/segments")
async def get_job_segments(job_id: str):
    return await db.get_segments(job_id)

@router.post("/jobs/{job_id}/start")
async def start_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    endpoint: str = Form(default_factory=lambda: settings.LLM_ENDPOINT),
    api_key: str = Form(default_factory=lambda: settings.LLM_API_KEY),
    api_type: Optional[str] = Form("openai"),
    model: Optional[str] = Form(None),
    concurrency: Optional[int] = Form(None),
    temperature: Optional[float] = Form(None),
    enable_proofreading: bool = Form(False)
):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job non trouvé")

    update_kwargs = {}
    if temperature is not None:
        update_kwargs["temperature"] = temperature
    if concurrency is not None:
        update_kwargs["concurrency"] = concurrency
    if model is not None:
        update_kwargs["model"] = model
    
    if update_kwargs:
        await db.update_job_config(job_id, **update_kwargs)
        job = await db.get_job(job_id)

    await db.update_job_status(job_id, "PROCESSING")

    client = LLMClient(endpoint=endpoint, api_key=api_key, api_type=api_type or "openai")
    
    async def run_wrapper():
        try:
            print(f"[TraDoc API] 🚀 Lancement tâche de fond pour le job {job_id} sur {endpoint} (Modèle={job.model}, Type={api_type})...")
            await engine.run_job(job_id, client, concurrency=job.concurrency, temperature=job.temperature, enable_proofreading=enable_proofreading)
        except Exception as exc:
            print(f"[TraDoc API ERROR] ❌ Échec critique lors du traitement du job {job_id}: {exc}")
        finally:
            active_tasks.pop(job_id, None)

    task = asyncio.create_task(run_wrapper())
    active_tasks[job_id] = task
    return {"message": "Job démarré avec succès", "job_id": job_id}

@router.post("/jobs/{job_id}/update-config")
async def update_job_config(
    job_id: str,
    temperature: Optional[float] = Form(None),
    concurrency: Optional[int] = Form(None),
    model: Optional[str] = Form(None)
):
    await db.update_job_config(job_id, temperature=temperature, concurrency=concurrency, model=model)
    return {"message": "Configuration du job mise à jour", "job_id": job_id}

@router.post("/jobs/{job_id}/proofread")
async def run_offline_proofreading(
    job_id: str,
    endpoint: str = Form(default_factory=lambda: settings.LLM_ENDPOINT),
    api_key: str = Form(default_factory=lambda: settings.LLM_API_KEY),
    api_type: Optional[str] = Form("openai"),
    model: Optional[str] = Form(None),
    concurrency: int = Form(1)
):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job non trouvé")

    update_kwargs = {}
    if model is not None:
        update_kwargs["model"] = model
    if update_kwargs:
        await db.update_job_config(job_id, **update_kwargs)
        job = await db.get_job(job_id)

    client = LLMClient(endpoint=endpoint, api_key=api_key, api_type=api_type or "openai")

    async def proofread_wrapper():
        try:
            print(f"[TraDoc API] ✒️ Lancement relecture hors-ligne pour job {job_id} sur {endpoint} (Modèle={job.model})...")
            await engine.run_proofreading_job(job_id, client, concurrency=concurrency)
        except Exception as exc:
            print(f"[TraDoc API ERROR] ❌ Échec relecture job {job_id}: {exc}")
        finally:
            active_tasks.pop(f"proofread_{job_id}", None)

    task = asyncio.create_task(proofread_wrapper())
    active_tasks[f"proofread_{job_id}"] = task
    return {"message": "Relecture lancée avec succès", "job_id": job_id}

@router.post("/jobs/{job_id}/pause")
async def pause_job(job_id: str):
    await db.update_job_status(job_id, "PAUSED")
    if job_id in active_tasks:
        active_tasks[job_id].cancel()
        active_tasks.pop(job_id, None)
    return {"message": "Job mis en pause", "job_id": job_id}

@router.post("/jobs/{job_id}/retry")
async def retry_failed_segments(job_id: str):
    await db.reset_failed_segments(job_id)
    await db.update_job_status(job_id, "PENDING")
    return {"message": "Segments réinitialisés. Vous pouvez relancer le job.", "job_id": job_id}

@router.get("/jobs/{job_id}/download")
async def download_translated_book(job_id: str):
    job = await db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job non trouvé")

    # Always rebuild output file on download so latest parser typography & segment edits are immediately applied
    out_file = await engine.rebuild_output_file(job_id)

    if not out_file.exists():
        raise HTTPException(status_code=400, detail="Fichier non prêt. Impossible de générer le document de sortie.")

    ext = out_file.suffix.lower()
    media_types = {
        ".epub": "application/epub+zip",
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".md": "text/markdown",
        ".txt": "text/plain",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    filename = out_file.name

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    return FileResponse(path=out_file, filename=filename, media_type=media_type, headers=headers)

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    if job_id in active_tasks:
        active_tasks[job_id].cancel()
        active_tasks.pop(job_id, None)
    await db.delete_job(job_id)
    return {"message": "Job supprimé", "job_id": job_id}

# Glossaries
@router.get("/glossaries", response_model=List[str])
async def list_glossaries():
    return glossary_mgr.list_glossaries()

@router.get("/glossaries/{name}")
async def get_glossary(name: str):
    g = glossary_mgr.load_glossary(name)
    if not g:
        raise HTTPException(status_code=404, detail="Glossaire non trouvé")
    return g

@router.post("/glossaries")
async def save_glossary(glossary: Glossary):
    success = glossary_mgr.save_glossary(glossary)
    if not success:
        raise HTTPException(status_code=500, detail="Erreur lors de la sauvegarde du glossaire")
    return {"message": "Glossaire sauvegardé avec succès"}

@router.delete("/glossaries/{name}")
async def delete_glossary(name: str):
    success = glossary_mgr.delete_glossary(name)
    if not success:
        raise HTTPException(status_code=404, detail="Glossaire non trouvé")
    return {"message": "Glossaire supprimé avec succès"}

# SSE stream for real-time updates
@router.get("/events")
async def sse_events():
    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        
        def on_event(event):
            queue.put_nowait(event)

        engine.add_listener(on_event)
        
        # Send initial connection ping
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        
        while True:
            try:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
            except asyncio.CancelledError:
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")
