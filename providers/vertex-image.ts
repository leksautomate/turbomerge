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
  const imagePart = (parts as any[]).find((p: any) => p.inlineData?.data);

  if (!imagePart?.inlineData) {
    throw new Error(`Vertex image: no inline image in response`);
  }

  return {
    base64: imagePart.inlineData.data as string,
    mimeType: imagePart.inlineData.mimeType as string,
  };
}
