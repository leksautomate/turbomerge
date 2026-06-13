# TurboBatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build TurboBatch, a single-user bulk AI media generator that creates images and videos in parallel from text prompts, organized into projects.

**Architecture:** Next.js 15 monorepo with App Router handles the UI and API routes. A separate long-running worker process uses pg-boss (backed by PostgreSQL) to process image and video generation jobs concurrently. Three providers: Runware REST API for images, Vertex AI Gemini API for images, Vertex AI Veo SDK for videos. All outputs saved to local disk under `uploads/`, downloadable as a ZIP.

**Tech Stack:** Next.js 15, TypeScript, Prisma 5 + PostgreSQL, pg-boss 10, @google/genai, TailwindCSS 3, ShadCN UI, archiver, uuid, Vitest, concurrently

---

## File Map

```
.                                        ← project root (Next.js monorepo)
├── .env.example
├── .env.local                           ← gitignored, real secrets
├── next.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── prisma/
│   └── schema.prisma
├── lib/
│   ├── types.ts                         ← shared TypeScript types
│   ├── aspect-ratio.ts                  ← AspectRatio type + RUNWARE_DIMENSIONS map
│   ├── db.ts                            ← Prisma client singleton
│   ├── queue.ts                         ← pg-boss singleton
│   └── storage.ts                       ← file save / ZIP helpers
├── worker/
│   ├── index.ts                         ← starts pg-boss, registers handlers
│   ├── image-worker.ts                  ← routes to runware or vertex-image provider
│   ├── video-worker.ts                  ← calls vertex-video, polls operation
│   └── providers/
│       ├── runware.ts                   ← Runware REST API (openai:gpt-image@2)
│       ├── vertex-image.ts             ← Vertex AI Gemini image API
│       └── vertex-video.ts             ← Vertex AI Veo via @google/genai SDK
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         ← dashboard
│   ├── globals.css
│   ├── projects/
│   │   ├── new/page.tsx                 ← create project form
│   │   └── [id]/
│   │       ├── page.tsx                 ← project page: prompts + live queue
│   │       └── results/page.tsx         ← results grid + download
│   └── api/
│       ├── projects/
│       │   ├── route.ts                 ← GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts             ← GET one, DELETE
│       │       ├── generate/route.ts    ← POST: submit prompts → enqueue
│       │       ├── pause/route.ts
│       │       ├── resume/route.ts
│       │       ├── cancel/route.ts
│       │       ├── retry/route.ts
│       │       ├── status/route.ts      ← GET: polled every 2s
│       │       └── download/route.ts    ← GET: stream ZIP
│       └── jobs/[id]/
│           ├── route.ts                 ← PATCH: edit prompt
│           └── retry/route.ts           ← POST: retry single job
├── components/
│   ├── project-card.tsx
│   ├── progress-bar.tsx
│   ├── job-list.tsx
│   └── create-project-form.tsx
└── uploads/                             ← gitignored
    ├── images/:projectId/:order.ext
    ├── videos/:projectId/:order.mp4
    └── zips/:projectId.zip
```

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app in the current directory**

```bash
cd "C:\Users\leksi\Desktop\projects\New folder"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-import-alias
```

When prompted: yes to App Router, no to Turbopack, yes to TypeScript.

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client pg-boss @google/genai archiver uuid
npm install --save-dev prisma vitest @vitest/coverage-v8 vite-tsconfig-paths @types/archiver @types/uuid @types/node concurrently
```

- [ ] **Step 3: Install ShadCN UI**

```bash
npx shadcn@latest init
```

When prompted: default style, default base color (Slate), yes to CSS variables.

Then add the components used in this project:

```bash
npx shadcn@latest add button input label textarea card badge progress select
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
```

- [ ] **Step 5: Create `.env.example`**

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/turbobatch
RUNWARE_API_KEY=your_runware_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_PROJECT_ID=your_gcp_project_id
GOOGLE_LOCATION=us-central1
```

- [ ] **Step 6: Create `.env.local`** (real values, stays gitignored)

Copy `.env.example` to `.env.local` and fill in real values.

- [ ] **Step 7: Update `.gitignore`**

Add to the end of `.gitignore`:

```
uploads/
.env.local
```

- [ ] **Step 8: Add scripts to `package.json`**

Replace the `"scripts"` section:

```json
"scripts": {
  "dev": "concurrently \"next dev\" \"npx ts-node --esm worker/index.ts\"",
  "dev:next": "next dev",
  "dev:worker": "npx tsx worker/index.ts",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:push": "prisma db push",
  "db:migrate": "prisma migrate dev",
  "db:studio": "prisma studio"
}
```

- [ ] **Step 9: Update `package.json` to add tsx**

```bash
npm install --save-dev tsx
```

- [ ] **Step 10: Commit**

```bash
git init
git add package.json tsconfig.json next.config.ts vitest.config.ts .env.example .gitignore
git commit -m "feat: scaffold TurboBatch Next.js project"
```

---

## Task 2: Prisma schema + database

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MediaType {
  IMAGE
  VIDEO
}

enum Provider {
  RUNWARE
  VERTEX
}

enum ProjectStatus {
  DRAFT
  GENERATING
  PAUSED
  COMPLETED
  CANCELLED
}

enum JobStatus {
  PENDING
  GENERATING
  COMPLETED
  FAILED
  CANCELLED
}

model Project {
  id            String        @id @default(uuid())
  title         String
  description   String?
  mediaType     MediaType
  status        ProjectStatus @default(DRAFT)
  settings      Json
  totalJobs     Int           @default(0)
  completedJobs Int           @default(0)
  failedJobs    Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  jobs          Job[]
}

model Job {
  id                 String    @id @default(uuid())
  projectId          String
  prompt             String
  order              Int
  status             JobStatus @default(PENDING)
  progress           Int       @default(0)
  outputPath         String?
  errorMessage       String?
  retryCount         Int       @default(0)
  vertexOperationId  String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  project            Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, order])
}
```

- [ ] **Step 3: Create the database and run migration**

Make sure PostgreSQL is running and the `DATABASE_URL` in `.env.local` points to it, then:

```bash
npx prisma migrate dev --name init
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 4: Verify schema in Prisma Studio**

```bash
npx prisma studio
```

Open browser → confirm `Project` and `Job` tables exist with correct columns. Then `Ctrl+C` to stop.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema for Project and Job"
```

---

## Task 3: Shared types and aspect-ratio helper

**Files:**
- Create: `lib/types.ts`
- Create: `lib/aspect-ratio.ts`
- Create: `lib/aspect-ratio.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/aspect-ratio.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { RUNWARE_DIMENSIONS, ASPECT_RATIOS } from './aspect-ratio'

