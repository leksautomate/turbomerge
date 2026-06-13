import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { jobs: { where: { status: "COMPLETED", output_path: { not: null } } } },
  });
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const archive = archiver("zip", { zlib: { level: 6 } });

  for (const job of project.jobs) {
    if (!job.output_path) continue;
    const absPath = path.resolve(job.output_path);
    if (fs.existsSync(absPath)) {
      archive.file(absPath, { name: path.basename(absPath) });
    }
  }

  archive.finalize();

  const nodeStream = archive as unknown as NodeJS.ReadableStream;
  const webStream = Readable.toWeb(nodeStream as any) as ReadableStream;

  const filename = `${project.title.replace(/[^a-z0-9]/gi, "_")}.zip`;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
