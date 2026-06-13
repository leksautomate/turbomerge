import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss } from "@/lib/boss";
import { apiError } from "@/lib/api-error";
import type { ImageJobData, VideoJobData, ProjectSettings } from "@/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await prisma.job.findUnique({ where: { id }, include: { project: true } });
    if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

    const settings = job.project.settings as unknown as ProjectSettings;
    const queueName = job.project.media_type === "IMAGE" ? "image-job" : "video-job";

    await prisma.job.update({ where: { id }, data: { status: "PENDING", error_message: null } });

    const boss = await getBoss();
    const data: ImageJobData | VideoJobData = {
      jobId: job.id,
      projectId: job.project_id,
      prompt: job.prompt,
      settings: settings as ImageJobData["settings"] & VideoJobData["settings"],
      outputIndex: 0,
    };
    await boss.send(queueName, data);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
