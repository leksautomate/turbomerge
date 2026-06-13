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
    expect(mockPrismaProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proj-1" },
        data: { completed_jobs: { increment: 1 } },
      })
    );
  });
});
