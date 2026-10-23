# Integration API (v1)

Other self-hosted apps can use TraDoc as their translation engine: they send a document, TraDoc translates it with its own pipeline (segmentation, glossaries, checkpoints, reconstruction) and returns the rebuilt file. Every project created this way also appears in the TraDoc interface, tagged "via <app name>".

A typical client is a self-hosted library or reading app: a "Translate" action on a book sends its EPUB to TraDoc and imports the translated EPUB back, without exporting and re-importing by hand.

## Connect an app

1. In TraDoc, open **Settings → Integrations**.
2. Name the connection (for example `My library`) and choose its default model. Any connected provider works; see [Providers](https://docs.tradoc.lucas-homelab.fr/docs/configure/providers).
3. Select **Create the connection** and copy the key. It starts with `tdk_` and is shown only once; TraDoc stores only its SHA-256 hash.
4. In the other app, enter the **API address** shown on the same page (for example `http://tradoc.local:2507/api/v1`) and the key.

**Disconnect** revokes the key immediately. Projects the app created stay in TraDoc.

## Authentication and scope

Every request sends the key as a bearer token:

```http
Authorization: Bearer tdk_…
```

- A missing or revoked key returns `401` with `WWW-Authenticate: Bearer`.
- A connection only sees and controls the translations it created: anything else returns `404`.
- The TraDoc interface itself keeps working without a password, as described in the project's security notes. The key protects and identifies the integration surface only. Expose TraDoc beyond a trusted network only behind HTTPS and an authenticating reverse proxy.
- Call the API from the other app's **server**, not from a browser: keys must not reach a web page, and browser calls from another origin are refused unless that origin is listed in `ALLOWED_ORIGINS`.
- Uploads share the existing limits: 20 uploads per minute per client address and the configured maximum file size.

## Endpoints

All paths are relative to `/api/v1`. Responses are JSON unless stated otherwise.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/info` | Check the key; returns TraDoc version, API version, the connection and its default model. |
| `GET` | `/models` | Models of every connected provider, grouped by provider. |
| `POST` | `/translations` | Upload a document and (by default) start translating it. |
| `GET` | `/translations` | Translations created by this connection, newest first. |
| `GET` | `/translations/{id}` | Status and progress of one translation. |
| `GET` | `/translations/{id}/result` | The rebuilt translated file. |
| `POST` | `/translations/{id}/pause` | Pause a running translation. |
| `POST` | `/translations/{id}/resume` | Resume a paused or failed translation. |
| `DELETE` | `/translations/{id}` | Delete the translation and its files. |

### `POST /translations`

`multipart/form-data` fields:

| Field | Required | Default | Notes |
| --- | --- | --- | --- |
| `file` | yes | | EPUB, PDF, DOCX, Markdown or plain text. |
| `source_lang` | no | `en` | Language code. |
| `target_lang` | no | `fr` | Language code. |
| `provider` | no | connection default | Provider id, for example `ollama`, `lm-studio`, `deepseek`, `openai`. |
| `model` | no | connection default | Required when the connection has no default model for the chosen provider (`422` otherwise). |
| `glossary` | no | none | Name of a TraDoc glossary. |
| `external_ref` | no | none | Your own identifier (200 characters max), returned on every response; for example your book id. |
| `start` | no | `true` | `false` only prepares the project. |

Local providers (LM Studio, Ollama) run with 1 parallel request and 1,000-token segments, remote providers with 4 requests and 6,000-token segments, at temperature 0.15. The project can be tuned afterwards in TraDoc.

Returns `202` with a translation:

```json
{
  "id": "3f9c2a71b0de",
  "status": "running",
  "progress": { "completed": 0, "total": 184, "percent": 0 },
  "file_name": "the-time-machine.epub",
  "source_lang": "en",
  "target_lang": "fr",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "external_ref": "book-42",
  "created_at": "2026-10-23T18:20:11",
  "completed_at": null
}
```

`status` is one of `pending`, `running`, `paused`, `completed`, `failed`.

### `GET /translations/{id}/result`

Returns the rebuilt document in its original format (`Content-Disposition` carries the file name, `X-TraDoc-Export` is `final` or `partial`).

- Before completion it returns `409`. Add `?partial=true` to get a preview built from the segments already translated.

## Example

```bash
TRADOC=http://tradoc.local:2507/api/v1
KEY=tdk_…   # from Settings → Integrations

curl -s -H "Authorization: Bearer $KEY" "$TRADOC/info"

ID=$(curl -s -H "Authorization: Bearer $KEY" \
  -F file=@the-time-machine.epub -F source_lang=en -F target_lang=fr \
  -F external_ref=book-42 "$TRADOC/translations" | jq -r .id)

# Poll every 15–30 seconds until "completed" (or "failed").
curl -s -H "Authorization: Bearer $KEY" "$TRADOC/translations/$ID" | jq '.status, .progress'

curl -s -H "Authorization: Bearer $KEY" -o the-time-machine.fr.epub "$TRADOC/translations/$ID/result"
```

## Client guidance

- Poll status rather than holding a request open; a long book can take hours on a local model. A paused or failed translation can be resumed, and TraDoc keeps every completed segment.
- Keep `external_ref` and the TraDoc `id` together on your side so a restart can pick up existing translations from `GET /translations` instead of uploading again.
- Treat TraDoc being unreachable as a retryable state; never discard the user's request.
- The API is versioned in the path. Additive fields may appear in v1 responses; breaking changes will use `/api/v2`.
