import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export function idempotencyKey(request: Request) {
  return request.headers.get("idempotency-key") ?? crypto.randomUUID();
}
