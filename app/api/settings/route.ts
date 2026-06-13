import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

const KNOWN_KEYS = [
  "RUNWARE_API_KEY",
  "DATABASE_URL",
  "VERTEX_PROJECT_ID",
  "VERTEX_LOCATION_ID",
  "IMAGE_MODEL",
  "IMAGE_ASPECT_RATIO",
  "IMAGE_CONCURRENCY",
  "VEO_MODEL_ID",
  "VEO_LOCATION_ID",
];

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^([^#=\s]+)\s*=\s*"?([^"]*)"?$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function writeEnv(vars: Record<string, string>): void {
  const lines = Object.entries(vars).map(([k, v]) =>
    v.includes(" ") || v.includes(":") ? `${k}="${v}"` : `${k}=${v}`
  );
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

export async function GET() {
  try {
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
    const vars = parseEnv(content);
    const result: Record<string, string> = {};
    for (const key of KNOWN_KEYS) result[key] = vars[key] ?? "";
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
    const vars = parseEnv(content);
    for (const key of KNOWN_KEYS) {
      if (body[key] !== undefined) vars[key] = body[key];
    }
    writeEnv(vars);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
