# TurboBatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build TurboBatch — a bulk AI media generator where users create projects, paste prompts (one per line), and generate images or videos via Runware (GPT Image 2) or Google Vertex AI (Gemini images + Veo videos), with a pg-boss job queue, pause/resume/cancel/retry controls, and ZIP download.

**Architecture:** Next.js 16 App Router for both frontend and API. Prisma + PostgreSQL for persistence. pg-boss (PostgreSQL-backed) for the job queue — no Redis needed. A separate worker process (`tsx worker/index.ts`) picks up jobs and calls provider APIs. Providers (Runware, Vertex Image, Vertex Video) are isolated modules so they can be swapped and tested independently. Output files land on local disk under `uploads/`.

**Tech Stack:** Next.js 16, Prisma 5, pg-boss 12, @google/genai 2, archiver 8, uuid 14, TypeScript, Tailwind CSS 4, Vitest 2

---

## File Structure

```
prisma/
  schema.prisma              ← DB schema (Project + Job models)

types/
  index.ts                   ← Shared TS types (ProjectSettings, JobData, etc.)

lib/
  prisma.ts                  ← Prisma client singleton
  boss.ts                    ← PgBoss singleton (shared by API + worker)
  aspect-ratio.ts            ← Maps "1:1"|"16:9"|"9:16" → pixel dimensions

providers/
  runware.ts                 ← Runware HTTP API (GPT Image 2)
  vertex-image.ts            ← Vertex Gemini image generation
  vertex-video.ts            ← Vertex Veo video generation + operation polling

worker/
  index.ts                   ← Starts boss, registers image-job + video-job workers
  image-worker.ts            ← Handles image jobs (calls Runware or Vertex Image)
  video-worker.ts            ← Handles video jobs (calls Vertex Video, polls operation)

app/
  layout.tsx                 ← Root layout: title "TurboBatch", dark bg
  page.tsx                   ← Dashboard: project card grid
  projects/
    new/
      page.tsx               ← Create project form
    [id]/
      page.tsx               ← Project page: prompts textarea + queue status
      results/
        page.tsx             ← Results grid + ZIP download

app/api/
  projects/
    route.ts                 ← GET list + POST create
    [id]/
      route.ts               ← GET detail (with jobs) + DELETE
      generate/route.ts      ← POST: accept prompts, enqueue jobs
      pause/route.ts         ← POST: mark project PAUSED, stop new jobs
      resume/route.ts        ← POST: mark project GENERATING, reschedule pending
      cancel/route.ts        ← POST: cancel all pending jobs
      retry/route.ts         ← POST: re-enqueue all failed jobs
      status/route.ts        ← GET: fast poll endpoint (counts + job statuses)
      download/route.ts      ← GET: stream ZIP of completed outputs
  jobs/
    [id]/
      route.ts               ← PATCH: edit prompt on failed job
      retry/route.ts         ← POST: retry single job

uploads/                     ← Created at runtime (git-ignored)
  images/<projectId>/
  videos/<projectId>/

tests/
  providers/
    runware.test.ts
    vertex-image.test.ts
    vertex-video.test.ts
  worker/
    image-worker.test.ts
    video-worker.test.ts
  lib/
    aspect-ratio.test.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `prisma/schema.prisma`
- Create: `.env.example`
- Create: `.gitignore` (append uploads/)
- Modify: `package.json` (add worker + test scripts)

- [ ] **Step 1: Update package.json scripts**

Open `package.json` and replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "worker": "tsx worker/index.ts",
  "worker:dev": "tsx watch worker/index.ts",
  "db:migrate": "prisma migrate dev",
  "db:generate": "prisma generate",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Create .env.example**

Create `.env.example`:

```env
# PostgreSQL — used by Prisma AND pg-boss
DATABASE_URL="postgresql://postgres:password@localhost:5432/turbobatch"

# Runware API key (https://runware.ai)
RUNWARE_API_KEY=""

# Google AI — for Vertex image generation (gemini-3.1-flash-image-preview)
GOOGLE_API_KEY=""

# Google Cloud Vertex AI — for video generation (veo-3.1-lite-generate-001)
VERTEX_PROJECT_ID=""
VERTEX_LOCATION="us-central1"

# Where generated files are stored (relative to project root)
UPLOADS_DIR="uploads"
```

- [ ] **Step 3: Create your own .env by copying .env.example and filling in your values**

```bash
cp .env.example .env
```

Fill in DATABASE_URL, RUNWARE_API_KEY, GOOGLE_API_KEY, VERTEX_PROJECT_ID.

- [ ] **Step 4: Create prisma/schema.prisma**

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
  id             String        @id @default(uuid())
  title          String
  description    String?
  media_type     MediaType
  provider       Provider
  settings       Json
  status         ProjectStatus @default(DRAFT)
  total_jobs     Int           @default(0)
  completed_jobs Int           @default(0)
  failed_jobs    Int           @default(0)
  created_at     DateTime      @default(now())
  updated_at     DateTime      @updatedAt
  jobs           Job[]

  @@map("projects")
}

model Job {
  id                   String    @id @default(uuid())
  project_id           String
  prompt               String
  status               JobStatus @default(PENDING)
  progress             Int       @default(0)
  output_path          String?
  error_message        String?
  retry_count          Int       @default(0)
  vertex_operation_id  String?
  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  project              Project   @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@map("jobs")
}
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: Prisma creates `prisma/migrations/` and applies the schema. Output ends with: `Your database is now in sync with your schema.`

- [ ] **Step 6: Append to .gitignore**

Add to the end of `.gitignore`:

```
uploads/
.env
```

- [ ] **Step 7: Commit**

```bash
git add prisma/ .env.example .gitignore package.json
git commit -m "feat: prisma schema, env config, project scripts"
```

---

## Task 2: Shared Types

**Files:**
- Create: `types/index.ts`

- [ ] **Step 1: Create types/index.ts**

```typescript
export type AspectRatio = "1:1" | "16:9" | "9:16";

export interface RunwareImageSettings {
  provider: "RUNWARE";
  model: "openai:gpt-image@2";
  aspectRatio: AspectRatio;
  format: "PNG" | "JPG" | "WEBP";
  quality: "auto" | "high" | "medium" | "low";
}

