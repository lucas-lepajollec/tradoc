# TraDoc commands

This guide complements the README with reproducible development and operation commands for Windows, Linux and macOS. Run every command from the repository root unless stated otherwise.

## Requirements

- Python 3.11 or newer
- Node.js 22 and npm
- Docker Engine with Compose v2 only for the container workflow

## Initial installation

Windows PowerShell:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm --prefix web ci
```

Linux / macOS:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements.txt
npm --prefix web ci
```

The commands use the virtual environment's interpreter directly, so shell activation is optional.

## Local development

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe main.py dev
```

Linux / macOS:

```bash
./.venv/bin/python main.py dev
```

Open <http://127.0.0.1:2499>. The supervisor starts the API and Vite together, and `Ctrl+C` stops both.

Useful options use the same arguments on every platform:

```text
main.py dev --api-port 8001 --web-port 2500
main.py dev --reload
```

Prefix `main.py` with `.\.venv\Scripts\python.exe` on Windows or `./.venv/bin/python` on Linux/macOS.

## Browser-only public demo

This mode needs no Python backend and uses only fictional in-browser data:

```shell
npm --prefix web run dev:demo
```

Open <http://127.0.0.1:2505>.

## Trusted-LAN development

Use only on a trusted private network:

```powershell
.\.venv\Scripts\python.exe main.py dev --lan
```

```bash
./.venv/bin/python main.py dev --lan
```

This mode intentionally disables authentication. For a shared LAN, configure a strong `APP_SECRET`, use `main.py dev --lan-secure`, and paste the secret into **Settings → Global & Language → Application token** without printing or recording it. Never use either LAN mode on a public or untrusted network.

## Production-style local server

Build the frontend on every platform:

```shell
npm --prefix web run build
```

Then serve it with the backend.

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe main.py serve
```

Linux / macOS:

```bash
./.venv/bin/python main.py serve
```

Binding beyond localhost requires a strong `APP_SECRET`:

```text
main.py serve --host 0.0.0.0 --port 8000
```

## Translation CLI

```powershell
.\.venv\Scripts\python.exe main.py translate --input .\livre.epub --model qwen3.5-9b --concurrent 2
.\.venv\Scripts\python.exe main.py status
```

```bash
./.venv/bin/python main.py translate --input ./book.epub --model qwen3.5-9b --concurrent 2
./.venv/bin/python main.py status
```

List every translation option with:

```text
main.py translate --help
```

## Docker

```bash
docker compose up -d --build
docker compose logs -f tradoc
docker compose down
```

TraDoc stores its database and sensitive working material under `data/`. Back up that directory before maintenance, and never commit its documents, outputs, glossaries or provider data.

## Validation before contributing

Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
npm --prefix web run check:i18n
npm --prefix web run build
npm --prefix web run test:e2e
npm --prefix web run check:demo
```

Linux / macOS:

```bash
./.venv/bin/python -m unittest discover -s tests -v
npm --prefix web run check:i18n
npm --prefix web run build
npm --prefix web run test:e2e
npm --prefix web run check:demo
```
