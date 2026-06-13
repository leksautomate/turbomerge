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
