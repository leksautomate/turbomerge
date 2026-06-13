import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaUpdate = vi.fn().mockResolvedValue({});
const mockPrismaProjectUpdate = vi.fn().mockResolvedValue({});

vi.mock("../../lib/prisma", () => ({
  prisma: {
    job: { update: mockPrismaUpdate },
    project: { update: mockPrismaProjectUpdate },
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

describe("processImageJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPLOADS_DIR = "uploads";

    // Mock global fetch for downloading the image URL
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
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

    // Should have updated job to GENERATING then COMPLETED
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      })
    );
    // Should have incremented completed_jobs on project
    expect(mockPrismaProjectUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "proj-1" },
        data: { completed_jobs: { increment: 1 } },
      })
    );
  });
});
