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
