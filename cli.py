import sys
import asyncio
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn
from rich.table import Table

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from core.config import settings
from core.checkpoint import CheckpointDatabase
from core.glossary import GlossaryManager
from core.llm_client import LLMClient
from core.engine import TranslationEngine

cli_app = typer.Typer(help="TraDoc CLI - Traducteur Littéraire Haute Performance pour EPUB & PDF")
console = Console(legacy_windows=False)

db = CheckpointDatabase(settings.DB_PATH)
glossary_mgr = GlossaryManager(settings.GLOSSARY_DIR)
engine = TranslationEngine(db, glossary_mgr)

@cli_app.command("translate")
def translate(
    input_file: Path = typer.Option(..., "--input", "-i", help="Chemin vers le fichier EPUB ou PDF"),
    model: str = typer.Option(settings.LLM_MODEL, "--model", "-m", help="Modèle LLM distant (ex: qwen3.5-instruct)"),
    endpoint: str = typer.Option(settings.LLM_ENDPOINT, "--endpoint", "-e", help="URL du serveur LLM distant"),
    api_key: str = typer.Option(settings.LLM_API_KEY, "--api-key", help="Clé API LLM (si nécessaire)"),
    concurrent: int = typer.Option(settings.CONCURRENCY, "--concurrent", "-c", help="Nombre de requêtes parallèles (Semaphore)"),
    source_lang: str = typer.Option("en", "--source", "-s", help="Langue source (ex: en)"),
    target_lang: str = typer.Option("fr", "--target", "-t", help="Langue cible (ex: fr)"),
    glossary: Optional[str] = typer.Option(None, "--glossary", "-g", help="Nom du glossaire à injecter"),
):
    """Lance la traduction d'un ouvrage EPUB ou PDF."""
    if not input_file.exists():
        console.print(f"[bold red]Erreur :[/bold red] Le fichier '{input_file}' n'existe pas.")
        raise typer.Exit(1)

    console.print(f"[bold cyan]TraDoc[/bold cyan] - Début de pré-traitement pour : [bold yellow]{input_file.name}[/bold yellow]")
    
    async def run():
        client = LLMClient(endpoint=endpoint, api_key=api_key)
        
        # Test connection
        conn_ok, msg = await client.check_connection()
        if not conn_ok:
            console.print(f"[bold red]Erreur de connexion au serveur LLM :[/bold red] {msg}")
            raise typer.Exit(1)

        console.print(f"[bold green]Serveur LLM prêt :[/bold green] {msg}")

        # Prepare Job
        with console.status("[bold blue]Analyse & découpage du livre en cours...[/bold blue]"):
            job = await engine.prepare_job(
                input_file=input_file,
                source_lang=source_lang,
                target_lang=target_lang,
                model=model,
                glossary_name=glossary
            )

        console.print(f"[bold green]Job créé avec succès ![/bold green] Job ID: [bold text]{job.id}[/bold text] ({job.total_chunks} segments)")

        # Progress bar setup
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task(f"Traduction de {job.file_name}...", total=job.total_chunks)

            def on_event(ev):
                if ev.get("type") == "segment_completed":
                    progress.update(task, completed=ev.get("completed_chunks", 0))

            engine.add_listener(on_event)

            # Execute translation engine
            await engine.run_job(job.id, client, concurrency=concurrent)

        final_job = await db.get_job(job.id)
        if final_job and final_job.status == "COMPLETED":
            out_file = settings.OUTPUT_DIR / f"traduit_{job.file_name}"
            console.print(f"\n🎉 [bold green]Traduction terminée avec succès ![/bold green]")
            console.print(f"📖 Fichier traduit disponible : [bold yellow]{out_file}[/bold yellow]")
        else:
            console.print(f"\n⚠️ [bold red]La traduction s'est terminée avec des erreurs.[/bold red]")

    asyncio.run(run())

@cli_app.command("status")
def status():
    """Affiche la liste des jobs de traduction et leur statut."""
    async def run():
        jobs = await db.list_jobs()
        table = Table(title="TraDoc - Suivi des Jobs de Traduction")
        table.add_column("ID", style="cyan")
        table.add_column("Fichier", style="yellow")
        table.add_column("Modèle", style="magenta")
        table.add_column("Statut", style="green")
        table.add_column("Progression", style="blue")
        table.add_column("Créé le", style="dim")

        for j in jobs:
            prog = f"{j.completed_chunks}/{j.total_chunks}"
            table.add_row(j.id, j.file_name, j.model, j.status, prog, j.created_at[:19])

        console.print(table)

    asyncio.run(run())

if __name__ == "__main__":
    cli_app()
