import { NextResponse } from "next/server";

export function apiError(err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const isDbError =
    message.includes("ECONNREFUSED") ||
    message.includes("connect ETIMEDOUT") ||
    message.includes("PrismaClientKnownRequestError") ||
    message.includes("Can't reach database");

  const friendly = isDbError
    ? "Database not connected. Set DATABASE_URL in Settings and restart the server."
    : message;

  console.error("[api]", message);
  return NextResponse.json({ error: friendly }, { status });
}
