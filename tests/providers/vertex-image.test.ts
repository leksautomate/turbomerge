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
