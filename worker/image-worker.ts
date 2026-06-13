import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";
import { generateRunwareImage } from "../providers/runware";
import { generateVertexImage } from "../providers/vertex-image";
import { toRunwareDimensions } from "../lib/aspect-ratio";
import type { ImageJobData } from "../types";

export async function processImageJob(data: ImageJobData): Promise<void> {
  const { jobId, projectId, prompt, settings, outputIndex } = data;
  const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";
  const outDir = path.join(uploadsDir, "images", projectId);

  await prisma.job.update({ where: { id: jobId }, data: { status: "GENERATING" } });

  try {
    const ext = settings.format.toLowerCase();
    const outFile = path.join(outDir, `${outputIndex}.${ext}`);
    await fs.mkdir(outDir, { recursive: true });

    if (settings.provider === "RUNWARE") {
      const dims = toRunwareDimensions(settings.aspectRatio);
      const imageUrl = await generateRunwareImage({
        prompt,
        width: dims.width,
        height: dims.height,
        format: settings.format,
        quality: settings.quality,
      });
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(outFile, buf);
    } else {
      const result = await generateVertexImage({
        prompt,
        model: settings.model,
        aspectRatio: settings.aspectRatio,
        format: settings.format,
      });
      const buf = Buffer.from(result.base64, "base64");
      await fs.writeFile(outFile, buf);
    }

    await prisma.job.update({
      where: { id: jobId },
      data: { status: "COMPLETED", output_path: outFile, progress: 100 },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        completed_jobs: { increment: 1 },
      },
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