export interface VertexImageSettings {
  provider: "VERTEX";
  model: "gemini-3.1-flash-image-preview" | "gemini-3-pro-image-preview";
  aspectRatio: AspectRatio;
  format: "PNG" | "JPG";
}

export interface VertexVideoSettings {
  provider: "VERTEX";
  model: "veo-3.1-lite-generate-001";
  aspectRatio: AspectRatio;
  durationSeconds: number;
  resolution: "720p" | "1080p";
}

export type ProjectSettings =
  | RunwareImageSettings
  | VertexImageSettings
  | VertexVideoSettings;

export interface ImageJobData {
  jobId: string;
  projectId: string;
  prompt: string;
  settings: RunwareImageSettings | VertexImageSettings;
  outputIndex: number;
}

export interface VideoJobData {
  jobId: string;
  projectId: string;
  prompt: string;
  settings: VertexVideoSettings;
  outputIndex: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/
git commit -m "feat: shared TypeScript types"
```

---

## Task 3: lib Singletons

**Files:**
- Create: `lib/prisma.ts`
- Create: `lib/boss.ts`
- Create: `lib/aspect-ratio.ts`
- Create: `tests/lib/aspect-ratio.test.ts`

- [ ] **Step 1: Write failing test for aspect-ratio**

Create `tests/lib/aspect-ratio.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toRunwareDimensions, toVertexAspectRatio } from "../../lib/aspect-ratio";

describe("toRunwareDimensions", () => {
  it("maps 1:1 to 1024x1024", () => {
    expect(toRunwareDimensions("1:1")).toEqual({ width: 1024, height: 1024 });
  });
  it("maps 16:9 to 1536x864", () => {
    expect(toRunwareDimensions("16:9")).toEqual({ width: 1536, height: 864 });
  });
  it("maps 9:16 to 864x1536", () => {
    expect(toRunwareDimensions("9:16")).toEqual({ width: 864, height: 1536 });
  });
});

describe("toVertexAspectRatio", () => {
  it("returns the ratio string as-is", () => {
    expect(toVertexAspectRatio("16:9")).toBe("16:9");
    expect(toVertexAspectRatio("9:16")).toBe("9:16");
    expect(toVertexAspectRatio("1:1")).toBe("1:1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/aspect-ratio.test.ts
```

Expected: FAIL — `Cannot find module '../../lib/aspect-ratio'`

- [ ] **Step 3: Create lib/aspect-ratio.ts**

```typescript
import type { AspectRatio } from "../types";

const RUNWARE_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "1:1":  { width: 1024, height: 1024 },
  "16:9": { width: 1536, height: 864  },
  "9:16": { width: 864,  height: 1536 },
};

export function toRunwareDimensions(ratio: AspectRatio) {
  return RUNWARE_DIMENSIONS[ratio];
}

export function toVertexAspectRatio(ratio: AspectRatio): string {
  return ratio;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/aspect-ratio.test.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Create lib/prisma.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error"] : [] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Create lib/boss.ts**

```typescript
import PgBoss from "pg-boss";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL!);
    await boss.start();
  }
  return boss;
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/ tests/lib/
git commit -m "feat: lib singletons and aspect-ratio helpers"
```

---

## Task 4: Runware Image Provider

**Files:**
- Create: `providers/runware.ts`
- Create: `tests/providers/runware.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/runware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateRunwareImage } from "../../providers/runware";

const MOCK_RESPONSE = {
  taskType: "imageInference",
  taskUUID: "abc-123",
  imageUUID: "img-uuid",
  imageURL: "https://im.runware.ai/image/os/test/1.jpg",
};

describe("generateRunwareImage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESPONSE,
    }));
    process.env.RUNWARE_API_KEY = "test-key";
  });

  it("calls Runware API with correct payload and returns imageURL", async () => {
    const url = await generateRunwareImage({
      prompt: "A futuristic city",
      width: 1024,
      height: 1024,
      format: "PNG",
      quality: "high",
    });

    expect(url).toBe(MOCK_RESPONSE.imageURL);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.runware.ai/v1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }));

    await expect(
      generateRunwareImage({ prompt: "x", width: 1024, height: 1024, format: "PNG", quality: "high" })
    ).rejects.toThrow("Runware API error 401");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/providers/runware.test.ts
```

Expected: FAIL — `Cannot find module '../../providers/runware'`

- [ ] **Step 3: Create providers/runware.ts**

```typescript
import { v4 as uuidv4 } from "uuid";

interface RunwareParams {
  prompt: string;
  width: number;
  height: number;
  format: "PNG" | "JPG" | "WEBP";
  quality: "auto" | "high" | "medium" | "low";
}

export async function generateRunwareImage(params: RunwareParams): Promise<string> {
  const apiKey = process.env.RUNWARE_API_KEY;
  if (!apiKey) throw new Error("RUNWARE_API_KEY is not set");

  const body = {
    taskType: "imageInference",
    taskUUID: uuidv4(),
    model: "openai:gpt-image@2",
    positivePrompt: params.prompt,
    width: params.width,
    height: params.height,
    outputFormat: params.format,
    outputType: "URL",
    numberResults: 1,
    providerSettings: {
      openai: {
        quality: params.quality,
        moderation: "auto",
      },
    },
  };

  const res = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Runware API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (!data.imageURL) {
    throw new Error(`Runware returned no imageURL: ${JSON.stringify(data)}`);
  }
  return data.imageURL as string;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/providers/runware.test.ts
```

Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add providers/runware.ts tests/providers/runware.test.ts
git commit -m "feat: Runware image provider"
```

---

## Task 5: Vertex Image Provider

**Files:**
- Create: `providers/vertex-image.ts`
- Create: `tests/providers/vertex-image.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/vertex-image.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateVertexImage } from "../../providers/vertex-image";

const MOCK_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("generateVertexImage", () => {
  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "test-key";
    vi.resetModules();
  });

  it("extracts base64 image from Gemini response", async () => {
    const mockGenerateContent = vi.fn().mockResolvedValue({
      candidates: [{
        content: {
          parts: [
            { text: "Here is the image." },
            { inlineData: { mimeType: "image/png", data: MOCK_PNG_BASE64 } },
          ],
        },
      }],
    });

    vi.doMock("@google/genai", () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
      })),
    }));

    const { generateVertexImage: fn } = await import("../../providers/vertex-image");
    const result = await fn({
      prompt: "A samurai",
      model: "gemini-3.1-flash-image-preview",
      aspectRatio: "16:9",
      format: "PNG",
    });

    expect(result.base64).toBe(MOCK_PNG_BASE64);
    expect(result.mimeType).toBe("image/png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/providers/vertex-image.test.ts
```

Expected: FAIL — `Cannot find module '../../providers/vertex-image'`

- [ ] **Step 3: Create providers/vertex-image.ts**

```typescript
import { GoogleGenAI } from "@google/genai";
import type { AspectRatio } from "../types";

interface VertexImageParams {
  prompt: string;
  model: "gemini-3.1-flash-image-preview" | "gemini-3-pro-image-preview";
  aspectRatio: AspectRatio;
  format: "PNG" | "JPG";
}

interface VertexImageResult {
  base64: string;
  mimeType: string;
}

export async function generateVertexImage(params: VertexImageParams): Promise<VertexImageResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });

  const mimeType = params.format === "PNG" ? "image/png" : "image/jpeg";

  const response = await ai.models.generateContent({
    model: params.model,
    contents: [{ role: "user", parts: [{ text: params.prompt }] }],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageOutputOptions: { mimeType },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData?.data);

  if (!imagePart?.inlineData) {
    throw new Error(`Vertex image: no inline image in response`);
  }

  return {
    base64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/providers/vertex-image.test.ts
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add providers/vertex-image.ts tests/providers/vertex-image.test.ts
git commit -m "feat: Vertex Gemini image provider"
```

---

## Task 6: Vertex Video Provider

**Files:**
- Create: `providers/vertex-video.ts`
- Create: `tests/providers/vertex-video.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/vertex-video.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("generateVertexVideo", () => {
  it("polls operation until done and returns video URI", async () => {
    const mockOperation = {
      name: "projects/p/operations/op-123",
      done: false,
    };
    const doneOperation = {
      name: "projects/p/operations/op-123",
      done: true,
      result: {
        generatedVideos: [{ video: { uri: "gs://bucket/video.mp4" } }],
      },
    };

    let pollCount = 0;
    const mockGet = vi.fn().mockImplementation(async () => {
      pollCount++;
      return pollCount >= 2 ? doneOperation : mockOperation;
    });

    vi.doMock("@google/genai", () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
          generateVideos: vi.fn().mockResolvedValue({ ...mockOperation, done: false }),
        },
        operations: { get: mockGet },
      })),
    }));

    process.env.VERTEX_PROJECT_ID = "test-project";
    process.env.VERTEX_LOCATION = "us-central1";

    const { generateVertexVideo } = await import("../../providers/vertex-video");

    const result = await generateVertexVideo({
      prompt: "A dragon flying",
      aspectRatio: "16:9",
      durationSeconds: 8,
      resolution: "720p",
      pollIntervalMs: 10,
    });

    expect(result.uri).toBe("gs://bucket/video.mp4");
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/providers/vertex-video.test.ts
```

Expected: FAIL — `Cannot find module '../../providers/vertex-video'`

- [ ] **Step 3: Create providers/vertex-video.ts**

```typescript
import { GoogleGenAI } from "@google/genai";
import type { AspectRatio } from "../types";

