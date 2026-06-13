import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBoss } from "@/lib/boss";
import { apiError } from "@/lib/api-error";
import type { ImageJobData, VideoJobData, ProjectSettings } from "@/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { prompts } = await req.json() as { prompts: string[] };

    if (!Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: "prompts array required" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

    const settings = project.settings as unknown as ProjectSettings;
    const boss = await getBoss();
    const validPrompts = prompts.map((p) => p.trim()).filter(Boolean);

    const jobs = await prisma.$transaction(
      validPrompts.map((prompt) =>
        prisma.job.create({ data: { project_id: id, prompt, status: "PENDING" } })
      )
    );

    await prisma.project.update({
      where: { id },
      data: { status: "GENERATING", total_jobs: { increment: jobs.length } },
    });

    const queueName = project.media_type === "IMAGE" ? "image-job" : "video-job";
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const data: ImageJobData | VideoJobData = {
        jobId: job.id,
        projectId: id,
        prompt: job.prompt,
        settings: settings as ImageJobData["settings"] & VideoJobData["settings"],
        outputIndex: i,
      };
      await boss.send(queueName, data);
    }

    return NextResponse.json({ queued: jobs.length });
  } catch (err) {
    return apiError(err);
  }
}
