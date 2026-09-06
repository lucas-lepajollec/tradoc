# Changelog

Notable user-visible changes to TraDoc will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and published versions will follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/lucas-lepajollec/tradoc/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lucas-lepajollec/tradoc/releases/tag/v0.1.0
