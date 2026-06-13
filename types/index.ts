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
