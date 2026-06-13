import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.project.update({ where: { id }, data: { status: "PAUSED" } });
  return NextResponse.json({ ok: true });
}