describe('RUNWARE_DIMENSIONS', () => {
  it('returns 1024x1024 for 1:1', () => {
    expect(RUNWARE_DIMENSIONS['1:1']).toEqual({ width: 1024, height: 1024 })
  })

  it('returns 1536x864 for 16:9', () => {
    expect(RUNWARE_DIMENSIONS['16:9']).toEqual({ width: 1536, height: 864 })
  })

  it('returns 864x1536 for 9:16', () => {
    expect(RUNWARE_DIMENSIONS['9:16']).toEqual({ width: 864, height: 1536 })
  })

  it('covers all aspect ratios', () => {
    for (const ratio of ASPECT_RATIOS) {
      expect(RUNWARE_DIMENSIONS[ratio]).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- lib/aspect-ratio.test.ts
```

Expected: FAIL — `Cannot find module './aspect-ratio'`

- [ ] **Step 3: Create `lib/types.ts`**

```typescript
export type AspectRatio = '1:1' | '16:9' | '9:16'

export type ImageSettings = {
  provider: 'runware' | 'vertex'
  model: string
  aspectRatio: AspectRatio
  quality: 'low' | 'medium' | 'high'
  format: 'png' | 'jpg'
}

export type VideoSettings = {
  provider: 'vertex'
  model: string
  aspectRatio: AspectRatio
  duration: number
  resolution: '720p' | '1080p'
}

export type ProjectSettings = ImageSettings | VideoSettings
```

- [ ] **Step 4: Create `lib/aspect-ratio.ts`**

```typescript
import type { AspectRatio } from './types'

export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16']

export const RUNWARE_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1':  { width: 1024, height: 1024 },
  '16:9': { width: 1536, height: 864  },
  '9:16': { width: 864,  height: 1536 },
}
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test -- lib/aspect-ratio.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/aspect-ratio.ts lib/aspect-ratio.test.ts
git commit -m "feat: add shared types and aspect-ratio helper"
```

---

## Task 4: Database client and queue singleton

**Files:**
- Create: `lib/db.ts`
- Create: `lib/queue.ts`

- [ ] **Step 1: Create `lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- [ ] **Step 2: Create `lib/queue.ts`**

```typescript
import PgBoss from 'pg-boss'

let boss: PgBoss | null = null

export function getQueue(): PgBoss {
  if (!boss) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    boss = new PgBoss({ connectionString: url, max: 10 })
  }
  return boss
}

export const IMAGE_JOB_QUEUE = 'image-job'
export const VIDEO_JOB_QUEUE = 'video-job'

export type JobPayload = {
  jobId: string
  projectId: string
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/db.ts lib/queue.ts
git commit -m "feat: add Prisma and pg-boss singletons"
```

---

## Task 5: Storage helpers

**Files:**
- Create: `lib/storage.ts`
- Create: `lib/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { saveFile, getProjectDir, resolveOutputPath } from './storage'

describe('saveFile', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'turbobatch-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true })
  })

  it('saves a buffer to disk and returns relative path', async () => {
    const buf = Buffer.from('hello')
    const filePath = await saveFile(buf, tmpDir, 'test.png')
    const full = path.join(tmpDir, 'test.png')
    const content = await fs.readFile(full)
    expect(content.equals(buf)).toBe(true)
    expect(filePath).toBe(path.join(tmpDir, 'test.png'))
  })

  it('creates the directory if it does not exist', async () => {
    const buf = Buffer.from('hi')
    const nested = path.join(tmpDir, 'a', 'b', 'c')
    await saveFile(buf, nested, 'out.jpg')
    const content = await fs.readFile(path.join(nested, 'out.jpg'))
    expect(content.equals(buf)).toBe(true)
  })
})

describe('resolveOutputPath', () => {
  it('builds image path from projectId and order', () => {
    const p = resolveOutputPath('images', 'proj-1', 3, 'png')
    expect(p).toBe(path.join('uploads', 'images', 'proj-1', '3.png'))
  })

  it('builds video path from projectId and order', () => {
    const p = resolveOutputPath('videos', 'proj-2', 1, 'mp4')
    expect(p).toBe(path.join('uploads', 'videos', 'proj-2', '1.mp4'))
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- lib/storage.test.ts
```

Expected: FAIL — `Cannot find module './storage'`

- [ ] **Step 3: Create `lib/storage.ts`**

```typescript
import { promises as fs } from 'fs'
import path from 'path'
import archiver from 'archiver'
import { createWriteStream } from 'fs'

export function resolveOutputPath(
  type: 'images' | 'videos',
  projectId: string,
  order: number,
  ext: string
): string {
  return path.join('uploads', type, projectId, `${order}.${ext}`)
}

export function getProjectDir(type: 'images' | 'videos', projectId: string): string {
  return path.join(process.cwd(), 'uploads', type, projectId)
}

export async function saveFile(
  buffer: Buffer,
  dir: string,
  filename: string
): Promise<string> {
  await fs.mkdir(dir, { recursive: true })
  const fullPath = path.join(dir, filename)
  await fs.writeFile(fullPath, buffer)
  return fullPath
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  const imagePath = path.join(process.cwd(), 'uploads', 'images', projectId)
  const videoPath = path.join(process.cwd(), 'uploads', 'videos', projectId)
  const zipPath = path.join(process.cwd(), 'uploads', 'zips', `${projectId}.zip`)

  await Promise.allSettled([
    fs.rm(imagePath, { recursive: true }),
    fs.rm(videoPath, { recursive: true }),
    fs.rm(zipPath),
  ])
}

export async function buildProjectZip(
  projectId: string,
  mediaType: 'IMAGE' | 'VIDEO'
): Promise<string> {
  const zipDir = path.join(process.cwd(), 'uploads', 'zips')
  await fs.mkdir(zipDir, { recursive: true })

  const zipPath = path.join(zipDir, `${projectId}.zip`)
  const type = mediaType === 'IMAGE' ? 'images' : 'videos'
  const sourceDir = path.join(process.cwd(), 'uploads', type, projectId)

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })

  return zipPath
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- lib/storage.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: add storage helpers for file save and ZIP"
```

---

## Task 6: Runware provider

**Files:**
- Create: `worker/providers/runware.ts`
- Create: `worker/providers/runware.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/providers/runware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateRunwareImage } from './runware'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('generateRunwareImage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.RUNWARE_API_KEY = 'test-key'
  })

  it('calls Runware API with correct payload and returns image buffer', async () => {
    const fakeBase64 = Buffer.from('fake image').toString('base64')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ imageBase64Data: fakeBase64 }],
    })

    const result = await generateRunwareImage({
      prompt: 'A dragon',
      aspectRatio: '16:9',
      quality: 'high',
      format: 'png',
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.runware.ai/v1')
    const body = JSON.parse(init.body as string)
    expect(body[0].model).toBe('openai:gpt-image@2')
    expect(body[0].width).toBe(1536)
    expect(body[0].height).toBe(864)
    expect(body[0].outputFormat).toBe('PNG')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.toString()).toBe('fake image')
  })

  it('throws on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })

    await expect(
      generateRunwareImage({ prompt: 'x', aspectRatio: '1:1', quality: 'low', format: 'jpg' })
    ).rejects.toThrow('Runware API error: 401')
  })

  it('throws when RUNWARE_API_KEY is missing', async () => {
    delete process.env.RUNWARE_API_KEY

    await expect(
      generateRunwareImage({ prompt: 'x', aspectRatio: '1:1', quality: 'low', format: 'jpg' })
    ).rejects.toThrow('RUNWARE_API_KEY not set')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- worker/providers/runware.test.ts
```

Expected: FAIL — `Cannot find module './runware'`

- [ ] **Step 3: Create `worker/providers/runware.ts`**

```typescript
import { v4 as uuidv4 } from 'uuid'
import { RUNWARE_DIMENSIONS } from '../../lib/aspect-ratio'
import type { AspectRatio } from '../../lib/types'

export type RunwareImageInput = {
  prompt: string
  aspectRatio: AspectRatio
  quality: 'low' | 'medium' | 'high'
  format: 'png' | 'jpg'
}

export async function generateRunwareImage(input: RunwareImageInput): Promise<Buffer> {
  const apiKey = process.env.RUNWARE_API_KEY
  if (!apiKey) throw new Error('RUNWARE_API_KEY not set')

  const { width, height } = RUNWARE_DIMENSIONS[input.aspectRatio]
  const outputFormat = input.format.toUpperCase() as 'PNG' | 'JPG'

  const response = await fetch('https://api.runware.ai/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify([
      {
        taskType: 'imageInference',
        taskUUID: uuidv4(),
        model: 'openai:gpt-image@2',
        positivePrompt: input.prompt,
        width,
        height,
        outputFormat,
        outputType: 'base64Data',
        providerSettings: {
          openai: { quality: input.quality, moderation: 'auto' },
        },
      },
    ]),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Runware API error: ${response.status} ${text}`)
  }

  const data = await response.json()
  const result = Array.isArray(data) ? data[0] : data?.data?.[0]
  if (!result?.imageBase64Data) throw new Error('No image data in Runware response')

  return Buffer.from(result.imageBase64Data, 'base64')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- worker/providers/runware.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add worker/providers/runware.ts worker/providers/runware.test.ts
git commit -m "feat: add Runware image provider"
```

---

## Task 7: Vertex image provider

**Files:**
- Create: `worker/providers/vertex-image.ts`
- Create: `worker/providers/vertex-image.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/providers/vertex-image.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateVertexImage } from './vertex-image'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('generateVertexImage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.GOOGLE_API_KEY = 'test-gkey'
  })

  it('calls Gemini API with correct payload and returns image buffer', async () => {
    const fakeBase64 = Buffer.from('vertex image').toString('base64')
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ inlineData: { mimeType: 'image/png', data: fakeBase64 } }],
            },
          },
        ],
      }),
    })

    const result = await generateVertexImage({
      prompt: 'A samurai',
      model: 'gemini-3.1-flash-image-preview',
      aspectRatio: '9:16',
      format: 'png',
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('gemini-3.1-flash-image-preview:generateContent')
    expect(url).toContain('test-gkey')
    const body = JSON.parse(init.body as string)
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('9:16')
    expect(result).toBeInstanceOf(Buffer)
    expect(result.toString()).toBe('vertex image')
  })

  it('throws on non-2xx response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad request' })

    await expect(
      generateVertexImage({ prompt: 'x', model: 'gemini-3.1-flash-image-preview', aspectRatio: '1:1', format: 'png' })
    ).rejects.toThrow('Vertex image API error: 400')
  })

  it('throws when GOOGLE_API_KEY is missing', async () => {
    delete process.env.GOOGLE_API_KEY

    await expect(
      generateVertexImage({ prompt: 'x', model: 'gemini-3.1-flash-image-preview', aspectRatio: '1:1', format: 'png' })
    ).rejects.toThrow('GOOGLE_API_KEY not set')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- worker/providers/vertex-image.test.ts
```

Expected: FAIL — `Cannot find module './vertex-image'`

- [ ] **Step 3: Create `worker/providers/vertex-image.ts`**

```typescript
import type { AspectRatio } from '../../lib/types'

export type VertexImageInput = {
  prompt: string
  model: string
  aspectRatio: AspectRatio
  format: 'png' | 'jpg'
}

export async function generateVertexImage(input: VertexImageInput): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY not set')

  const mimeType = input.format === 'png' ? 'image/png' : 'image/jpeg'
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${input.model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: {
          aspectRatio: input.aspectRatio,
          imageOutputOptions: { mimeType },
          personGeneration: 'ALLOW_ALL',
        },
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Vertex image API error: ${response.status} ${text}`)
  }

  const data = await response.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imageData = parts.find((p: { inlineData?: { data: string } }) => p.inlineData)?.inlineData?.data

  if (!imageData) throw new Error('No image data in Vertex response')

  return Buffer.from(imageData, 'base64')
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- worker/providers/vertex-image.test.ts
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add worker/providers/vertex-image.ts worker/providers/vertex-image.test.ts
git commit -m "feat: add Vertex AI Gemini image provider"
```

---

## Task 8: Vertex video provider

**Files:**
- Create: `worker/providers/vertex-video.ts`
- Create: `worker/providers/vertex-video.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/providers/vertex-video.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startVideoGeneration, pollVideoOperation } from './vertex-video'

const mockGenerateVideos = vi.fn()
const mockOperationsGet = vi.fn()
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateVideos: mockGenerateVideos },
    operations: { get: mockOperationsGet },
  })),
}))

describe('startVideoGeneration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.GOOGLE_PROJECT_ID = 'test-project'
    process.env.GOOGLE_LOCATION = 'us-central1'
  })

  it('returns operation name from generateVideos call', async () => {
    mockGenerateVideos.mockResolvedValueOnce({ name: 'operations/abc-123' })

    const name = await startVideoGeneration({
      prompt: 'A dragon',
      model: 'veo-3.1-lite-generate-001',
      aspectRatio: '16:9',
      duration: 8,
      resolution: '1080p',
    })

    expect(name).toBe('operations/abc-123')
    expect(mockGenerateVideos).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'veo-3.1-lite-generate-001',
        prompt: 'A dragon',
      })
    )
  })
})

describe('pollVideoOperation', () => {
  it('returns done:false when operation not complete', async () => {
    mockOperationsGet.mockResolvedValueOnce({ done: false })

    const result = await pollVideoOperation('operations/abc')
    expect(result).toEqual({ done: false })
  })

  it('downloads and returns video buffer when done', async () => {
    const fakeVideoBytes = Buffer.from('video data')
    mockOperationsGet.mockResolvedValueOnce({
      done: true,
      response: { generatedVideos: [{ video: { uri: 'https://storage.example.com/video.mp4' } }] },
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => fakeVideoBytes.buffer,
    })

    const result = await pollVideoOperation('operations/abc')
    expect(result.done).toBe(true)
    expect(result.videoBuffer).toBeInstanceOf(Buffer)
  })

  it('throws when done operation has no video', async () => {
    mockOperationsGet.mockResolvedValueOnce({ done: true, response: { generatedVideos: [] } })

    await expect(pollVideoOperation('operations/abc')).rejects.toThrow('No video in completed operation')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- worker/providers/vertex-video.test.ts
```

Expected: FAIL — `Cannot find module './vertex-video'`

- [ ] **Step 3: Create `worker/providers/vertex-video.ts`**

```typescript
import { GoogleGenAI } from '@google/genai'
import type { AspectRatio } from '../../lib/types'

export type VertexVideoInput = {
  prompt: string
  model: string
  aspectRatio: AspectRatio
  duration: number
  resolution: '720p' | '1080p'
}

function createClient() {
  const project = process.env.GOOGLE_PROJECT_ID
  if (!project) throw new Error('GOOGLE_PROJECT_ID not set')
  return new GoogleGenAI({
    project,
    location: process.env.GOOGLE_LOCATION ?? 'us-central1',
  })
}

export async function startVideoGeneration(input: VertexVideoInput): Promise<string> {
  const client = createClient()
  const operation = await client.models.generateVideos({
    model: input.model,
    prompt: input.prompt,
    config: {
      aspectRatio: input.aspectRatio,
      durationSeconds: input.duration,
      resolution: input.resolution,
      personGeneration: 'allow_all',
      generateAudio: false,
    },
  })
  return operation.name as string
}

export async function pollVideoOperation(
  operationName: string
): Promise<{ done: boolean; videoBuffer?: Buffer }> {
  const client = createClient()
  const operation = await client.operations.get({ name: operationName })

  if (!operation.done) return { done: false }

  const video = (operation as any).response?.generatedVideos?.[0]?.video
  if (!video) throw new Error('No video in completed operation')

  const res = await fetch(video.uri)
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`)

  const arrayBuffer = await res.arrayBuffer()
  return { done: true, videoBuffer: Buffer.from(arrayBuffer) }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- worker/providers/vertex-video.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add worker/providers/vertex-video.ts worker/providers/vertex-video.test.ts
git commit -m "feat: add Vertex AI Veo video provider"
```

---

## Task 9: Image worker

**Files:**
- Create: `worker/image-worker.ts`
- Create: `worker/image-worker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/image-worker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processImageJob } from './image-worker'

vi.mock('../lib/db', () => ({
  db: {
    job: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    project: {
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}))

vi.mock('./providers/runware', () => ({ generateRunwareImage: vi.fn() }))
vi.mock('./providers/vertex-image', () => ({ generateVertexImage: vi.fn() }))
vi.mock('../lib/storage', () => ({
  saveFile: vi.fn(),
  getProjectDir: vi.fn(() => '/tmp/uploads/images/proj-1'),
  resolveOutputPath: vi.fn(() => 'uploads/images/proj-1/1.png'),
}))

import { db } from '../lib/db'
import { generateRunwareImage } from './providers/runware'
import { generateVertexImage } from './providers/vertex-image'

describe('processImageJob', () => {
  const mockJob = {
    id: 'job-1',
    projectId: 'proj-1',
    prompt: 'A dragon',
    order: 1,
    project: {
      id: 'proj-1',
      status: 'GENERATING',
      mediaType: 'IMAGE',
      settings: { provider: 'runware', model: 'openai:gpt-image@2', aspectRatio: '16:9', quality: 'high', format: 'png' },
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    ;(db.job.findUniqueOrThrow as any).mockResolvedValue(mockJob)
    ;(db.job.update as any).mockResolvedValue({})
    ;(db.project.update as any).mockResolvedValue({})
    ;(generateRunwareImage as any).mockResolvedValue(Buffer.from('img'))
  })

  it('calls Runware when provider is runware', async () => {
    await processImageJob({ jobId: 'job-1', projectId: 'proj-1' })
    expect(generateRunwareImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'A dragon', aspectRatio: '16:9' })
    )
  })

  it('marks job COMPLETED and increments project counter', async () => {
    await processImageJob({ jobId: 'job-1', projectId: 'proj-1' })
    expect(db.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1' }, data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
    expect(db.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ completedJobs: { increment: 1 } }) })
    )
  })

  it('calls Vertex when provider is vertex', async () => {
    ;(db.job.findUniqueOrThrow as any).mockResolvedValue({
      ...mockJob,
      project: { ...mockJob.project, settings: { provider: 'vertex', model: 'gemini-3.1-flash-image-preview', aspectRatio: '1:1', quality: 'medium', format: 'png' } },
    })
    ;(generateVertexImage as any).mockResolvedValue(Buffer.from('img'))

    await processImageJob({ jobId: 'job-1', projectId: 'proj-1' })
    expect(generateVertexImage).toHaveBeenCalled()
  })

  it('marks job FAILED when provider throws and increments failedJobs', async () => {
    ;(generateRunwareImage as any).mockRejectedValue(new Error('API down'))

    await processImageJob({ jobId: 'job-1', projectId: 'proj-1' })
    expect(db.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', errorMessage: 'API down' }) })
    )
    expect(db.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ failedJobs: { increment: 1 } }) })
    )
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- worker/image-worker.test.ts
```

Expected: FAIL — `Cannot find module './image-worker'`

- [ ] **Step 3: Create `worker/image-worker.ts`**

```typescript
import path from 'path'
import { db } from '../lib/db'
import { saveFile, getProjectDir, resolveOutputPath } from '../lib/storage'
import { generateRunwareImage } from './providers/runware'
import { generateVertexImage } from './providers/vertex-image'
import type { JobPayload } from '../lib/queue'
import type { ImageSettings } from '../lib/types'

