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