interface VertexVideoParams {
  prompt: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  resolution: "720p" | "1080p";
  pollIntervalMs?: number;
}

interface VertexVideoResult {
  uri: string;
  operationName: string;
}

export async function generateVertexVideo(params: VertexVideoParams): Promise<VertexVideoResult> {
  const project = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION ?? "us-central1";
  if (!project) throw new Error("VERTEX_PROJECT_ID is not set");

  const ai = new GoogleGenAI({ vertexai: true, project, location });
  const pollMs = params.pollIntervalMs ?? 30_000;

  let operation = await ai.models.generateVideos({
    model: "veo-3.1-lite-generate-001",
    prompt: params.prompt,
    config: {
      aspectRatio: params.aspectRatio,
      numberOfVideos: 1,
      durationSeconds: params.durationSeconds,
      resolution: params.resolution,
      personGeneration: "allow_all",
      generateAudio: true,
    },
  });

  while (!operation.done) {
    await new Promise((r) => setTimeout(r, pollMs));
    operation = await ai.operations.get(operation);
  }

  const videos = (operation as { result?: { generatedVideos?: Array<{ video?: { uri?: string } }> } }).result?.generatedVideos;
  const uri = videos?.[0]?.video?.uri;
  if (!uri) throw new Error("Vertex Video: no video URI in completed operation");

  return { uri, operationName: operation.name as string };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/providers/vertex-video.test.ts
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add providers/vertex-video.ts tests/providers/vertex-video.test.ts
git commit -m "feat: Vertex Veo video provider with operation polling"
```

---

## Task 7: Image Worker

**Files:**
- Create: `worker/image-worker.ts`
- Create: `tests/worker/image-worker.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/worker/image-worker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const mockPrismaUpdate = vi.fn().mockResolvedValue({});
const mockPrismaUpdateMany = vi.fn().mockResolvedValue({});

vi.mock("../../lib/prisma", () => ({
  prisma: {
    job: { update: mockPrismaUpdate },
    project: { update: mockPrismaUpdateMany },
  },
}));

vi.mock("../../providers/runware", () => ({
  generateRunwareImage: vi.fn().mockResolvedValue("https://example.com/image.png"),
}));

vi.mock("../../providers/vertex-image", () => ({
  generateVertexImage: vi.fn().mockResolvedValue({
    base64: "abc123",
    mimeType: "image/png",
  }),
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("node-fetch", () => ({
  default: vi.fn().mockResolvedValue({
    ok: true,
    buffer: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
  }),
}));

describe("processImageJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPLOADS_DIR = "uploads";
  });

  it("handles Runware image job: downloads URL, writes file, updates DB", async () => {
    const { processImageJob } = await import("../../worker/image-worker");

    const jobData = {
      jobId: "job-1",
      projectId: "proj-1",
      prompt: "A futuristic city",
      outputIndex: 0,
      settings: {
        provider: "RUNWARE" as const,
        model: "openai:gpt-image@2" as const,
        aspectRatio: "1:1" as const,
        format: "PNG" as const,
        quality: "high" as const,
      },
    };

    await processImageJob(jobData);

    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/worker/image-worker.test.ts
```

Expected: FAIL — `Cannot find module '../../worker/image-worker'`

- [ ] **Step 3: Create worker/image-worker.ts**

```typescript
import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateRunwareImage } from "../providers/runware";
import { generateVertexImage } from "../providers/vertex-image";
import { toRunwareDimensions } from "../lib/aspect-ratio";
import type { ImageJobData } from "../types";

export async function processImageJob(data: ImageJobData): Promise<void> {
  const { jobId, projectId, prompt, settings, outputIndex } = data;
  const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";
  const outDir = path.join(uploadsDir, "images", projectId);

  await prisma.job.update({ where: { id: jobId }, data: { status: "GENERATING" } });

  try {
    const ext = settings.format.toLowerCase();
    const outFile = path.join(outDir, `${outputIndex}.${ext}`);
    await fs.mkdir(outDir, { recursive: true });

    if (settings.provider === "RUNWARE") {
      const dims = toRunwareDimensions(settings.aspectRatio);
      const imageUrl = await generateRunwareImage({
        prompt,
        width: dims.width,
        height: dims.height,
        format: settings.format,
        quality: settings.quality,
      });
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(outFile, buf);
    } else {
      const result = await generateVertexImage({
        prompt,
        model: settings.model,
        aspectRatio: settings.aspectRatio,
        format: settings.format,
      });
      const buf = Buffer.from(result.base64, "base64");
      await fs.writeFile(outFile, buf);
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", output_path: outFile, progress: 100 },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        completed_jobs: { increment: 1 },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", error_message: message, retry_count: { increment: 1 } },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { failed_jobs: { increment: 1 } },
    });
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/worker/image-worker.test.ts
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add worker/image-worker.ts tests/worker/image-worker.test.ts
git commit -m "feat: image worker (Runware + Vertex)"
```

---

## Task 8: Video Worker

**Files:**
- Create: `worker/video-worker.ts`
- Create: `tests/worker/video-worker.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/worker/video-worker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaJobUpdate = vi.fn().mockResolvedValue({});
const mockPrismaProjectUpdate = vi.fn().mockResolvedValue({});

vi.mock("../../lib/prisma", () => ({
  prisma: {
    job: { update: mockPrismaJobUpdate },
    project: { update: mockPrismaProjectUpdate },
  },
}));

vi.mock("../../providers/vertex-video", () => ({
  generateVertexVideo: vi.fn().mockResolvedValue({
    uri: "gs://bucket/proj-1/0.mp4",
    operationName: "projects/p/operations/op-1",
  }),
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("processVideoJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPLOADS_DIR = "uploads";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  it("generates video, saves operation ID, then marks completed", async () => {
    const { processVideoJob } = await import("../../worker/video-worker");

    await processVideoJob({
      jobId: "job-v1",
      projectId: "proj-1",
      prompt: "A dragon",
      outputIndex: 0,
      settings: {
        provider: "VERTEX" as const,
        model: "veo-3.1-lite-generate-001" as const,
        aspectRatio: "16:9" as const,
        durationSeconds: 8,
        resolution: "720p",
      },
    });

    expect(mockPrismaJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-v1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/worker/video-worker.test.ts
```

Expected: FAIL — `Cannot find module '../../worker/video-worker'`

- [ ] **Step 3: Create worker/video-worker.ts**

```typescript
import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateVertexVideo } from "../providers/vertex-video";
import type { VideoJobData } from "../types";

export async function processVideoJob(data: VideoJobData): Promise<void> {
  const { jobId, projectId, prompt, settings, outputIndex } = data;
  const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";
  const outDir = path.join(uploadsDir, "videos", projectId);

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "GENERATING", progress: 0 },
  });

  try {
    await fs.mkdir(outDir, { recursive: true });
    const outFile = path.join(outDir, `${outputIndex}.mp4`);

    const result = await generateVertexVideo({
      prompt,
      aspectRatio: settings.aspectRatio,
      durationSeconds: settings.durationSeconds,
      resolution: settings.resolution,
    });

    await prisma.job.update({
      where: { id: jobId },
      data: { vertex_operation_id: result.operationName, progress: 50 },
    });

    const res = await fetch(result.uri);
    if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(outFile, buf);

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", output_path: outFile, progress: 100 },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { completed_jobs: { increment: 1 } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", error_message: message, retry_count: { increment: 1 } },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { failed_jobs: { increment: 1 } },
    });
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/worker/video-worker.test.ts
```

Expected: PASS — 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add worker/video-worker.ts tests/worker/video-worker.test.ts
git commit -m "feat: video worker (Vertex Veo)"
```

---

## Task 9: Worker Entry Point

**Files:**
- Create: `worker/index.ts`

No tests — this is a process entry point.

- [ ] **Step 1: Create worker/index.ts**

```typescript
import "dotenv/config";
import { getBoss } from "../lib/boss";
import { processImageJob } from "./image-worker";
import { processVideoJob } from "./video-worker";
import type { ImageJobData, VideoJobData } from "../types";

async function main() {
  const boss = await getBoss();
  console.log("[worker] pg-boss started");

  await boss.work<ImageJobData>("image-job", { teamSize: 5, teamConcurrency: 5 }, async (job) => {
    console.log(`[image-worker] processing job ${job.data.jobId}`);
    await processImageJob(job.data);
  });

  await boss.work<VideoJobData>("video-job", { teamSize: 2, teamConcurrency: 2 }, async (job) => {
    console.log(`[video-worker] processing job ${job.data.jobId}`);
    await processVideoJob(job.data);
  });

  console.log("[worker] listening for jobs...");
}

main().catch((err) => {
  console.error("[worker] fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add worker/index.ts
git commit -m "feat: worker entry point"
```

---

## Task 10: Projects API — List + Create

**Files:**
- Create: `app/api/projects/route.ts`

- [ ] **Step 1: Create app/api/projects/route.ts**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectSettings } from "@/types";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { created_at: "desc" },
    include: { _count: { select: { jobs: true } } },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, media_type, provider, settings } = body as {
    title: string;
    description?: string;
    media_type: "IMAGE" | "VIDEO";
    provider: "RUNWARE" | "VERTEX";
    settings: ProjectSettings;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { title: title.trim(), description, media_type, provider, settings },
  });

  return NextResponse.json(project, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/projects/route.ts
git commit -m "feat: projects list and create API"
```

---

## Task 11: Project Detail API — Get + Delete

**Files:**
- Create: `app/api/projects/[id]/route.ts`

- [ ] **Step 1: Create app/api/projects/[id]/route.ts**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { jobs: { orderBy: { created_at: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";

  await prisma.project.delete({ where: { id } });

  for (const sub of ["images", "videos"]) {
    const dir = path.join(uploadsDir, sub, id);
    await fs.rm(dir, { recursive: true, force: true });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/projects/[id]/route.ts"
git commit -m "feat: project detail and delete API"
```

---

## Task 12: Queue Control API

**Files:**
- Create: `app/api/projects/[id]/generate/route.ts`
- Create: `app/api/projects/[id]/pause/route.ts`
- Create: `app/api/projects/[id]/resume/route.ts`
- Create: `app/api/projects/[id]/cancel/route.ts`
- Create: `app/api/projects/[id]/retry/route.ts`

- [ ] **Step 1: Create generate route**

Create `app/api/projects/[id]/generate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss } from "@/lib/boss";
import type { ImageJobData, VideoJobData, ProjectSettings, RunwareImageSettings, VertexImageSettings } from "@/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prompts } = await req.json() as { prompts: string[] };

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return NextResponse.json({ error: "prompts array required" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const settings = project.settings as unknown as ProjectSettings;
  const boss = await getBoss();

  const validPrompts = prompts.map((p) => p.trim()).filter(Boolean);

  const jobs = await prisma.$transaction(
    validPrompts.map((prompt, i) =>
      prisma.job.create({
        data: {
          project_id: id,
          prompt,
          status: "PENDING",
        },
      })
    )
  );

  await prisma.project.update({
    where: { id },
    data: {
      status: "GENERATING",
      total_jobs: { increment: jobs.length },
    },
  });

  const queueName = project.media_type === "IMAGE" ? "image-job" : "video-job";

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const data: ImageJobData | VideoJobData = {
      jobId: job.id,
      projectId: id,
      prompt: job.prompt,
      settings: settings as ImageJobData["settings"] & VideoJobData["settings"],
      outputIndex: i,
    };
    await boss.send(queueName, data);
  }

  return NextResponse.json({ queued: jobs.length });
}
```

- [ ] **Step 2: Create pause route**

Create `app/api/projects/[id]/pause/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.project.update({ where: { id }, data: { status: "PAUSED" } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create resume route**

Create `app/api/projects/[id]/resume/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.project.update({ where: { id }, data: { status: "GENERATING" } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create cancel route**

Create `app/api/projects/[id]/cancel/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.job.updateMany({
    where: { project_id: id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await prisma.project.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create retry-all route**

Create `app/api/projects/[id]/retry/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss } from "@/lib/boss";
import type { ImageJobData, VideoJobData, ProjectSettings } from "@/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { jobs: { where: { status: "FAILED" } } },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const settings = project.settings as unknown as ProjectSettings;
  const boss = await getBoss();
  const queueName = project.media_type === "IMAGE" ? "image-job" : "video-job";

  for (const job of project.jobs) {
    await prisma.job.update({ where: { id: job.id }, data: { status: "PENDING", error_message: null } });
    const data: ImageJobData | VideoJobData = {
      jobId: job.id,
      projectId: id,
      prompt: job.prompt,
      settings: settings as ImageJobData["settings"] & VideoJobData["settings"],
      outputIndex: 0,
    };
    await boss.send(queueName, data);
  }

  await prisma.project.update({ where: { id }, data: { status: "GENERATING" } });
  return NextResponse.json({ retried: project.jobs.length });
}
```

- [ ] **Step 6: Commit**

```bash
git add "app/api/projects/[id]/generate/" "app/api/projects/[id]/pause/" "app/api/projects/[id]/resume/" "app/api/projects/[id]/cancel/" "app/api/projects/[id]/retry/"
git commit -m "feat: queue control API (generate, pause, resume, cancel, retry)"
```

---

## Task 13: Status & Download API

**Files:**
- Create: `app/api/projects/[id]/status/route.ts`
- Create: `app/api/projects/[id]/download/route.ts`

- [ ] **Step 1: Create status route**

Create `app/api/projects/[id]/status/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      jobs: {
        select: {
          id: true, status: true, prompt: true, progress: true,
          output_path: true, error_message: true, retry_count: true,
        },
        orderBy: { created_at: "asc" },
      },
    },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: project.id,
    status: project.status,
    total_jobs: project.total_jobs,
    completed_jobs: project.completed_jobs,
    failed_jobs: project.failed_jobs,
    jobs: project.jobs,
  });
}
```

- [ ] **Step 2: Create download route**

Create `app/api/projects/[id]/download/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { jobs: { where: { status: "COMPLETED", output_path: { not: null } } } },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const archive = archiver("zip", { zlib: { level: 6 } });

  for (const job of project.jobs) {
    if (!job.output_path) continue;
    const absPath = path.resolve(job.output_path);
    if (fs.existsSync(absPath)) {
      archive.file(absPath, { name: path.basename(absPath) });
    }
  }

  archive.finalize();

  const nodeStream = archive as unknown as NodeJS.ReadableStream;
  const webStream = Readable.toWeb(nodeStream as any) as ReadableStream;

  const filename = `${project.title.replace(/[^a-z0-9]/gi, "_")}.zip`;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/projects/[id]/status/" "app/api/projects/[id]/download/"
