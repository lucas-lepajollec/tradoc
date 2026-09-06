# Security policy

TraDoc processes long documents and can communicate with external AI providers. Reports involving document disclosure, provider credentials, path traversal, unsafe file parsing, authorization bypass, or the dependency and container supply chain are especially important.

## Supported versions

Security fixes target the latest `0.1.x` release and `main`. Older pre-1.0 releases may require upgrading to receive a fix.

## Reporting a vulnerability

Use the repository's [private vulnerability reporting form](https://github.com/lucas-lepajollec/tradoc/security/advisories/new).

If private reporting is unavailable, open a minimal public issue asking for a private contact channel. Do not attach real documents, provider keys, prompts containing private data, exploit code, or other sensitive details to that issue.

Include the affected commit or image tag, deployment method, clear reproduction steps, the expected impact, and a sanitized proof of concept when possible. You should receive an acknowledgement within seven days and an initial assessment within fourteen days.

Configuration questions and ordinary translation failures should use the normal issue tracker after all documents, keys, logs, and private endpoints have been sanitized.
