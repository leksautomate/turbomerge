import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        jobs: {
          select: {
            id: true, status: true, prompt: true, progress: true,
            output_path: true, error_message: true, retry_count: true,
          },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json({
      id: project.id,
      status: project.status,
      total_jobs: project.total_jobs,
      completed_jobs: project.completed_jobs,
      failed_jobs: project.failed_jobs,
      jobs: project.jobs,
    });
  } catch (err) {
    return apiError(err);
  }
}