export async function processImageJob(data: JobPayload): Promise<void> {
  const job = await db.job.findUniqueOrThrow({
    where: { id: data.jobId },
    include: { project: true },
  })

  if (job.project.status === 'PAUSED' || job.project.status === 'CANCELLED') return

  await db.job.update({ where: { id: job.id }, data: { status: 'GENERATING' } })

  const settings = job.project.settings as ImageSettings

  try {
    let imageBuffer: Buffer

    if (settings.provider === 'runware') {
      imageBuffer = await generateRunwareImage({
        prompt: job.prompt,
        aspectRatio: settings.aspectRatio,
        quality: settings.quality,
        format: settings.format,
      })
    } else {
      imageBuffer = await generateVertexImage({
        prompt: job.prompt,
        model: settings.model,
        aspectRatio: settings.aspectRatio,
        format: settings.format,
      })
    }

    const filename = `${job.order}.${settings.format}`
    const dir = getProjectDir('images', job.projectId)
    await saveFile(imageBuffer, dir, filename)

    const outputPath = resolveOutputPath('images', job.projectId, job.order, settings.format)

    await db.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', outputPath, progress: 100 },
    })
    await db.project.update({
      where: { id: job.projectId },
      data: { completedJobs: { increment: 1 } },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: msg },
    })
    await db.project.update({
      where: { id: job.projectId },
      data: { failedJobs: { increment: 1 } },
    })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- worker/image-worker.test.ts
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add worker/image-worker.ts worker/image-worker.test.ts
git commit -m "feat: add image worker with Runware/Vertex routing"
```

---

## Task 10: Video worker

**Files:**
- Create: `worker/video-worker.ts`
- Create: `worker/video-worker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `worker/video-worker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processVideoJob, resumeInProgressVideos } from './video-worker'

vi.mock('../lib/db', () => ({
  db: {
    job: {
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    project: { update: vi.fn() },
  },
}))
vi.mock('./providers/vertex-video', () => ({
  startVideoGeneration: vi.fn(),
  pollVideoOperation: vi.fn(),
}))
vi.mock('../lib/storage', () => ({
  saveFile: vi.fn(),
  getProjectDir: vi.fn(() => '/tmp/uploads/videos/proj-1'),
  resolveOutputPath: vi.fn(() => 'uploads/videos/proj-1/1.mp4'),
}))

import { db } from '../lib/db'
import { startVideoGeneration, pollVideoOperation } from './providers/vertex-video'

const baseJob = {
  id: 'job-1',
  projectId: 'proj-1',
  prompt: 'A dragon',
  order: 1,
  vertexOperationId: null,
  project: {
    id: 'proj-1',
    status: 'GENERATING',
    settings: { provider: 'vertex', model: 'veo-3.1-lite-generate-001', aspectRatio: '16:9', duration: 8, resolution: '1080p' },
  },
}

describe('processVideoJob', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    ;(db.job.findUniqueOrThrow as any).mockResolvedValue(baseJob)
    ;(db.job.update as any).mockResolvedValue({})
    ;(db.project.update as any).mockResolvedValue({})
  })

  it('starts generation and saves operationId when no existing operation', async () => {
    ;(startVideoGeneration as any).mockResolvedValue('operations/op-1')
    ;(pollVideoOperation as any).mockResolvedValue({ done: true, videoBuffer: Buffer.from('vid') })

    await processVideoJob({ jobId: 'job-1', projectId: 'proj-1' })

    expect(startVideoGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'A dragon', aspectRatio: '16:9' })
    )
    expect(db.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ vertexOperationId: 'operations/op-1' }) })
    )
  })

  it('marks job COMPLETED when poll returns done', async () => {
    ;(startVideoGeneration as any).mockResolvedValue('operations/op-1')
    ;(pollVideoOperation as any).mockResolvedValue({ done: true, videoBuffer: Buffer.from('vid') })

    await processVideoJob({ jobId: 'job-1', projectId: 'proj-1' })

    expect(db.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- worker/video-worker.test.ts
```