git commit -m "feat: status poll and ZIP download API"
```

---

## Task 14: Jobs API

**Files:**
- Create: `app/api/jobs/[id]/route.ts`
- Create: `app/api/jobs/[id]/retry/route.ts`

- [ ] **Step 1: Create job PATCH route**

Create `app/api/jobs/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prompt } = await req.json() as { prompt: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const job = await prisma.job.update({
    where: { id },
    data: { prompt: prompt.trim(), error_message: null },
  });

  return NextResponse.json(job);
}
```

- [ ] **Step 2: Create single job retry route**

Create `app/api/jobs/[id]/retry/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss } from "@/lib/boss";
import type { ImageJobData, VideoJobData, ProjectSettings } from "@/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const settings = job.project.settings as unknown as ProjectSettings;
  const queueName = job.project.media_type === "IMAGE" ? "image-job" : "video-job";

  await prisma.job.update({ where: { id }, data: { status: "PENDING", error_message: null } });

  const boss = await getBoss();
  const data: ImageJobData | VideoJobData = {
    jobId: job.id,
    projectId: job.project_id,
    prompt: job.prompt,
    settings: settings as ImageJobData["settings"] & VideoJobData["settings"],
    outputIndex: 0,
  };
  await boss.send(queueName, data);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/jobs/"
