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
