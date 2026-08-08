import asyncio
import shutil
import sys
import uuid
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn, TimeRemainingColumn
from rich.table import Table

from core.checkpoint import CheckpointDatabase
from core.config import settings
from core.engine import TranslationEngine
from core.glossary import GlossaryManager
from core.llm_client import LLMClient


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

cli_app = typer.Typer(help="TraDoc CLI — traduction littéraire de documents")
console = Console(legacy_windows=False)
db = CheckpointDatabase(settings.DB_PATH)
glossary_mgr = GlossaryManager(settings.GLOSSARY_DIR)
engine = TranslationEngine(db, glossary_mgr)


@cli_app.command("translate")
def translate(
    input_file: Path = typer.Option(..., "--input", "-i", help="Document EPUB, PDF, DOCX, MD ou TXT"),
    model: str = typer.Option(settings.LLM_MODEL, "--model", "-m"),
    endpoint: str = typer.Option(settings.LLM_ENDPOINT, "--endpoint", "-e"),
    api_key: str = typer.Option(settings.LLM_API_KEY, "--api-key", help="Clé API si nécessaire"),
    api_type: str = typer.Option(settings.API_TYPE, "--api-type", help="openai, lm-studio, ollama, claude…"),
    concurrent: int = typer.Option(settings.CONCURRENCY, "--concurrent", "-c", min=1, max=32),
    source_lang: str = typer.Option("en", "--source", "-s"),
    target_lang: str = typer.Option("fr", "--target", "-t"),
    glossary: Optional[str] = typer.Option(None, "--glossary", "-g"),
):
    """Lance une traduction et conserve les checkpoints dans data/jobs/."""
    if not input_file.is_file():
        console.print(f"[bold red]Document introuvable :[/bold red] {input_file}")
        raise typer.Exit(1)

    async def run() -> None:
        client = LLMClient(endpoint=endpoint, api_key=api_key, api_type=api_type, timeout=settings.REQUEST_TIMEOUT)
        job_id = uuid.uuid4().hex[:12]
        job_dir = settings.JOBS_DIR / job_id
        stored_input = job_dir / "input" / input_file.name
        output_file = job_dir / "output" / f"traduit_{input_file.name}"
        stored_input.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(input_file, stored_input)
        try:
            connected, message = await client.check_connection()
            if not connected:
                console.print(f"[bold red]Connexion refusée :[/bold red] {message}")
                shutil.rmtree(job_dir, ignore_errors=True)
                raise typer.Exit(1)
            console.print(f"[bold green]Serveur LLM prêt :[/bold green] {message}")

            with console.status("[bold blue]Analyse et découpage du document…[/bold blue]"):
                job = await engine.prepare_job(
                    stored_input,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    model=model,
                    glossary_name=glossary,
                    job_id=job_id,
                    output_file=output_file,
                    api_type=api_type,
                    endpoint=endpoint,
                )

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TaskProgressColumn(),
                TimeRemainingColumn(),
                console=console,
            ) as progress:
                task_id = progress.add_task(f"Traduction de {job.file_name}…", total=job.total_chunks)

                def on_event(event):
                    if event.get("type") == "segment_completed":
                        progress.update(task_id, completed=event.get("completed_chunks", 0))

                engine.add_listener(on_event)
                try:
                    await engine.run_job(job.id, client, concurrency=concurrent)
                finally:
                    engine.remove_listener(on_event)

            final_job = await db.get_job(job.id)
            if final_job and final_job.status == "COMPLETED":
                console.print(f"[bold green]Traduction terminée :[/bold green] {settings.DATA_DIR / final_job.output_path}")
            else:
                console.print("[bold red]La traduction s'est terminée avec des erreurs.[/bold red]")
                raise typer.Exit(1)
        finally:
            await client.aclose()

    asyncio.run(run())


@cli_app.command("status")
def status():
    """Affiche les projets et leur progression."""

    async def run() -> None:
        jobs = await db.list_jobs()
        table = Table(title="TraDoc — projets")
        for label, style in (("ID", "cyan"), ("Fichier", "yellow"), ("Modèle", "magenta"), ("Statut", "green"), ("Progression", "blue"), ("Créé le", "dim")):
            table.add_column(label, style=style)
        for job in jobs:
            table.add_row(job.id, job.file_name, job.model, job.status, f"{job.completed_chunks}/{job.total_chunks}", job.created_at[:19])
        console.print(table)

    asyncio.run(run())


if __name__ == "__main__":
    cli_app()
