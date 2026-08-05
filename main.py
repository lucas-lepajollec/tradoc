import sys
import uvicorn
import typer
from cli import cli_app

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

app = typer.Typer(help="TraDoc - Service de Traduction Littéraire Haute Performance")

@app.command("serve")
def serve(
    host: str = typer.Option("0.0.0.0", "--host", "-h", help="Adresse IP d'écoute"),
    port: int = typer.Option(8000, "--port", "-p", help="Port du serveur web"),
    reload: bool = typer.Option(False, "--reload", help="Activer le hot-reload en développement")
):
    """Démarre le serveur Web API et le Dashboard TraDoc."""
    print(f"[TraDoc] Démarrage du serveur sur http://{host}:{port}")
    uvicorn.run("api.app:app", host=host, port=port, reload=reload)

# Add CLI commands from cli.py
app.add_typer(cli_app, name="cli")

if __name__ == "__main__":
    # If called with 'translate' or 'status' directly, pass through
    if len(sys.argv) > 1 and sys.argv[1] in ["translate", "status"]:
        cli_app()
    else:
        app()
