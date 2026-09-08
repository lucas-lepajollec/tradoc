import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

import typer
import uvicorn

from cli import cli_app


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


app = typer.Typer(help="TraDoc — traduction littéraire auto-hébergée")


def _ensure_port_available(port: int, label: str) -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.settimeout(0.25)
        if probe.connect_ex(("127.0.0.1", port)) == 0:
            raise typer.BadParameter(f"Le port {port} ({label}) est déjà utilisé.")


def _process_options() -> dict:
    if os.name == "nt":
        # Keep every child in TraDoc's console group so one Ctrl+C reaches the
        # supervisor, Uvicorn's reloader/server and Vite together.
        return {}
    return {"start_new_session": True}


def _stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        # npm.cmd and Uvicorn's reloader both spawn descendants. Terminating only
        # the immediate process leaves Node or Python listening on their ports.
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()


@app.command("serve")
def serve(
    host: str = typer.Option("127.0.0.1", "--host", "-h", help="Adresse IP d'écoute"),
    port: int = typer.Option(8000, "--port", "-p", min=1, max=65535, help="Port du serveur web"),
    reload: bool = typer.Option(False, "--reload", help="Activer le rechargement du backend"),
):
    """Démarre l'API et sert le dashboard compilé."""
    typer.echo(f"[TraDoc] Serveur disponible sur http://{host}:{port}")
    uvicorn.run("api.app:app", host=host, port=port, reload=reload)


@app.command("dev")
def dev(
    lan: bool = typer.Option(False, "--lan", help="Exposer TraDoc sur un LAN de confiance"),
    api_port: int = typer.Option(8000, "--api-port", min=1, max=65535),
    web_port: int = typer.Option(2499, "--web-port", min=1, max=65535),
    reload: bool = typer.Option(False, "--reload/--no-reload", help="Recharger le backend à chaque modification"),
):
    """Démarre le backend et Vite ensemble, en local par défaut."""
    if api_port == web_port:
        raise typer.BadParameter("Les ports du backend et du frontend doivent être différents.")
    _ensure_port_available(api_port, "API")
    _ensure_port_available(web_port, "frontend")

    node = shutil.which("node.exe" if os.name == "nt" else "node")
    if not node:
        raise typer.BadParameter("Node.js est introuvable. Installez-le puis relancez la commande.")
    web_dir = Path(__file__).resolve().parent / "web"
    vite_entry = web_dir / "node_modules" / "vite" / "bin" / "vite.js"
    if not vite_entry.is_file():
        raise typer.BadParameter("Dépendances frontend absentes : exécutez d'abord 'cd web' puis 'npm ci'.")

    frontend_host = "0.0.0.0" if lan else "127.0.0.1"
    environment = os.environ.copy()
    environment["TRADOC_API_PORT"] = str(api_port)
    environment["TRUSTED_LAN_PROXY"] = "true" if lan else "false"
    backend_command = [
        sys.executable,
        "-m",
        "uvicorn",
        "api.app:app",
        "--host",
        "127.0.0.1",
        "--port",
        str(api_port),
    ]
    if reload:
        backend_command.append("--reload")
    frontend_command = [
        node,
        str(vite_entry),
        "--host",
        frontend_host,
        "--port",
        str(web_port),
    ]

    processes: list[subprocess.Popen] = []
    try:
        processes.append(subprocess.Popen(backend_command, env=environment, **_process_options()))
        processes.append(subprocess.Popen(frontend_command, cwd=web_dir, env=environment, **_process_options()))
        location = f"http://{'<IP-DE-LA-MACHINE>' if lan else '127.0.0.1'}:{web_port}"
        typer.echo(f"[TraDoc] Développement disponible sur {location}")
        if lan:
            typer.echo("[TraDoc] Attention : réservé à un réseau de confiance.")
        typer.echo("[TraDoc] Ctrl+C arrête les deux processus.")
        while all(process.poll() is None for process in processes):
            time.sleep(0.25)
        failed = next((process for process in processes if process.returncode), None)
        if failed:
            raise typer.Exit(failed.returncode)
    except KeyboardInterrupt:
        typer.echo("\n[TraDoc] Arrêt en cours…")
    finally:
        for process in reversed(processes):
            _stop_process(process)


app.add_typer(cli_app, name="cli")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in {"translate", "status"}:
        cli_app()
    else:
        app()
