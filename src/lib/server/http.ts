import "server-only";
import { cookies } from "next/headers";
import type { ApiErrorBody, ApiErrorCode } from "@/lib/api/types";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  invalid_date: 400,
  unauthorized: 401,
  not_found: 404,
  no_puzzle: 404,
  out_of_order: 409,
  not_started: 409,
  already_answered: 409,
  unfinished: 409,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Runs a route handler body and maps thrown ApiErrors to JSON responses. */
export async function respond<T>(fn: () => Promise<T>): Promise<Response> {
  try {
    return Response.json(await fn());
  } catch (err) {
    const apiError = err instanceof ApiError ? err : null;
    if (!apiError) console.error(err);
    const body: ApiErrorBody = apiError
      ? { error: apiError.code, message: apiError.message }
      : { error: "internal", message: "Interner Fehler" };
    return Response.json(body, { status: STATUS[body.error] });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ApiError("bad_request", "JSON-Body erwartet");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseUuid(value: string): string {
  if (!UUID.test(value)) throw new ApiError("not_found", "Unbekanntes Spiel");
  return value.toLowerCase();
}

export function parsePosition(value: string, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new ApiError("not_found", "Unbekannte Frage");
  return n;
}

const PLAYER_COOKIE = "pid";

/** Anonymous player id from the `pid` cookie; created on demand. */
export async function playerId({ create }: { create: boolean }): Promise<string> {
  const store = await cookies();
  const existing = store.get(PLAYER_COOKIE)?.value;
  if (existing && UUID.test(existing)) return existing.toLowerCase();
  if (!create) throw new ApiError("unauthorized", "Kein Spieler-Cookie");

  const id = crypto.randomUUID();
  store.set({
    name: PLAYER_COOKIE,
    value: id,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  });
  return id;
}
