import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { prompt } = await req.json() as { prompt: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const job = await prisma.job.update({
    where: { id },
    data: { prompt: prompt.trim(), error_message: null },
  });

  return NextResponse.json(job);
}
