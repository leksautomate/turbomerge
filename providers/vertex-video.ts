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
