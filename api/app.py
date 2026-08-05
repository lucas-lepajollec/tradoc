import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.config import settings
from api.routes import router as api_router

app = FastAPI(
    title=settings.APP_NAME,
    description="TraDoc - Literary Book Translator Service (Async & Local)",
    version="1.0.0"
)

# CORS Configuration
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints
app.include_router(api_router, prefix="/api")

# Static React SPA frontend build serving
web_build_dir = Path("./web/dist")
if web_build_dir.exists():
    app.mount("/assets", StaticFiles(directory=web_build_dir / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't intercept API calls
        if full_path.startswith("api/"):
            return None
        target = web_build_dir / full_path
        if target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(web_build_dir / "index.html")
