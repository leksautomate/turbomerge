import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import fs from "fs/promises";
import path from "path";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { jobs: { orderBy: { created_at: "asc" } } },
    });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";
    await prisma.project.delete({ where: { id } });
    for (const sub of ["images", "videos"]) {
      const dir = path.join(uploadsDir, sub, id);
      await fs.rm(dir, { recursive: true, force: true });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
