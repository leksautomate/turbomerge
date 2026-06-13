import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import mime from "mime-types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;
  const uploadsDir = process.env.UPLOADS_DIR ?? "uploads";

  for (const sub of ["images", "videos"]) {
    const filePath = path.resolve(uploadsDir, sub, id, filename);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath);
      const mimeType = mime.lookup(filename) || "application/octet-stream";
      return new NextResponse(content, {
        headers: { "Content-Type": mimeType },
      });
    }
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}
