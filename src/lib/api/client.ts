import type {
  ApiErrorBody,
  ApiErrorCode,
  GuessResponse,
  PlayResponse,
  StartQuestionResponse,
  SummaryResponse,
  TimeoutResponse,
} from "./types";

export class ApiClientError extends Error {
  constructor(
    readonly code: ApiErrorCode | "network",
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init?.method ?? "POST",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiClientError("network", "Netzwerkfehler");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const body = json as ApiErrorBody | null;
    throw new ApiClientError(body?.error ?? "internal", body?.message ?? res.statusText);
  }
  return json as T;
}

export const api = {
  startPlay: (date: string, locale: string) => call<PlayResponse>("/play", { body: { date, locale } }),
  startQuestion: (playId: string, position: number) =>
    call<StartQuestionResponse>(`/play/${playId}/questions/${position}/start`),
  guess: (playId: string, position: number, input: string) =>
    call<GuessResponse>(`/play/${playId}/questions/${position}/guess`, { body: { input } }),
  timeout: (playId: string, position: number) =>
    call<TimeoutResponse>(`/play/${playId}/questions/${position}/timeout`),
  summary: (playId: string) => call<SummaryResponse>(`/play/${playId}/summary`, { method: "GET" }),
};
