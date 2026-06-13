# TurboBatch — Design Spec

**Date:** 2026-06-12
**Status:** Approved

## Overview

TurboBatch is a single-user bulk AI media generator. Users create projects, paste a list of prompts (one per line), and TurboBatch generates images or videos for each prompt in parallel using AI providers. Outputs are saved to local disk and downloadable as a ZIP.

---

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Users | Single user, no auth | Personal tool for now |
| Queue | pg-boss (PostgreSQL-backed) | No Redis needed; retries and concurrency built-in |
| Storage | Local disk (`uploads/`) | Simple, free, easy to ZIP |
| Architecture | Next.js monorepo + worker process | One repo, one `npm run dev` |
| ORM | Prisma | Type-safe, great DX with PostgreSQL |
| UI | Next.js + TailwindCSS + ShadCN | Spec-specified |

---

## Providers

### Image — Runware

- Model: `openai:gpt-image@2`
- API: Runware REST API
- Aspect ratio mapped to pixel dimensions:
  - `1:1` → 1024×1024
  - `16:9` → 1536×864
  - `9:16` → 864×1536
- Output formats: PNG, JPG

### Image — Vertex AI (Gemini)

- Models: `gemini-3.1-flash-image-preview` (fast) or `gemini-3-pro-image-preview` (quality)
- API: `https://aiplatform.googleapis.com/v1/publishers/google/models/:model:streamGenerateContent`
- Auth: API key
- Aspect ratio: passed as `imageConfig.aspectRatio` ("1:1" | "16:9" | "9:16")
- Output format: PNG via `imageOutputOptions.mimeType`

### Video — Vertex AI Veo

- Model: `veo-3.1-lite-generate-001`
- SDK: `@google/genai` Node.js client
- Config: `aspect_ratio`, `duration_seconds` (default 8), `resolution` ("720p" | "1080p")
- Flow: `generate_videos()` → returns operation → poll until `operation.done` → download MP4
- `vertex_operation_id` saved to DB so polling resumes after server restart

---

## Architecture

```
bulk-media-generator/
├── app/
│   ├── (dashboard)/          # Next.js UI pages
│   │   ├── page.tsx          # Dashboard — project cards
│   │   ├── projects/new/     # Create project form
│   │   ├── projects/[id]/    # Project page — prompts + live queue
│   │   └── projects/[id]/results/  # Results grid + download
│   └── api/                  # Next.js API routes
├── worker/
│   ├── index.ts              # Starts pg-boss, registers handlers
│   ├── image-worker.ts       # Routes to Runware or Vertex Image
│   ├── video-worker.ts       # Vertex AI Veo, polls operation
│   └── providers/
│       ├── runware.ts
│       ├── vertex-image.ts
│       └── vertex-video.ts
├── lib/
│   ├── db.ts                 # Prisma client singleton
│   ├── queue.ts              # pg-boss singleton
│   ├── storage.ts            # File save / read / zip helpers
│   └── aspect-ratio.ts       # Aspect ratio → pixel dimensions map
├── prisma/
│   └── schema.prisma
└── uploads/
    ├── images/
    ├── videos/
    └── zips/
```

### Dev startup

```bash
npm run dev   # runs Next.js + worker/index.ts concurrently
```

### Request flow

1. User pastes prompts → `POST /api/projects/:id/generate`
2. API inserts one `Job` row per prompt, enqueues job IDs into pg-boss
3. Worker picks up jobs: 5 image workers + 2 video workers running in parallel
4. Worker calls provider → saves file to `uploads/` → updates job status in DB
5. Frontend polls `GET /api/projects/:id/status` every 2s → updates progress bar

---

## Database Schema (Prisma)

### Project

```prisma
model Project {
  id             String      @id @default(uuid())
  title          String
  description    String?
  mediaType      MediaType                        // IMAGE | VIDEO
  status         ProjectStatus @default(DRAFT)   // DRAFT | GENERATING | PAUSED | COMPLETED | CANCELLED
  settings       Json                            // provider-specific config (see below)
  totalJobs      Int         @default(0)
  completedJobs  Int         @default(0)
  failedJobs     Int         @default(0)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  jobs           Job[]
}
```

### Job

```prisma
model Job {
  id                  String    @id @default(uuid())
  projectId           String
  prompt              String
  status              JobStatus @default(PENDING)  // PENDING | GENERATING | COMPLETED | FAILED | CANCELLED
  progress            Int       @default(0)        // 0–100, used for video
  outputPath          String?                      // relative: uploads/images/:projectId/1.png
  errorMessage        String?
  retryCount          Int       @default(0)
  vertexOperationId   String?                      // video only — survives restarts
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  project             Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

### Project settings JSON shape

```jsonc
// Runware image project
{ "provider": "runware", "model": "openai:gpt-image@2", "aspectRatio": "16:9", "quality": "high", "format": "png" }

