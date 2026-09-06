# Security policy

TraDoc processes long documents and can communicate with external AI providers. Reports involving document disclosure, provider credentials, path traversal, unsafe file parsing, authorization bypass, or the dependency and container supply chain are especially important.

## Supported versions

Security fixes target the latest `0.1.x` release and `main`. Older pre-1.0 releases may require upgrading to receive a fix.

## Reporting a vulnerability

Use the repository's [private vulnerability reporting form](https://github.com/lucas-lepajollec/tradoc/security/advisories/new).

If private reporting is unavailable, open a minimal public issue asking for a private contact channel. Do not attach real documents, provider keys, prompts containing private data, exploit code, or other sensitive details to that issue.

Include the affected commit or image tag, deployment method, clear reproduction steps, the expected impact, and a sanitized proof of concept when possible. You should receive an acknowledgement within seven days and an initial assessment within fourteen days.

Configuration questions and ordinary translation failures should use the normal issue tracker after all documents, keys, logs, and private endpoints have been sanitized.

## Trust boundaries

- The application password is kept only in browser memory and is lost on reload. Provider credentials are sent to and stored by the server-side credential store; they are never intentionally written to browser storage.
- Uploaded documents, generated translations, checkpoints and backups are private application data. Protect the mounted data directory and every backup derived from it.
- Remote AI endpoints are validated before use, but operators remain responsible for choosing a provider they trust with document contents.
- The default deployment assumes one trusted operator or a trusted private network. Put any wider deployment behind HTTPS and authentication, and do not expose its data directory directly.
