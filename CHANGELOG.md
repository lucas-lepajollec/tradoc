# Changelog

Notable user-visible changes to TraDoc will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and published versions will follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Integration API for other apps (`/api/v1`): an app connected under Settings → Integrations sends a document, follows its progress and downloads the rebuilt translation with a `tdk_` bearer key; each connection only sees its own projects, which also appear in TraDoc tagged "via <app>". Keys are shown once and stored hashed; disconnecting revokes them. See `docs/integration-api.md`. Database changes are additive (new columns and table), so rolling back to 0.1.7 keeps working.

### Fixed

- Replace every native dropdown with a themed list that always opens inside the window (it no longer spills onto a second screen with long model names), truncates long entries, keeps provider groups and keyboard navigation, and draws no outline or box when clicked.

## [0.1.7] - 2026-10-23

No database or configuration migration is required. Provider keys and endpoints already stored on the server are reused as-is, and rolling back to the 0.1.6 image keeps working data intact. The interface now needs Safari 16.4+, Chrome 111+ or Firefox 128+.

### Added

- Use several providers at once: every model menu (top bar, dashboard, sandbox, project settings) lists the models of all connected providers, grouped by provider, and picking one switches to its provider with that provider's endpoint and limits. Settings marks connected providers. New `GET /api/settings/model-catalog` discovers models of every configured provider concurrently; an unreachable provider does not hide the others.
- Project settings can move a paused project to a model of another connected provider.
- Appearance setting (System, Light, Dark) under Settings › Interface & languages, stored per browser.

### Fixed

- Resume and retry from dashboard project cards keep the project's own provider, model and limits instead of the currently selected global ones; the Review screen no longer sends the global provider with the project's model.

### Changed

- Migrate the frontend to Tailwind CSS 4 through its Vite plugin, preserving existing theme tokens, small shadows/radii and focus behavior; remove the vulnerable Tailwind 3 build chain.
- Keep the source-map-js security patch and grouped maintenance policy. Modern browser support requires Safari 16.4+, Chrome 111+ or Firefox 128+.
- Redesign the whole interface: a centered top navigation (a menu button on phones) replaces the sidebar, the dashboard puts document import first, and every screen uses one self-hosted typeface (Inter), borderless surfaces without drop shadows, pill controls and switches. Light is the default and dark follows the system. Every existing action is kept.
- Rename navigation entries: Inspector & Tracking becomes Review, Test becomes Sandbox, and the settings tabs become Providers & models, Translation, Interface & languages and Profiles. Status labels are no longer uppercase.
- Update the Vite development server to 8.3.5 to clear its high-severity advisories (development tooling only).
- Stop loading Google Fonts from the page; the interface no longer contacts a third-party font host and pinch-zoom is allowed again on phones.
- Refresh README product screenshots from the isolated English public demo, with the intro dialog closed and additional views of the inspector, glossary, settings, and sandbox.

## [0.1.6] - 2026-09-08

### Removed

- Drop the forced Docker application token. TraDoc is a trusted-LAN self-hosted translator: the UI and API no longer require `APP_SECRET` or `X-App-Secret`. An older secret in `.env` or `data/.app_secret` is ignored and can be deleted.

## [0.1.5] - 2026-09-08

### Changed

- Make `.env` optional for Docker installs and generate a stable application secret inside persistent storage when operators do not provide one.
- Let Docker Compose derive the stack and container names, and remove the obsolete duplicate Compose example now that the default file pulls GHCR directly.

## [0.1.4] - 2026-09-08

### Changed

- Make the default Compose file directly reference the published GHCR image and load the required application secret plus model endpoint from the documented `.env` file.

## [0.1.3] - 2026-09-08

### Changed

- Use the established port `2507` both on the Docker host and inside the production container.
- Simplify the copy-ready Compose configuration while preserving persistent data, the required application secret and host access for a local model endpoint.

## [0.1.2] - 2026-09-08

### Changed

- Compose now pulls the published image and uses Docker's standard all-interface port mapping by default. Use `127.0.0.1:2507:8000` for localhost-only publication; source builds use the explicit build override.
- No database or document migration is required; operators recreating an existing container should review the new LAN-reachable port default and retain `APP_SECRET` plus the data volume.

## [0.1.1] - 2026-09-06

### Security

- Keep the application secret in browser memory instead of persisting it in local or session storage.
- Restrict persisted interface settings to explicit non-sensitive allowlists.
- Remove request-derived filesystem lookup from the single-page application fallback.
- Convert rich translation segments to readable text without reinterpreting document markup as browser HTML.

### Changed

- Extend protected validation to the complete Python and frontend dependency surfaces, demo contract and container health.

## [0.1.0] - 2026-09-06

### Added

- The first deliberately maintained TraDoc pre-1.0 release line.
- End-to-end EPUB, PDF, DOCX, Markdown and text translation with chunking, glossaries, checkpoints, resumable jobs and structured export.
- A consistent repository, quality, security, and release foundation.
- English, French, Spanish and German interfaces plus an isolated browser-only public demo.
- A recorded SQLite schema version, preservation tests for unversioned databases and fail-closed protection against unsafe downgrades.
- Multi-architecture container delivery with health checks, SBOM, provenance and immutable commit-SHA rollback tags.

### Changed

- Replaced the former tile-and-glow identity with TraDoc's standalone open-folio logo across the application and favicon.

Earlier development remains available in Git history; this changelog does not invent releases that were never deliberately published.

[Unreleased]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.7...HEAD
[0.1.7]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lucas-lepajollec/tradoc/releases/tag/v0.1.0
