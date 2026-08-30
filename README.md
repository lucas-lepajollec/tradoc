<div align="center">
  <img src="web/public/logo.svg" alt="TraDoc logo" width="104" />
  <h1>TraDoc</h1>
  <p><strong>A self-hosted workflow for translating long documents without losing structure, context, or control.</strong></p>

  <p>
    <a href="https://tradoc.lucas-homelab.fr"><strong>Website</strong></a> ·
    <a href="https://demo.tradoc.lucas-homelab.fr"><strong>Live demo</strong></a> ·
    <a href="https://docs.tradoc.lucas-homelab.fr"><strong>Documentation</strong></a>
  </p>

  <p>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-6d7cff" alt="MIT license" /></a>
    <img src="https://img.shields.io/badge/self--hosted-111827" alt="Self-hosted" />
    <img src="https://img.shields.io/badge/providers-controllable-111827" alt="Controllable providers" />
  </p>

  <img src="docs/assets/screenshots/tradoc-demo-dashboard.png" alt="TraDoc document translation dashboard" width="1200" />
</div>

TraDoc is built for complete books and long-form documents rather than isolated text prompts. It extracts structured content, splits it into context-aware segments, coordinates local or remote language models, preserves progress in SQLite, and reconstructs an export that can be inspected before publication.

EPUB, PDF, DOCX, Markdown, and plain text workflows share one project model with checkpoints, glossaries, provider control, parallel jobs, and a side-by-side segment inspector.

## From document to controlled translation

| Translation workspace | Editorial inspection |
| --- | --- |
| Import a document, choose the source and target languages, select a provider/model, and start or prepare the project. | Review source and translated segments, monitor progress, resume jobs, retry failures, and export the result. |
| <img src="docs/assets/screenshots/tradoc-demo-dashboard.png" alt="TraDoc translation workspace" width="640" /> | <img src="docs/assets/screenshots/tradoc-demo-inspector.png" alt="TraDoc segment inspector and progress tracking" width="640" /> |

## Highlights

- Structured extraction and reconstruction for EPUB, PDF, DOCX, Markdown, and TXT.
- Semantic chunking with configurable context windows and output-token budgeting.
- Project-level model isolation so concurrent documents can use different models safely.
- Checkpointed, resumable jobs with automatic pause behavior when a provider becomes unavailable.
- Glossaries for names, places, terminology, and project-specific translation rules.
- Side-by-side segment inspection, inline project configuration, progress tracking, and SSE updates.
- Provider profiles for local and remote OpenAI-compatible workflows.
- Reflowable EPUB export and an editorial 6×9 PDF reconstruction path for book-like documents.
- Self-hosted FastAPI, React, and SQLite architecture suitable for a workstation, server, or NAS.

TraDoc can preserve workflow state and document structure; it cannot guarantee literary quality. Output quality still depends on the source document, parser limitations, model, prompt, glossary, context window, and human review.

## Quick start

### Requirements

- Python 3.11 or newer.
- Node.js 18 or newer.
- A local or remote language-model endpoint.

```bash
git clone https://github.com/lucas-lepajollec/tradoc.git
cd tradoc
cp .env.example .env
python -m venv .venv
```

Install the backend and frontend dependencies:

```bash
./.venv/bin/python -m pip install -r requirements.txt
npm --prefix web ci
```

On Windows, use `.\.venv\Scripts\python.exe` instead of `./.venv/bin/python`.

Start both FastAPI and Vite:

```bash
./.venv/bin/python main.py dev
```

Open `http://127.0.0.1:2499`. The command owns only the TraDoc development processes and stops them together with `Ctrl+C`.

### Testing from another device

`main.py dev --lan` exposes the development interface without an application token. Use it only on a trusted local network. On a shared network, set an `APP_SECRET` of at least 24 characters and use:

```bash
./.venv/bin/python main.py dev --lan-secure
```

The backend remains bound to localhost while the frontend proxy handles deliberate LAN access.

## Docker deployment

The recommended production path uses the published GHCR image and a persistent data directory:

```yaml
services:
  tradoc:
    image: ghcr.io/lucas-lepajollec/tradoc:latest
    container_name: tradoc
    restart: unless-stopped
    ports:
      - "127.0.0.1:2507:8000"
    environment:
      ENV: production
      DATA_DIR: /app/data
      APP_SECRET: ${APP_SECRET:?Define APP_SECRET in .env}
      LLM_ENDPOINT: ${LLM_ENDPOINT}
      LLM_API_KEY: ${LLM_API_KEY}
      LLM_MODEL: ${LLM_MODEL}
    volumes:
      - ./data:/app/data
```

```bash
docker compose up -d
```

Open `http://127.0.0.1:2507`, or place the service behind an authenticated HTTPS reverse proxy for controlled network access.

## Providers and project isolation

TraDoc supports configurable local and remote provider profiles, including OpenAI-compatible endpoints such as LM Studio, Ollama, vLLM, and hosted APIs. Availability does not imply equal behavior or verified end-to-end quality across every provider.

Each translation job records its own model and configuration. Changing the active dashboard provider does not silently rewrite an existing project's model. Provider credentials are server-side secrets stored in the private persistent volume and must never be committed.

## Security and operations

> [!WARNING]
> Do not expose TraDoc or a local inference endpoint directly to the public internet. Use a strong `APP_SECRET`, HTTPS, an authenticated reverse proxy, and firewall rules appropriate to the deployment.

- Keep provider keys, source documents, translated outputs, and `tradoc.db` inside the protected data volume.
- Back up the complete data directory before upgrades.
- Never solve permission errors with `chmod 777`; align the host directory with the non-root container user instead.
- Keep `ALLOWED_ORIGINS` narrow when the frontend and API are served from different origins.
- Validate model concurrency against the provider. Configuring four TraDoc workers does not force an inference server to accept four concurrent requests.
- Treat translated output as editorial material requiring review, especially for legal, medical, technical, or publication-sensitive documents.

## Architecture

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS |
| API | FastAPI, Uvicorn, Python 3.11+ |
| Persistence | SQLite in WAL mode |
| Parsing | EbookLib, PyMuPDF, Beautiful Soup, lxml |
| Model access | Async HTTP client for local and remote providers |
| Deployment | Multi-stage Docker image |

```text
tradoc/
├── core/              # Parsers, chunking, checkpoints, glossary, and engine
├── api/               # FastAPI application and REST/SSE routes
├── web/               # React interface and public demo
├── cli.py             # Command-line interface
├── main.py            # Development and server entry point
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Public demo

The [public demo](https://demo.tradoc.lucas-homelab.fr) uses fictional projects and browser-only simulated actions. It connects to no AI server, stores no durable project, and sends no uploaded document to a backend. It is a product walkthrough, not evidence of provider availability or translation quality.

## Contributing and license

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening a pull request.

TraDoc is distributed under the [MIT License](LICENSE). Third-party libraries, model providers, and source documents retain their own licenses and terms.