// Vertex image project
{ "provider": "vertex", "model": "gemini-3.1-flash-image-preview", "aspectRatio": "9:16", "format": "png" }

// Vertex video project
{ "provider": "vertex", "model": "veo-3.1-lite-generate-001", "aspectRatio": "16:9", "duration": 8, "resolution": "1080p" }
```

---

## API Routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project + jobs |
| DELETE | `/api/projects/:id` | Delete project + files |
| POST | `/api/projects/:id/generate` | Submit prompts, enqueue jobs |
| POST | `/api/projects/:id/pause` | Pause queue processing |
| POST | `/api/projects/:id/resume` | Resume queue |
| POST | `/api/projects/:id/cancel` | Cancel all pending jobs |
| POST | `/api/projects/:id/retry` | Retry all failed jobs |
| GET | `/api/projects/:id/status` | Live progress (polled every 2s) |
| GET | `/api/projects/:id/download` | Stream ZIP of all outputs |
| PATCH | `/api/jobs/:id` | Edit prompt on failed job |
| POST | `/api/jobs/:id/retry` | Retry single job |

---

## Worker Design

### pg-boss configuration

```ts
const boss = new PgBoss(DATABASE_URL)
await boss.start()
await boss.work('image-job', { teamSize: 5, retryLimit: 3 }, imageWorker)
await boss.work('video-job', { teamSize: 2, retryLimit: 3 }, videoWorker)
```

### Image worker routing

```
image-worker receives job
  → reads job.data.provider
  → "runware"  → providers/runware.ts   → Runware API
  → "vertex"   → providers/vertex-image.ts → Gemini image API
  → downloads/saves file → uploads/images/:projectId/:index.ext
  → UPDATE job: status=COMPLETED, outputPath
  → UPDATE project: completedJobs += 1
```

### Video worker

```
video-worker receives job
  → providers/vertex-video.ts
  → POST generate_videos() → get operation_id → save to job.vertexOperationId
  → poll every 30s until operation.done
  → download MP4 → uploads/videos/:projectId/:index.mp4
  → UPDATE job: status=COMPLETED, outputPath
  → UPDATE project: completedJobs += 1
```

On startup, worker scans for jobs with status `GENERATING` and a saved `vertexOperationId` — resumes polling those immediately.

---

## Frontend Pages

### `/` — Dashboard

- Grid of project cards
- Each card: title, media type, provider, aspect ratio badge, progress bar, `[Open]` `[Download]` `[Delete]`
- `[+ New Project]` button

### `/projects/new` — Create Project

Form fields:
- **Title** (required)
- **Media Type**: Image | Video
- **Provider**: Runware | Vertex
- **Aspect Ratio**: 1:1 | 16:9 | 9:16
- If Image: Format (PNG | JPG), Quality (Low | Medium | High)
- If Vertex Image: Model (Flash | Pro)
- If Video: Duration (seconds), Resolution (720p | 1080p)

### `/projects/[id]` — Project Page

- Prompts textarea (one per line)
- `[Generate]` button
- Live queue list: each job shows status icon, prompt, progress
- Progress bar: `Generating 24/100 ████████░░ 24%`
- Action buttons: `[Pause]` `[Resume]` `[Cancel]` `[Retry Failed]`
- Failed jobs: show error, `[Edit Prompt]` + `[Retry]`

### `/projects/[id]/results` — Results

- Image grid: thumbnails with filename
- Video list: filename + duration
- Failed list: prompt + error message
- `[Download ZIP]` button

---

## Aspect Ratio Helper

```ts
// lib/aspect-ratio.ts
export const RUNWARE_DIMENSIONS = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1536, height: 864  },
  '9:16': { width: 864,  height: 1536 },
}
```

Vertex providers accept the aspect ratio string directly — no mapping needed.

---

## Error Handling

- pg-boss retries failed jobs up to 3 times with exponential backoff
- Failed jobs store `errorMessage` in DB, surfaced per-job in the UI
- Video jobs: `vertexOperationId` persists — polling resumes after restart
- Runware errors: non-2xx response → mark job FAILED with error body
- Vertex errors: SDK exceptions caught → mark job FAILED with message

---

## File Storage

```
uploads/
├── images/
│   └── :projectId/
│       ├── 1.png
│       ├── 2.png
│       └── ...
├── videos/
│   └── :projectId/
│       ├── 1.mp4
│       └── ...
└── zips/
    └── :projectId.zip   (generated on demand, overwritten each time)
```

ZIP is built on demand when the user clicks Download — streams directly to the browser using `archiver`.

---

## Testing

- Unit tests for `providers/runware.ts`, `providers/vertex-image.ts`, `providers/vertex-video.ts` — mock HTTP responses
- Integration tests for API routes using a test PostgreSQL DB
- Manual E2E: create project → generate 5 images → verify files on disk → download ZIP