Expected: FAIL — `Cannot find module './video-worker'`

- [ ] **Step 3: Create `worker/video-worker.ts`**

```typescript
import { db } from '../lib/db'
import { saveFile, getProjectDir, resolveOutputPath } from '../lib/storage'
import { startVideoGeneration, pollVideoOperation } from './providers/vertex-video'
import type { JobPayload } from '../lib/queue'
import type { VideoSettings } from '../lib/types'

const POLL_INTERVAL_MS = 30_000

async function waitForVideo(operationName: string): Promise<Buffer> {
  while (true) {
    const result = await pollVideoOperation(operationName)
    if (result.done && result.videoBuffer) return result.videoBuffer
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

export async function processVideoJob(data: JobPayload): Promise<void> {
  const job = await db.job.findUniqueOrThrow({
    where: { id: data.jobId },
    include: { project: true },
  })

  if (job.project.status === 'PAUSED' || job.project.status === 'CANCELLED') return

  const settings = job.project.settings as VideoSettings

  await db.job.update({ where: { id: job.id }, data: { status: 'GENERATING' } })

  try {
    let operationName = job.vertexOperationId

    if (!operationName) {
      operationName = await startVideoGeneration({
        prompt: job.prompt,
        model: settings.model,
        aspectRatio: settings.aspectRatio,
        duration: settings.duration,
        resolution: settings.resolution,
      })
      await db.job.update({
        where: { id: job.id },
        data: { vertexOperationId: operationName },
      })
    }

    const videoBuffer = await waitForVideo(operationName)

    const filename = `${job.order}.mp4`
    const dir = getProjectDir('videos', job.projectId)
    await saveFile(videoBuffer, dir, filename)

    const outputPath = resolveOutputPath('videos', job.projectId, job.order, 'mp4')

    await db.job.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', outputPath, progress: 100, vertexOperationId: null },
    })
    await db.project.update({
      where: { id: job.projectId },
      data: { completedJobs: { increment: 1 } },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.job.update({
      where: { id: job.id },
      data: { status: 'FAILED', errorMessage: msg },
    })
    await db.project.update({
      where: { id: job.projectId },
      data: { failedJobs: { increment: 1 } },
    })
  }
}

export async function resumeInProgressVideos(enqueue: (payload: JobPayload) => Promise<void>): Promise<void> {
  const stuck = await db.job.findMany({
    where: { status: 'GENERATING', vertexOperationId: { not: null } },
    include: { project: true },
  })

  for (const job of stuck) {
    await enqueue({ jobId: job.id, projectId: job.projectId })
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- worker/video-worker.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: Commit**

```bash
git add worker/video-worker.ts worker/video-worker.test.ts
git commit -m "feat: add video worker with Vertex Veo polling"
```

---

## Task 11: Worker entry point

**Files:**
- Create: `worker/index.ts`

- [ ] **Step 1: Create `worker/index.ts`**

```typescript
import 'dotenv/config'
import { getQueue, IMAGE_JOB_QUEUE, VIDEO_JOB_QUEUE, type JobPayload } from '../lib/queue'
import { processImageJob } from './image-worker'
import { processVideoJob, resumeInProgressVideos } from './video-worker'

