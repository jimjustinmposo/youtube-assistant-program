# Project State

## Project Purpose

A local, desktop-style web application that prepares finished videos for YouTube.
The user edits a video in CapCut, exports an MP4 and a custom thumbnail, then uses
this app to store them locally and prepare them for publishing. In later phases the
app will analyse the video, generate grounded titles/hooks/description/hashtags/tags/
chapters, and publish through Composio **only after explicit user approval**.

## Current Phase

`Phase 1 — Local Foundation + Upload`

## Architecture

Runs entirely on the user's Windows PC. No cloud deployment, no remote database.

```
LOCAL PC
├── Frontend  — React 19 + Vite 7 + TypeScript + Tailwind v4   (dev: http://127.0.0.1:3000)
├── Backend   — Node.js + Express 5 + TypeScript                (dev: http://127.0.0.1:4000)
├── Database  — SQLite via the built-in node:sqlite driver     (no native module build)
├── Storage   — local filesystem under data/
└── Future    — Composio (external service) for YouTube only
```

- **Frontend** `client/` — React SPA. Talks to the backend only through the local
  `/api` path; in development Vite proxies `/api` to port 4000, and in a production
  build the same Node process serves the built SPA (single port, no extra web server).
- **Backend** `server/` — Express 5. Layered: `routes` → `services` → `db` / `storage`.
  Uploads stream to disk via multer; nothing is buffered in memory or stored in SQLite.
- **SQLite** — opened with Node's built-in `node:sqlite` (`DatabaseSync`), so no
  `better-sqlite3` native compilation is required on Windows. Forward-only migrations
  recorded in `schema_migrations`.
- **Local filesystem** — `data/projects/<project-id>/{video.mp4, thumbnail.<ext>, metadata.json}`.
  The database stores only a relative storage key, never media bytes.
- **Composio (future)** — `server/src/services/composio/`. `ComposioClient` reads the
  API key from the server-side environment; `ComposioYouTubeService` is the only place
  that will ever call Composio. React never calls Composio directly. **No Composio SDK
  dependency, no OAuth flow and no upload capability exist in Phase 1.**
- **AI (future)** — `server/src/services/ai/AIProvider.ts` defines the provider interface
  (`analyzeVideo`, `generateTitles`, `generateHooks`, `generateDescription`,
  `generateHashtags`, `generateTags`, `generateChapters`) so the provider is replaceable.
  No provider is configured or invoked in Phase 1.

## Database

Table `projects` (migration `001_create_projects`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID generated server-side |
| `original_filename` | TEXT | display name of the uploaded video |
| `video_path` / `video_filename` / `video_size_bytes` / `video_mime_type` / `video_uploaded_at` | TEXT/INTEGER | NULL until a video is uploaded |
| `thumbnail_path` / `thumbnail_filename` / `thumbnail_size_bytes` / `thumbnail_mime_type` / `thumbnail_uploaded_at` | TEXT/INTEGER | NULL until a thumbnail is uploaded |
| `status` | TEXT | `draft` \| `uploading` \| `ready` \| `failed` (CHECK constraint) |
| `last_error` | TEXT | last failure reason |
| `created_at` / `updated_at` | TEXT | ISO 8601 |

Status becomes `ready` only when both a video and a thumbnail are stored.

## API

All endpoints are local and bound to loopback.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Status, phase, storage dir, real upload limits, capability flags |
| `POST` | `/api/projects` | Create a project (`draft`) |
| `GET` | `/api/projects` | List projects, newest first (`?limit=&offset=`) |
| `GET` | `/api/projects/:id` | Fetch one project |
| `DELETE` | `/api/projects/:id` | Delete the record and its local folder |
| `POST` | `/api/projects/:id/video` | Upload/replace the MP4 (multipart field `file`) |
| `POST` | `/api/projects/:id/thumbnail` | Upload/replace the thumbnail (multipart field `file`) |
| `GET` | `/api/projects/:id/video` | Stream the stored video (supports HTTP range) |
| `GET` | `/api/projects/:id/thumbnail` | Stream the stored thumbnail |

Errors are JSON: `{ "error": { "code": "...", "message": "...", "details": ... } }`.

## Environment Variables

Defined in `.env` (gitignored). `.env.example` documents every name.

- `PORT` — backend port (default `4000`)
- `HOST` — backend bind address (default `127.0.0.1`, loopback only)
- `NODE_ENV`
- `DATA_DIR` — local storage + database root (default `./data`)
- `MAX_VIDEO_SIZE_MB` — video upload limit (default `4096`)
- `MAX_THUMBNAIL_SIZE_MB` — thumbnail upload limit (default `10`)
- `VITE_PORT` — Vite dev server port (default `3000`)
- `VITE_API_PROXY_TARGET` — dev proxy target for `/api`
- `COMPOSIO_API_KEY` — server-side only, **unused in Phase 1**
- `COMPOSIO_YOUTUBE_CONNECTED_ACCOUNT_ID` — reserved for Phase 5

No secret values are stored in source, and no secret is exposed to the browser.

## Completed Features

- Local monorepo foundation (npm workspaces) with `dev`, `build`, `start`, `test`, `typecheck`.
- React/Vite/Tailwind SPA: Dashboard, New Video, Projects, Project detail, YouTube (placeholder), Settings.
- MP4 upload with drag & drop and file picker, live preview, progress bar, remove and replace.
- Thumbnail upload (JPG/JPEG/PNG/WebP) with preview, progress, remove and replace.
- Four-layer server validation: extension, MIME type, size limit and **real file signature**
  (magic bytes), including a QuickTime-vs-MP4 brand check.
- Client-side pre-validation for fast feedback; the backend re-validates everything.
- Project creation, local folder per project, `metadata.json` mirror, project history, deletion.
- Status handling: `draft` → `ready`, with `uploading` and `failed` states defined.
- Range-request video streaming so the local preview can seek.
- Structured error handling, loading states, empty states and a visible backend-offline indicator.
- Per-project upload serialisation so rapid duplicate submissions stay consistent.
- Temp-file hygiene: partial uploads are swept, and the temp dir is cleared on start.

## Known Issues

- The client bundle is a single ~552 kB chunk (155 kB gzipped) with no code splitting. Acceptable for a
  local app; manual chunking is deferred to Phase 8.
- The Dashboard "On this page" counter shows the loaded page size, not a distinct metric.
- Project search, filtering and publishing history are intentionally deferred to Phase 8.

## Testing

- `npm test` — 51 automated tests (51 pass, 0 fail): signature detection, filename
  sanitisation, upload validation, storage behaviour and the full HTTP API.
- `node scripts/e2e-check.mjs` — 24 end-to-end checks against the built server + built SPA.
- `node scripts/dev-check.mjs` — 9 checks of the dev server and its `/api` proxy.
- `npm run typecheck` — clean for both workspaces.

## Next Phase

`Phase 2 — Video Analysis`
