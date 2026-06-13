import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.job.updateMany({
      where: { project_id: id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await prisma.project.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
