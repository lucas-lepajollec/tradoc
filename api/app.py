import asyncio
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from api.routes import active_tasks, router as api_router
from core.config import settings
from core import __version__


logger = logging.getLogger("tradoc.app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if (
        settings.ENV.lower() == "production"
        and not settings.TRUSTED_LAN_PROXY
        and not (settings.APP_SECRET or "").strip()
    ):
        logger.warning("APP_SECRET is empty: keep TraDoc bound to localhost or configure authentication before LAN exposure")
    yield
    tasks = [task for task in active_tasks.values() if not task.done()]
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


is_production = settings.ENV.lower() == "production"
app = FastAPI(
    title=settings.APP_NAME,
    description="TraDoc - Literary Book Translator Service",
    version=__version__,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    lifespan=lifespan,
)


origins = [origin.strip().rstrip("/") for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-App-Secret"],
    )


request_windows: dict[str, deque[float]] = defaultdict(deque)


class RequestBodyTooLarge(Exception):
    pass


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.MAX_UPLOAD_BYTES + 10 * 1024 * 1024:
                return JSONResponse({"detail": "Corps de requête trop volumineux."}, status_code=413)
        except ValueError:
            return JSONResponse({"detail": "En-tête Content-Length invalide."}, status_code=400)
    original_receive = request._receive
    received = 0

    async def limited_receive():
        nonlocal received
        message = await original_receive()
        received += len(message.get("body", b""))
        if received > settings.MAX_UPLOAD_BYTES + 10 * 1024 * 1024:
            raise RequestBodyTooLarge()
        return message

    request._receive = limited_receive
    if len(request_windows) > 5000:
        for stale_key in [key for key, values in request_windows.items() if not values or values[-1] <= now - 60]:
            request_windows.pop(stale_key, None)
    sensitive = request.url.path.endswith("/start") or request.url.path.startswith("/api/settings/test")
    upload = request.url.path in {"/api/jobs/upload", "/api/settings/sandbox-extract"}
    limit = 20 if upload else 40 if sensitive else 240
    key = f"{client_ip}:{'upload' if upload else 'sensitive' if sensitive else 'general'}"
    window = request_windows[key]
    while window and window[0] <= now - 60:
        window.popleft()
    if len(window) >= limit:
        return JSONResponse({"detail": "Trop de requêtes. Réessayez dans une minute."}, status_code=429)
    window.append(now)

    try:
        response = await call_next(request)
    except RequestBodyTooLarge:
        return JSONResponse({"detail": "Corps de requête trop volumineux."}, status_code=413)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; "
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    )
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
    return response


@app.exception_handler(Exception)
async def unexpected_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled API exception", exc_info=exc)
    return JSONResponse({"detail": "Une erreur interne est survenue."}, status_code=500)


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


app.include_router(api_router, prefix="/api")


web_build_dir = Path("./web/dist").resolve()
if web_build_dir.exists():
    assets_dir = web_build_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        target = (web_build_dir / full_path).resolve()
        try:
            target.relative_to(web_build_dir)
        except ValueError:
            return JSONResponse({"detail": "Chemin invalide."}, status_code=400)
        if target.is_file():
            return FileResponse(target)
        return FileResponse(web_build_dir / "index.html")