async function main() {
  const boss = getQueue()
  await boss.start()
  console.log('[worker] pg-boss started')

  await boss.work<JobPayload>(IMAGE_JOB_QUEUE, { teamSize: 5, retryLimit: 3 }, async (job) => {
    console.log(`[image-worker] processing job ${job.data.jobId}`)
    await processImageJob(job.data)
  })

  await boss.work<JobPayload>(VIDEO_JOB_QUEUE, { teamSize: 2, retryLimit: 3 }, async (job) => {
    console.log(`[video-worker] processing job ${job.data.jobId}`)
    await processVideoJob(job.data)
  })

  const enqueue = (payload: JobPayload) =>
    boss.send(VIDEO_JOB_QUEUE, payload).then(() => undefined)

  await resumeInProgressVideos(enqueue)

  console.log('[worker] ready — listening for jobs')

  process.on('SIGTERM', async () => {
    console.log('[worker] shutting down...')
    await boss.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[worker] fatal error:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Install dotenv**

```bash
npm install dotenv
```

- [ ] **Step 3: Smoke test the worker**

```bash
npm run dev:worker
```

Expected output:

```
[worker] pg-boss started
[worker] ready — listening for jobs
```

`Ctrl+C` to stop.

- [ ] **Step 4: Commit**

```bash
git add worker/index.ts
git commit -m "feat: add worker entry point with pg-boss startup"
```

---

## Task 12: API routes — projects CRUD

**Files:**
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/[id]/route.ts`

- [ ] **Step 1: Create `app/api/projects/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { jobs: true } } },
  })
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { title, description, mediaType, settings } = body

  if (!title || !mediaType || !settings) {
    return NextResponse.json({ error: 'title, mediaType, and settings are required' }, { status: 400 })
  }

  const project = await db.project.create({
    data: { title, description, mediaType, settings },
  })

  return NextResponse.json(project, { status: 201 })
}
```

- [ ] **Step 2: Create `app/api/projects/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { deleteProjectFiles } from '@/lib/storage'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await db.project.findUnique({
    where: { id },
    include: { jobs: { orderBy: { order: 'asc' } } },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteProjectFiles(id)
  await db.project.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Verify with curl**

Start the Next.js dev server:

```bash
npm run dev:next
```

In a second terminal:

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Project","mediaType":"IMAGE","settings":{"provider":"runware","model":"openai:gpt-image@2","aspectRatio":"1:1","quality":"high","format":"png"}}'
```

Expected: `{"id":"...","title":"Test Project",...}`

```bash
curl http://localhost:3000/api/projects
```

Expected: JSON array with the created project.

- [ ] **Step 4: Commit**

```bash
git add app/api/projects/
git commit -m "feat: add projects CRUD API routes"
```

---

## Task 13: API route — generate

**Files:**
- Create: `app/api/projects/[id]/generate/route.ts`

- [ ] **Step 1: Create `app/api/projects/[id]/generate/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQueue, IMAGE_JOB_QUEUE, VIDEO_JOB_QUEUE, type JobPayload } from '@/lib/queue'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { prompts }: { prompts: string[] } = await req.json()

  if (!prompts || prompts.length === 0) {
    return NextResponse.json({ error: 'prompts array is required' }, { status: 400 })
  }

  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cleanedPrompts = prompts.map((p) => p.trim()).filter(Boolean)

  const jobs = await db.$transaction(async (tx) => {
    const existing = await tx.job.count({ where: { projectId: id } })
    const created = await Promise.all(
      cleanedPrompts.map((prompt, i) =>
        tx.job.create({
          data: { projectId: id, prompt, order: existing + i + 1 },
        })
      )
    )
    await tx.project.update({
      where: { id },
      data: {
        status: 'GENERATING',
        totalJobs: { increment: cleanedPrompts.length },
      },
    })
    return created
  })

  const boss = getQueue()
  await boss.start()

  const queueName = project.mediaType === 'VIDEO' ? VIDEO_JOB_QUEUE : IMAGE_JOB_QUEUE

  for (const job of jobs) {
    const payload: JobPayload = { jobId: job.id, projectId: id }
    await boss.send(queueName, payload)
  }

  return NextResponse.json({ enqueued: jobs.length }, { status: 202 })
}
```

- [ ] **Step 2: Verify with curl** (Next.js dev server running, create a project first)

```bash
curl -X POST http://localhost:3000/api/projects/<PROJECT_ID>/generate \
  -H "Content-Type: application/json" \
  -d '{"prompts":["A futuristic city","A samurai at sunset"]}'
