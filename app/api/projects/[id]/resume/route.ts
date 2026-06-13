import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.project.update({ where: { id }, data: { status: "GENERATING" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
