import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ProjectSettings } from "@/types";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { created_at: "desc" },
    include: { _count: { select: { jobs: true } } },
  });
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, media_type, provider, settings } = body as {
    title: string;
    description?: string;
    media_type: "IMAGE" | "VIDEO";
    provider: "RUNWARE" | "VERTEX";
    settings: ProjectSettings;
  };

  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: { title: title.trim(), description, media_type, provider, settings: settings as object },
  });

  return NextResponse.json(project, { status: 201 });
}
