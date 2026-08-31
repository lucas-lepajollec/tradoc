# TraDoc agent guide

This file is public repository guidance for maintainers and AI agents. Inspect the current branch, working tree, code, configuration and documentation before changing anything. Preserve unrelated work.

## Product boundaries

TraDoc is a self-hosted workflow for translating long documents while preserving structure, context, terminology and resumability. Documents, provider credentials, prompts, local endpoints and translation databases are sensitive. Do not claim provider or format quality without an end-to-end verification.

## Development

- Backend setup uses Python 3.11+ and `pip install -r requirements.txt` inside a virtual environment.
- Frontend setup uses `npm --prefix web ci`; run it with `npm --prefix web run dev`.
- Validate backend changes with `python -m unittest discover -s tests -v`.
- Validate frontend changes with `npm --prefix web run build`; use the demo build/check scripts for demo work.
- Validate Docker behavior when deployment, parsing, persistence or provider wiring changes.

## Repository expectations

- Update tests, `README.md`, focused docs, `COMMANDS.md` and `CHANGELOG.md` when the public workflow changes.
- Never commit real documents, databases, provider credentials, `.env` values, private endpoints or logs containing document content.
- Follow `CONTRIBUTING.md` for pull requests and `SECURITY.md` for vulnerabilities.
- GitHub is the public review surface; maintainers integrate the exact accepted result into authoritative Forgejo history.

Local machine notes belong in ignored `AGENTS.override.md` and `.project-local/`, never in this public file.