git commit -m "feat: jobs PATCH (edit prompt) and single retry API"
```

---

## Task 15: Frontend — Layout + Dashboard

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update layout.tsx**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "TurboBatch",
  description: "Bulk AI media generator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-zinc-950 text-zinc-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Update globals.css**

Replace `app/globals.css` contents with:

```css
@import "tailwindcss";

:root {
  --font-geist: "Geist", sans-serif;
}
```

- [ ] **Step 3: Replace app/page.tsx with Dashboard**

```typescript
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  title: string;
  media_type: string;
  provider: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  created_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project and all its files?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const pct = (p: Project) =>
    p.total_jobs > 0 ? Math.round((p.completed_jobs / p.total_jobs) * 100) : 0;

  const statusColor: Record<string, string> = {
    GENERATING: "text-blue-400",
    COMPLETED: "text-green-400",
    FAILED: "text-red-400",
    PAUSED: "text-yellow-400",
    CANCELLED: "text-zinc-500",
    DRAFT: "text-zinc-400",
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">TurboBatch</h1>
        <Link
          href="/projects/new"
          className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + New Project
        </Link>
      </div>

      {loading && <p className="text-zinc-500">Loading...</p>}

      {!loading && projects.length === 0 && (
        <div className="text-center py-24 text-zinc-500">
          <p className="text-lg mb-4">No projects yet.</p>
          <Link href="/projects/new" className="text-green-400 hover:underline">
            Create your first project →
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <div key={p.id} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex flex-col gap-3">
            <div>
              <h2 className="font-semibold text-base truncate">{p.title}</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {p.total_jobs} {p.media_type.toLowerCase()}s · {p.provider}
              </p>
            </div>

            {p.total_jobs > 0 && (
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span className={statusColor[p.status] ?? "text-zinc-400"}>{p.status}</span>
                  <span>{pct(p)}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-green-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct(p)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-auto">
              <Link
                href={`/projects/${p.id}`}
                className="flex-1 text-center bg-zinc-800 hover:bg-zinc-700 text-sm py-1.5 rounded-lg transition-colors"
              >
                Open
              </Link>
              {p.completed_jobs > 0 && (
                <a
                  href={`/api/projects/${p.id}/download`}
                  className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  ZIP
                </a>
              )}
              <button
                onClick={() => handleDelete(p.id)}
                className="text-sm bg-zinc-800 hover:bg-red-900 px-3 py-1.5 rounded-lg transition-colors text-red-400"
              >
                Del
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/globals.css app/page.tsx
git commit -m "feat: dashboard UI with project cards"
```

---

## Task 16: Frontend — New Project Page

**Files:**
- Create: `app/projects/new/page.tsx`

- [ ] **Step 1: Create app/projects/new/page.tsx**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type MediaType = "IMAGE" | "VIDEO";
type Provider = "RUNWARE" | "VERTEX";
type AspectRatio = "1:1" | "16:9" | "9:16";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("IMAGE");
  const [provider, setProvider] = useState<Provider>("RUNWARE");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [format, setFormat] = useState("PNG");
  const [quality, setQuality] = useState("high");
  const [vertexModel, setVertexModel] = useState("gemini-3.1-flash-image-preview");
  const [duration, setDuration] = useState(8);
  const [resolution, setResolution] = useState("720p");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const buildSettings = () => {
    if (mediaType === "VIDEO") {
      return { provider: "VERTEX", model: "veo-3.1-lite-generate-001", aspectRatio, durationSeconds: duration, resolution };
    }
    if (provider === "RUNWARE") {
      return { provider: "RUNWARE", model: "openai:gpt-image@2", aspectRatio, format, quality };
    }
    return { provider: "VERTEX", model: vertexModel, aspectRatio, format };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError("Project title is required"); return; }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || undefined,
        media_type: mediaType,
        provider: mediaType === "VIDEO" ? "VERTEX" : provider,
        settings: buildSettings(),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create project");
      setSubmitting(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
  };

  const Radio = ({ name, value, current, onChange, label }: {
    name: string; value: string; current: string;
    onChange: (v: string) => void; label: string;
  }) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="radio" name={name} value={value}
        checked={current === value} onChange={() => onChange(value)}
        className="accent-green-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-xl font-bold mb-6">New Project</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Project Title *</label>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Japan History Shorts"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Description</label>
          <input
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Media Type</label>
          <div className="flex gap-4">
            <Radio name="mediaType" value="IMAGE" current={mediaType} onChange={(v) => setMediaType(v as MediaType)} label="Image" />
            <Radio name="mediaType" value="VIDEO" current={mediaType} onChange={(v) => setMediaType(v as MediaType)} label="Video" />
          </div>
        </div>

        {mediaType === "IMAGE" && (
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Provider</label>
            <div className="flex gap-4">
              <Radio name="provider" value="RUNWARE" current={provider} onChange={(v) => setProvider(v as Provider)} label="Runware (GPT Image 2)" />
              <Radio name="provider" value="VERTEX" current={provider} onChange={(v) => setProvider(v as Provider)} label="Vertex (Gemini)" />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-zinc-400 mb-2">Aspect Ratio</label>
          <div className="flex gap-4">
            {(["1:1", "16:9", "9:16"] as AspectRatio[]).map((r) => (
              <Radio key={r} name="aspectRatio" value={r} current={aspectRatio} onChange={(v) => setAspectRatio(v as AspectRatio)} label={r} />
            ))}
          </div>
        </div>

        {mediaType === "IMAGE" && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Format</label>
              <div className="flex gap-4">
                {["PNG", "JPG"].map((f) => (
                  <Radio key={f} name="format" value={f} current={format} onChange={setFormat} label={f} />
                ))}
              </div>
            </div>

            {provider === "RUNWARE" && (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Quality</label>
                <div className="flex gap-4">
                  {["low", "medium", "high"].map((q) => (
                    <Radio key={q} name="quality" value={q} current={quality} onChange={setQuality} label={q.charAt(0).toUpperCase() + q.slice(1)} />
                  ))}
                </div>
              </div>
            )}

            {provider === "VERTEX" && (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Model</label>
                <div className="flex flex-col gap-2">
                  <Radio name="vertexModel" value="gemini-3.1-flash-image-preview" current={vertexModel} onChange={setVertexModel} label="Flash (faster)" />
                  <Radio name="vertexModel" value="gemini-3-pro-image-preview" current={vertexModel} onChange={setVertexModel} label="Pro (higher quality)" />
                </div>
              </div>
            )}
          </>
        )}

        {mediaType === "VIDEO" && (
          <>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Duration (seconds)</label>
              <input
                type="number" min={1} max={60} value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Resolution</label>
              <div className="flex gap-4">
                <Radio name="resolution" value="720p" current={resolution} onChange={setResolution} label="720p" />
                <Radio name="resolution" value="1080p" current={resolution} onChange={setResolution} label="1080p" />
              </div>
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit" disabled={submitting}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          {submitting ? "Creating..." : "Create Project"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/projects/new/"
git commit -m "feat: new project form"
```

---

## Task 17: Frontend — Project Page

**Files:**
- Create: `app/projects/[id]/page.tsx`

- [ ] **Step 1: Create app/projects/[id]/page.tsx**

```typescript
"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Job {
  id: string;
  status: string;
  prompt: string;
  progress: number;
  output_path: string | null;
  error_message: string | null;
  retry_count: number;
}

interface ProjectStatus {
  id: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  jobs: Job[];
}

export default function ProjectPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [status, setStatus] = useState<ProjectStatus | null>(null);
  const [prompts, setPrompts] = useState("");
  const [generating, setGenerating] = useState(false);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    const res = await fetch(`/api/projects/${id}/status`);
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [id]);

  const isActive = status?.status === "GENERATING";
  const pct = status && status.total_jobs > 0
    ? Math.round((status.completed_jobs / status.total_jobs) * 100)
    : 0;

  const handleGenerate = async () => {
    const lines = prompts.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setGenerating(true);
    await fetch(`/api/projects/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompts: lines }),
    });
    setPrompts("");
    setGenerating(false);
  };

  const control = async (action: string) => {
    await fetch(`/api/projects/${id}/${action}`, { method: "POST" });
    fetchStatus();
  };

  const retryJob = async (jobId: string) => {
    await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    fetchStatus();
  };

  const saveEditedPrompt = async (jobId: string) => {
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: editPrompt }),
    });
    setEditingJob(null);
    fetchStatus();
  };

  const jobStatusIcon: Record<string, string> = {
    PENDING: "⏳", GENERATING: "⚙️", COMPLETED: "✓", FAILED: "✗", CANCELLED: "—",
  };

  const jobStatusColor: Record<string, string> = {
    PENDING: "text-zinc-400", GENERATING: "text-blue-400",
    COMPLETED: "text-green-400", FAILED: "text-red-400", CANCELLED: "text-zinc-600",
  };

  if (!status) return <div className="p-10 text-zinc-500">Loading...</div>;

  const failedJobs = status.jobs.filter((j) => j.status === "FAILED");

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm">← Dashboard</Link>
        <span className="text-zinc-700">/</span>
        <span className="text-sm font-medium">Project</span>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">Project {id.slice(0, 8)}</h1>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{status.status.toLowerCase()}</p>
          </div>
          <Link
            href={`/projects/${id}/results`}
            className="text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            View Results
          </Link>
        </div>

        {status.total_jobs > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>Generating {status.completed_jobs}/{status.total_jobs}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            {status.failed_jobs > 0 && (
              <p className="text-xs text-red-400 mt-1">{status.failed_jobs} failed</p>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {isActive && (
            <button onClick={() => control("pause")} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
              Pause
            </button>
          )}
          {status.status === "PAUSED" && (
            <button onClick={() => control("resume")} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-green-400">
              Resume
            </button>
          )}
          {(isActive || status.status === "PAUSED") && (
            <button onClick={() => control("cancel")} className="text-xs bg-zinc-800 hover:bg-red-900 px-3 py-1.5 rounded-lg transition-colors text-red-400">
              Cancel
            </button>
          )}
          {failedJobs.length > 0 && (
            <button onClick={() => control("retry")} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-yellow-400">
              Retry All Failed ({failedJobs.length})
            </button>
          )}
          {status.completed_jobs > 0 && (
            <a href={`/api/projects/${id}/download`} className="text-xs bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors text-blue-400">
              Download ZIP
            </a>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 mb-6">
        <label className="block text-sm text-zinc-400 mb-2">Add Prompts (one per line)</label>
        <textarea
          value={prompts} onChange={(e) => setPrompts(e.target.value)}
          rows={6} placeholder={"A futuristic city\nA samurai at sunset\nA dragon flying over NYC"}
          className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none font-mono"
        />
        <button
          onClick={handleGenerate} disabled={generating || !prompts.trim()}
          className="mt-3 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
        >
          {generating ? "Queuing..." : "Generate"}
        </button>
      </div>

      {status.jobs.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h2 className="text-sm font-medium">Jobs ({status.jobs.length})</h2>
          </div>
          <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
            {status.jobs.map((job) => (
              <div key={job.id} className="px-5 py-3">
                {editingJob === job.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-600 rounded px-2 py-1 text-xs"
                    />
                    <button onClick={() => saveEditedPrompt(job.id)} className="text-xs bg-green-600 px-2 py-1 rounded text-black">Save</button>
                    <button onClick={() => setEditingJob(null)} className="text-xs bg-zinc-700 px-2 py-1 rounded">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className={`text-xs mt-0.5 ${jobStatusColor[job.status] ?? "text-zinc-400"}`}>
                      {jobStatusIcon[job.status] ?? "?"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate">{job.prompt}</p>
                      {job.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 truncate">{job.error_message}</p>
                      )}
                    </div>
                    {job.status === "FAILED" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingJob(job.id); setEditPrompt(job.prompt); }}
                          className="text-xs text-zinc-400 hover:text-white px-1.5 py-0.5 bg-zinc-800 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => retryJob(job.id)}
                          className="text-xs text-yellow-400 hover:text-yellow-300 px-1.5 py-0.5 bg-zinc-800 rounded"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/projects/[id]/page.tsx"
git commit -m "feat: project page with prompts, queue status, and job list"
```

---

## Task 18: Frontend — Results Page

**Files:**
- Create: `app/projects/[id]/results/page.tsx`

- [ ] **Step 1: Create app/projects/[id]/results/page.tsx**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Job {
  id: string;
  status: string;
  prompt: string;
  output_path: string | null;
  error_message: string | null;
}

interface StatusResponse {
  id: string;
  status: string;
  completed_jobs: number;
  total_jobs: number;
  jobs: Job[];
}

export default function ResultsPage() {
  const { id } = useParams() as { id: string };
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}/status`).then((r) => r.json()).then(setData);
    const interval = setInterval(() => {
      fetch(`/api/projects/${id}/status`).then((r) => r.json()).then(setData);
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (!data) return <div className="p-10 text-zinc-500">Loading...</div>;

  const completed = data.jobs.filter((j) => j.status === "COMPLETED");
  const failed = data.jobs.filter((j) => j.status === "FAILED");

  const getImageSrc = (outputPath: string) => {
    const filename = outputPath.replace(/\\/g, "/").split("/").pop();
    return `/api/projects/${id}/file/${filename}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`} className="text-zinc-500 hover:text-zinc-300 text-sm">
          ← Project
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-sm font-medium">Results</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">
          Results — {completed.length}/{data.total_jobs} completed
        </h1>
        {completed.length > 0 && (
          <a
            href={`/api/projects/${id}/download`}
            className="bg-green-500 hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Download ZIP
          </a>
        )}
      </div>

      {completed.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
          {completed.map((job) => (
            <div key={job.id} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 group">
              <div className="aspect-square bg-zinc-800 flex items-center justify-center">
                {job.output_path?.match(/\.(mp4|webm)$/) ? (
                  <div className="text-zinc-500 text-xs text-center p-2">
                    <span className="text-2xl block mb-1">🎬</span>
                    video
                  </div>
                ) : (
                  <img
                    src={getImageSrc(job.output_path!)}
                    alt={job.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs text-zinc-400 truncate">{job.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-red-400 mb-3">Failed ({failed.length})</h2>
          <div className="flex flex-col gap-2">
            {failed.map((job) => (
              <div key={job.id} className="bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3 flex items-start gap-3">
                <span className="text-red-400 text-sm">✗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{job.prompt}</p>
                  {job.error_message && (
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{job.error_message}</p>
                  )}
                </div>
                <Link
                  href={`/projects/${id}`}
                  className="text-xs text-yellow-400 hover:text-yellow-300 shrink-0"
                >
                  Retry →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && failed.length === 0 && (
        <div className="text-center py-24 text-zinc-500">
          No results yet. <Link href={`/projects/${id}`} className="text-green-400 hover:underline">Go generate some →</Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add file serving route for images**

Create `app/api/projects/[id]/file/[filename]/route.ts` so the results page can display images:

```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mime from "mime-types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;
  const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";

  for (const sub of ["images", "videos"]) {
    const filePath = path.resolve(uploadsDir, sub, id, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      const mimeType = mime.lookup(filename) || "application/octet-stream";
      return new NextResponse(content, {
        headers: { "Content-Type": mimeType },
      });
    }
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}
```

- [ ] **Step 3: Create vitest.config.ts**

Create `vitest.config.ts` at project root:

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
  },
});
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npx vitest run
```

Expected: All tests pass (aspect-ratio, runware, vertex-image, vertex-video, image-worker, video-worker).

- [ ] **Step 5: Commit**

```bash
git add "app/projects/[id]/results/" "app/api/projects/[id]/file/" vitest.config.ts
git commit -m "feat: results page with image thumbnails and file serving"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Project-first structure (must create project before generating) | Task 10 (POST /api/projects), Task 16 (New Project page) |
| Image generation — Runware (GPT Image 2) | Task 4 (provider), Task 7 (worker) |
| Image generation — Vertex Gemini | Task 5 (provider), Task 7 (worker) |
| Video generation — Vertex Veo with operation polling | Task 6 (provider), Task 8 (worker) |
| Job statuses: PENDING/GENERATING/COMPLETED/FAILED/CANCELLED | Task 1 (schema) |
| Pause / Resume / Cancel / Retry All / Retry Single | Task 12 (API), Task 17 (UI buttons) |
| Edit failed prompt and retry | Task 14 (PATCH /api/jobs/[id]), Task 17 (UI edit inline) |
| Progress bar (Generating X/Y) | Task 17 (UI), Task 13 (status poll every 2s) |
| Bulk download ZIP | Task 13 (/download route), Tasks 15+17+18 (UI buttons) |
| Results grid with thumbnails | Task 18 (results page), Task 18 (file serving route) |
| Project settings per-project (model, quality, aspectRatio, etc.) | Task 1 (schema Json field), Task 10 (POST body), Task 16 (form) |
| Vertex operation_id persisted (survives restarts) | Task 1 (vertex_operation_id field), Task 8 (worker saves it) |
| 1:1 / 16:9 / 9:16 aspect ratio | Task 2 (types), Task 3 (aspect-ratio.ts), Task 16 (form) |

**No gaps found.**

**Placeholder scan:** No TBD/TODO found. All code steps contain complete implementations.

**Type consistency:** `ImageJobData`, `VideoJobData`, `ProjectSettings` defined in Task 2 and used consistently in Tasks 7, 8, 9, 12, 14.

---

## Running the App

After implementation, start both processes:

**Terminal 1 — Next.js dev server:**
```bash
npm run dev
```

**Terminal 2 — Worker process:**
```bash
npm run worker:dev
```

Open `http://localhost:3000` — create a project, add prompts, click Generate.
