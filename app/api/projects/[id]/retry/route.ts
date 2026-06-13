import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss } from "@/lib/boss";
import { apiError } from "@/lib/api-error";
import type { ImageJobData, VideoJobData, ProjectSettings } from "@/types";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { jobs: { where: { status: "FAILED" } } },
    });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

    const settings = project.settings as unknown as ProjectSettings;
    const boss = await getBoss();
    const queueName = project.media_type === "IMAGE" ? "image-job" : "video-job";

    for (const job of project.jobs) {
      await prisma.job.update({ where: { id: job.id }, data: { status: "PENDING", error_message: null } });
      const data: ImageJobData | VideoJobData = {
        jobId: job.id,
        projectId: id,
        prompt: job.prompt,
        settings: settings as ImageJobData["settings"] & VideoJobData["settings"],
        outputIndex: 0,
      };
      await boss.send(queueName, data);
    }

    await prisma.project.update({ where: { id }, data: { status: "GENERATING" } });
    return NextResponse.json({ retried: project.jobs.length });
  } catch (err) {
    return apiError(err);
  }
}
