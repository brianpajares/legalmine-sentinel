import { NextResponse } from "next/server";

export interface ApiError {
  error: string;
  detail?: string;
  /** Machine-readable hint the UI can branch on. */
  code?: string;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, { status: 200, ...init });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(error: string, detail?: string, code?: string): NextResponse {
  return NextResponse.json({ error, detail, code } satisfies ApiError, { status: 400 });
}

export function notFound(error = "Not found"): NextResponse {
  return NextResponse.json({ error } satisfies ApiError, { status: 404 });
}

export function serverError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: "Internal error", detail: message } satisfies ApiError, {
    status: 500,
  });
}

/** Parses a JSON body, returning null when it is absent or malformed. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
