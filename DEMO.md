# TraDoc public demo

The public demo is a dedicated static build of the real TraDoc frontend. It is
not connected to FastAPI, SQLite, an AI provider, or a credential store.

## Safety boundary

- all projects, segments, translations, models, and glossaries are fictional;
- API calls are replaced by an in-memory browser adapter;
- selected files are never sent; their browser `File` object is retained only
  in volatile memory so a demo export keeps the original container and extension;
- provider keys and the application token are disabled;
- simulated changes disappear on reload;
- the interface language selector supports the same maintained English, French, Spanish, and German locales as the self-hosted product;
- built-in Markdown and text previews are generated locally from fictional
  segments; imported PDF, EPUB, DOCX, Markdown, and TXT files are returned in
  their original format when no real translation exists;
- the demo is marked `noindex, nofollow, noarchive`.

## Local use

```bash
cd web
npm ci
npm run dev:demo
```

The demo is available at `http://127.0.0.1:2505` and does not require the
Python backend.

Use `npm run dev:demo:lan` only for testing from another device on a trusted
local network.

Build and preview the static artifact:

```bash
npm run build:demo
npm run preview:demo
```

## Hosting

Create the Vercel project with `web` as its Root Directory. The checked-in
`web/vercel.json` builds only the isolated demo mode and applies SPA routing,
security headers, and search-engine exclusion.

Publishing, assigning a domain, and linking the landing page remain separate
operations and require explicit validation of the deployed URL.