```

Expected: `{"enqueued":2}`

Check the database with `npx prisma studio` — two jobs with status PENDING should appear.

- [ ] **Step 3: Commit**

```bash
git add app/api/projects/[id]/generate/
git commit -m "feat: add generate API route — enqueues prompts as jobs"
```

---

## Task 14: API routes — queue control + status + download

**Files:**
- Create: `app/api/projects/[id]/pause/route.ts`
- Create: `app/api/projects/[id]/resume/route.ts`
- Create: `app/api/projects/[id]/cancel/route.ts`
- Create: `app/api/projects/[id]/retry/route.ts`
- Create: `app/api/projects/[id]/status/route.ts`
- Create: `app/api/projects/[id]/download/route.ts`

- [ ] **Step 1: Create `app/api/projects/[id]/pause/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.project.update({ where: { id }, data: { status: 'PAUSED' } })
  return NextResponse.json({ status: 'PAUSED' })
}
```

- [ ] **Step 2: Create `app/api/projects/[id]/resume/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQueue, IMAGE_JOB_QUEUE, VIDEO_JOB_QUEUE, type JobPayload } from '@/lib/queue'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.project.update({
    where: { id },
    data: { status: 'GENERATING' },
  })

  const pendingJobs = await db.job.findMany({
    where: { projectId: id, status: 'PENDING' },
  })

  if (pendingJobs.length > 0) {
    const boss = getQueue()
    await boss.start()
    const queueName = project.mediaType === 'VIDEO' ? VIDEO_JOB_QUEUE : IMAGE_JOB_QUEUE
    for (const job of pendingJobs) {
      await boss.send(queueName, { jobId: job.id, projectId: id } satisfies JobPayload)
    }
  }

  return NextResponse.json({ status: 'GENERATING', requeued: pendingJobs.length })
}
```

- [ ] **Step 3: Create `app/api/projects/[id]/cancel/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await db.$transaction([
    db.job.updateMany({ where: { projectId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } }),
    db.project.update({ where: { id }, data: { status: 'CANCELLED' } }),
  ])

  return NextResponse.json({ status: 'CANCELLED' })
}
```

- [ ] **Step 4: Create `app/api/projects/[id]/retry/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQueue, IMAGE_JOB_QUEUE, VIDEO_JOB_QUEUE, type JobPayload } from '@/lib/queue'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.project.findUniqueOrThrow({ where: { id } })

  const failedJobs = await db.$transaction(async (tx) => {
    const jobs = await tx.job.findMany({ where: { projectId: id, status: 'FAILED' } })
    await tx.job.updateMany({
      where: { projectId: id, status: 'FAILED' },
      data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
    })
    await tx.project.update({
      where: { id },
      data: {
        status: 'GENERATING',
        failedJobs: 0,
      },
    })
    return jobs
  })

  const boss = getQueue()
  await boss.start()
  const queueName = project.mediaType === 'VIDEO' ? VIDEO_JOB_QUEUE : IMAGE_JOB_QUEUE
  for (const job of failedJobs) {
    await boss.send(queueName, { jobId: job.id, projectId: id } satisfies JobPayload)
  }

  return NextResponse.json({ retrying: failedJobs.length })
}
```

- [ ] **Step 5: Create `app/api/projects/[id]/status/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      totalJobs: true,
      completedJobs: true,
      failedJobs: true,
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const jobs = await db.job.findMany({
    where: { projectId: id },
    select: { id: true, status: true, prompt: true, order: true, outputPath: true, errorMessage: true, progress: true },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ ...project, jobs })
}
```

- [ ] **Step 6: Create `app/api/projects/[id]/download/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildProjectZip } from '@/lib/storage'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const zipPath = await buildProjectZip(id, project.mediaType)
  const stats = await stat(zipPath)

  const filename = `${project.title.replace(/[^a-z0-9]/gi, '-')}.zip`
  const stream = createReadStream(zipPath)

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stats.size.toString(),
    },
  })
}
```

- [ ] **Step 7: Commit**

```bash
git add app/api/projects/[id]/
git commit -m "feat: add queue control, status, and download API routes"
```

---

## Task 15: API routes — job edit and retry

**Files:**
- Create: `app/api/jobs/[id]/route.ts`
- Create: `app/api/jobs/[id]/retry/route.ts`

- [ ] **Step 1: Create `app/api/jobs/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { prompt } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt is required' }, { status: 400 })

  const job = await db.job.update({
    where: { id },
    data: { prompt, status: 'PENDING', errorMessage: null },
  })
  return NextResponse.json(job)
}
```

- [ ] **Step 2: Create `app/api/jobs/[id]/retry/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQueue, IMAGE_JOB_QUEUE, VIDEO_JOB_QUEUE, type JobPayload } from '@/lib/queue'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const job = await db.job.update({
    where: { id },
    data: { status: 'PENDING', errorMessage: null, retryCount: { increment: 1 } },
    include: { project: true },
  })

  await db.project.update({
    where: { id: job.projectId },
    data: { status: 'GENERATING', failedJobs: { decrement: 1 } },
  })

  const boss = getQueue()
  await boss.start()
  const queueName = job.project.mediaType === 'VIDEO' ? VIDEO_JOB_QUEUE : IMAGE_JOB_QUEUE
  await boss.send(queueName, { jobId: job.id, projectId: job.projectId } satisfies JobPayload)

  return NextResponse.json(job)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/jobs/
git commit -m "feat: add job edit and single-job retry API routes"
```

---

## Task 16: Frontend — layout and shared components

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Create: `components/progress-bar.tsx`
- Create: `components/project-card.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TurboBatch',
  description: 'Bulk AI media generator',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground min-h-screen`}>
        <header className="border-b px-6 py-4">
          <a href="/" className="text-xl font-bold tracking-tight">TurboBatch</a>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `components/progress-bar.tsx`**

```tsx
import { Progress } from '@/components/ui/progress'

type Props = {
  completed: number
  total: number
  failed: number
}

export function ProjectProgressBar({ completed, total, failed }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return (
    <div className="space-y-1">
      <Progress value={pct} className="h-2" />
      <p className="text-xs text-muted-foreground">
        {completed}/{total} completed
        {failed > 0 && <span className="text-destructive ml-2">{failed} failed</span>}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Create `components/project-card.tsx`**

```tsx
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProjectProgressBar } from './progress-bar'
import Link from 'next/link'

type Project = {
  id: string
  title: string
  mediaType: 'IMAGE' | 'VIDEO'
  status: string
  totalJobs: number
  completedJobs: number
  failedJobs: number
  settings: { provider: string; aspectRatio: string }
}

type Props = {
  project: Project
  onDelete: (id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  GENERATING: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
  PAUSED: 'bg-yellow-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-gray-500',
  DRAFT: 'bg-gray-400',
}

export function ProjectCard({ project, onDelete }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{project.title}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-xs">
            {project.mediaType}
          </Badge>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>{project.settings.provider}</span>
          <span>·</span>
          <span>{project.settings.aspectRatio}</span>
          <span>·</span>
          <span className={`font-medium ${STATUS_COLORS[project.status] ?? ''}`}>{project.status}</span>
        </div>
      </CardHeader>
      <CardContent>
        <ProjectProgressBar
          completed={project.completedJobs}
          total={project.totalJobs}
          failed={project.failedJobs}
        />
      </CardContent>
      <CardFooter className="gap-2 pt-2">
        <Button asChild size="sm" variant="default">
          <Link href={`/projects/${project.id}`}>Open</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`/api/projects/${project.id}/download`}>Download</a>
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(project.id)}>
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css components/
git commit -m "feat: add layout, progress bar, and project card components"
```

---

## Task 17: Frontend — dashboard page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Write `app/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/project-card'

type Project = {
  id: string
  title: string
  mediaType: 'IMAGE' | 'VIDEO'
  status: string
  totalJobs: number
  completedJobs: number
  failedJobs: number
  settings: { provider: string; aspectRatio: string }
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/projects')
    if (res.ok) setProjects(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this project and all its files?')) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">+ New Project</Link>
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Loading...</p>}

      {!loading && projects.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-4">No projects yet</p>
          <Button asChild>
            <Link href="/projects/new">Create your first project</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev:next`, open `http://localhost:3000`. Should show "No projects yet" with a "+ New Project" button.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add dashboard page"
```

---

## Task 18: Frontend — create project page

**Files:**
- Create: `app/projects/new/page.tsx`
- Create: `components/create-project-form.tsx`

- [ ] **Step 1: Create `components/create-project-form.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const ASPECT_RATIOS = ['1:1', '16:9', '9:16'] as const
const IMAGE_MODELS = {
  runware: [{ value: 'openai:gpt-image@2', label: 'GPT Image 2' }],
  vertex: [
    { value: 'gemini-3.1-flash-image-preview', label: 'Gemini Flash (fast)' },
    { value: 'gemini-3-pro-image-preview', label: 'Gemini Pro (quality)' },
  ],
}

export function CreateProjectForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE')
  const [provider, setProvider] = useState<'runware' | 'vertex'>('runware')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high')
  const [imageModel, setImageModel] = useState('openai:gpt-image@2')
  const [duration, setDuration] = useState(8)
  const [resolution, setResolution] = useState<'720p' | '1080p'>('1080p')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const settings =
      mediaType === 'VIDEO'
        ? { provider: 'vertex', model: 'veo-3.1-lite-generate-001', aspectRatio, duration, resolution }
        : { provider, model: imageModel, aspectRatio, quality, format }

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, mediaType, settings }),
    })

    if (res.ok) {
      const project = await res.json()
      router.push(`/projects/${project.id}`)
    } else {
      alert('Failed to create project')
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New Project</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Project Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Japan History Shorts" required />
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>

          <div className="space-y-1">
            <Label>Media Type</Label>
            <Select value={mediaType} onValueChange={(v) => setMediaType(v as 'IMAGE' | 'VIDEO')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IMAGE">Image</SelectItem>
                <SelectItem value="VIDEO">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {mediaType === 'IMAGE' && (
            <>
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(v) => {
                  setProvider(v as 'runware' | 'vertex')
                  setImageModel(IMAGE_MODELS[v as 'runware' | 'vertex'][0].value)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="runware">Runware</SelectItem>
                    <SelectItem value="vertex">Vertex AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Model</Label>
                <Select value={imageModel} onValueChange={setImageModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS[provider].map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as 'png' | 'jpg')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="jpg">JPG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Quality</Label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as 'low' | 'medium' | 'high')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {mediaType === 'VIDEO' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Duration (seconds)</Label>
                <Input type="number" min={1} max={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Resolution</Label>
                <Select value={resolution} onValueChange={(v) => setResolution(v as '720p' | '1080p')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create `app/projects/new/page.tsx`**

```tsx
import { CreateProjectForm } from '@/components/create-project-form'

export default function NewProjectPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">New Project</h1>
      <CreateProjectForm />
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/projects/new`. Fill in a title, select IMAGE, pick 16:9, click Create. Should redirect to `/projects/<id>`.

- [ ] **Step 4: Commit**

```bash
git add app/projects/new/ components/create-project-form.tsx
git commit -m "feat: add create project page with provider/aspect-ratio form"
```

---

## Task 19: Frontend — project page with live queue

**Files:**
- Create: `app/projects/[id]/page.tsx`
- Create: `components/job-list.tsx`

- [ ] **Step 1: Create `components/job-list.tsx`**

```tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Job = {
  id: string
  prompt: string
  order: number
  status: string
  progress: number
  errorMessage: string | null
  outputPath: string | null
}

type Props = {
  jobs: Job[]
  onRetryJob: (id: string) => void
  onEditJob: (id: string, prompt: string) => void
}

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  GENERATING: '⚙️',
  COMPLETED: '✓',
  FAILED: '❌',
  CANCELLED: '—',
}

export function JobList({ jobs, onRetryJob, onEditJob }: Props) {
  return (
    <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-start gap-3 py-2 px-3 rounded-md bg-muted/40 text-sm"
        >
          <span className="shrink-0 w-5 text-center">{STATUS_ICONS[job.status] ?? '?'}</span>
          <span className="flex-1 truncate text-muted-foreground">{job.prompt}</span>
          <Badge variant="outline" className="text-xs shrink-0">{job.order}</Badge>
          {job.status === 'FAILED' && (
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                onClick={() => {
                  const edited = prompt(`Edit prompt:`, job.prompt)
                  if (edited && edited !== job.prompt) onEditJob(job.id, edited)
                }}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-400"
                onClick={() => onRetryJob(job.id)}>
                Retry
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/projects/[id]/page.tsx`**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ProjectProgressBar } from '@/components/progress-bar'
import { JobList } from '@/components/job-list'

type ProjectStatus = {
  id: string
  status: string
  totalJobs: number
  completedJobs: number
  failedJobs: number
  jobs: Array<{ id: string; prompt: string; order: number; status: string; progress: number; errorMessage: string | null; outputPath: string | null }>
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [project, setProject] = useState<{ title: string; mediaType: string; settings: any } | null>(null)
  const [status, setStatus] = useState<ProjectStatus | null>(null)
  const [prompts, setPrompts] = useState('')
  const [generating, setGenerating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function loadProject() {
    const res = await fetch(`/api/projects/${id}`)
    if (res.ok) setProject(await res.json())
  }

  async function pollStatus() {
    const res = await fetch(`/api/projects/${id}/status`)
    if (res.ok) setStatus(await res.json())
  }

  useEffect(() => {
    loadProject()
    pollStatus()
    pollRef.current = setInterval(pollStatus, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [id])

  async function handleGenerate() {
    const lines = prompts.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setGenerating(true)
    await fetch(`/api/projects/${id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: lines }),
    })
    setPrompts('')
    setGenerating(false)
  }

  async function handleAction(action: 'pause' | 'resume' | 'cancel' | 'retry') {
    await fetch(`/api/projects/${id}/${action}`, { method: 'POST' })
    await pollStatus()
  }

  async function handleRetryJob(jobId: string) {
    await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' })
    await pollStatus()
  }

  async function handleEditJob(jobId: string, prompt: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    await pollStatus()
  }

  const isActive = status?.status === 'GENERATING'
  const hasFailed = (status?.failedJobs ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project?.title ?? '...'}</h1>
          <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
            <Badge variant="outline">{project?.mediaType}</Badge>
            <span>{(project?.settings as any)?.provider}</span>
            <span>·</span>
            <span>{(project?.settings as any)?.aspectRatio}</span>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/projects/${id}/results`}>View Results</Link>
        </Button>
      </div>

      <div className="space-y-2">
        <Textarea
          placeholder="One prompt per line&#10;A futuristic city&#10;A samurai at sunset"
          value={prompts}
          onChange={(e) => setPrompts(e.target.value)}
          rows={6}
          className="font-mono text-sm"
        />
        <Button onClick={handleGenerate} disabled={generating || !prompts.trim()}>
          {generating ? 'Enqueuing...' : 'Generate'}
        </Button>
      </div>

      {status && (
        <div className="space-y-4">
          <ProjectProgressBar
            completed={status.completedJobs}
            total={status.totalJobs}
            failed={status.failedJobs}
          />

          <div className="flex gap-2 flex-wrap">
            {isActive && <Button size="sm" variant="outline" onClick={() => handleAction('pause')}>Pause</Button>}
            {status.status === 'PAUSED' && <Button size="sm" variant="outline" onClick={() => handleAction('resume')}>Resume</Button>}
            {isActive && <Button size="sm" variant="destructive" onClick={() => handleAction('cancel')}>Cancel</Button>}
            {hasFailed && <Button size="sm" variant="secondary" onClick={() => handleAction('retry')}>Retry All Failed</Button>}
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/projects/${id}/download`}>Download ZIP</a>
            </Button>
          </div>

          <JobList jobs={status.jobs} onRetryJob={handleRetryJob} onEditJob={handleEditJob} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Open a project. Paste some prompts and click Generate. You should see jobs appear in the list with ⏳ status. With the worker running (`npm run dev`), they should transition to ✓ COMPLETED.

- [ ] **Step 4: Commit**

```bash
git add app/projects/[id]/page.tsx components/job-list.tsx
git commit -m "feat: add project page with prompts input and live polling"
```

---

## Task 20: Frontend — results page

**Files:**
- Create: `app/projects/[id]/results/page.tsx`

- [ ] **Step 1: Create `app/projects/[id]/results/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Job = {
  id: string
  prompt: string
  order: number
  status: string
  outputPath: string | null
  errorMessage: string | null
}

type Project = {
  id: string
  title: string
  mediaType: 'IMAGE' | 'VIDEO'
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setProject(data)
        setJobs(data.jobs ?? [])
      })
  }, [id])

  const completed = jobs.filter((j) => j.status === 'COMPLETED')
  const failed = jobs.filter((j) => j.status === 'FAILED')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project?.title ?? '...'} — Results</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {completed.length} completed · {failed.length} failed
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/projects/${id}`}>← Back</Link>
          </Button>
          <Button asChild>
            <a href={`/api/projects/${id}/download`}>Download ZIP</a>
          </Button>
        </div>
      </div>

      {project?.mediaType === 'IMAGE' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {completed.map((job) => (
            <div key={job.id} className="space-y-1">
              <div className="aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
                {job.outputPath ? (
                  <img
                    src={`/uploads/${job.outputPath.replace(/^uploads\//, '')}`}
                    alt={job.prompt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{job.order}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{job.order}.{(job.outputPath ?? '').split('.').pop()}</p>
            </div>
          ))}
        </div>
      )}

      {project?.mediaType === 'VIDEO' && (
        <div className="space-y-2">
          {completed.map((job) => (
            <div key={job.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-md">
              <Badge variant="outline">{job.order}</Badge>
              <span className="text-sm flex-1 truncate">{job.prompt}</span>
              <span className="text-xs text-muted-foreground">{job.order}.mp4</span>
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-destructive">Failed ({failed.length})</h2>
          {failed.map((job) => (
            <div key={job.id} className="p-3 bg-destructive/10 rounded-md space-y-1">
              <p className="text-sm font-medium">{job.prompt}</p>
              <p className="text-xs text-muted-foreground">{job.errorMessage}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Serve uploads as static files**

Next.js doesn't serve `uploads/` automatically. Add a route handler to serve files:

Create `app/uploads/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import path from 'path'
import { lookup } from 'mime-types'

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  const filePath = path.join(process.cwd(), 'uploads', ...segments)

  try {
    const stats = await stat(filePath)
    if (!stats.isFile()) return new NextResponse('Not found', { status: 404 })

    const mimeType = lookup(filePath) || 'application/octet-stream'
    const stream = createReadStream(filePath)

    return new NextResponse(stream as any, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
```

Install mime-types:

```bash
npm install mime-types
npm install --save-dev @types/mime-types
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`, complete some image jobs, navigate to `/projects/<id>/results`. Images should render as thumbnails.

- [ ] **Step 4: Commit**

```bash
git add app/projects/[id]/results/ app/uploads/
git commit -m "feat: add results page and uploads static file serving"
```

---

## Task 21: End-to-end smoke test

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Start the full stack**

```bash
npm run dev
```

Expected output includes both `next dev` and `[worker] ready — listening for jobs`.

- [ ] **Step 3: Create an image project via UI**

- Open `http://localhost:3000`
- Click "+ New Project"
- Title: "Smoke Test Images", Media Type: Image, Provider: Runware, Aspect Ratio: 1:1, Format: PNG, Quality: High
- Click "Create Project"

- [ ] **Step 4: Generate 3 images**

On the project page, paste:
```
A dragon flying over a city
A futuristic Tokyo street at night
A medieval castle in the mountains
```

Click "Generate". Observe jobs moving from ⏳ to ⚙️ to ✓.

- [ ] **Step 5: Verify files on disk**

```bash
ls "uploads/images/<PROJECT_ID>"
```

Expected: `1.png`, `2.png`, `3.png`

- [ ] **Step 6: Download ZIP**

Click "Download ZIP" — a `.zip` file should download containing the 3 images.

- [ ] **Step 7: Verify results page**

Navigate to `/projects/<id>/results` — images should render as thumbnails.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: TurboBatch v1 complete — bulk AI media generator"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Project CRUD (create, list, get, delete)
- ✅ Job queue (submit prompts → enqueue → pg-boss)
- ✅ Image generation: Runware + Vertex AI Gemini
- ✅ Video generation: Vertex AI Veo with operation polling + restart resume
- ✅ Aspect ratios 1:1 / 16:9 / 9:16 for all providers
- ✅ Pause / Resume / Cancel / Retry All Failed / Retry Single
- ✅ Edit prompt on failed job
- ✅ Progress bar + live 2s polling
- ✅ Local disk storage under uploads/
- ✅ ZIP download via archiver
- ✅ Project status counters (totalJobs, completedJobs, failedJobs)
- ✅ Dashboard with project cards
- ✅ Create Project form (conditional fields by type/provider)
- ✅ Project page (prompts textarea + live job list)
- ✅ Results page (image grid + video list + failed list)
- ✅ Single user, no auth
- ✅ Worker resumes in-progress video operations on restart
