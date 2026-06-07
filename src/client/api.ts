import type {
  ApiError,
  CreateGameResponse,
  GameMode,
  GameEventsResponse,
  GameResponse,
  GamesResponse,
  MoveResponse,
  SessionPayload,
} from "../shared/types";

type JsonBody = Record<string, unknown>;

export type CreateGameInput = {
  mode: GameMode;
  passcode?: string;
};

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function getSession(): Promise<SessionPayload> {
  return api<SessionPayload>("/api/session");
}

export async function registerAccount(input: JsonBody): Promise<SessionPayload> {
  return api<SessionPayload>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginAccount(input: JsonBody): Promise<SessionPayload> {
  return api<SessionPayload>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logoutAccount(): Promise<SessionPayload> {
  return api<SessionPayload>("/api/auth/logout", { method: "POST" });
}

export async function updateProfile(input: JsonBody): Promise<SessionPayload> {
  return api<SessionPayload>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function listGames(): Promise<GamesResponse> {
  return api<GamesResponse>("/api/games");
}

export async function createGame(input: CreateGameInput): Promise<CreateGameResponse> {
  return api<CreateGameResponse>("/api/games", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getGame(gameId: string): Promise<GameResponse> {
  return api<GameResponse>(`/api/games/${gameId}`, {}, 1);
}

export async function playMove(gameId: string, usi: string, requestId: string): Promise<MoveResponse> {
  return api<MoveResponse>(
    `/api/games/${gameId}/moves`,
    {
      method: "POST",
      body: JSON.stringify({ usi, requestId }),
    },
    1,
  );
}

export async function resignGame(gameId: string, requestId: string): Promise<GameResponse> {
  return api<GameResponse>(
    `/api/games/${gameId}/resign`,
    {
      method: "POST",
      body: JSON.stringify({ requestId }),
    },
    1,
  );
}

export async function getGameEvents(gameId: string, afterSeq: number): Promise<GameEventsResponse> {
  return api<GameEventsResponse>(`/api/games/${gameId}/events?after=${String(afterSeq)}`, {}, 1);
}

async function api<T>(path: string, init: RequestInit = {}, retries = 0): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(path, {
        ...init,
        headers,
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const payload: T = await response.json();
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await sleep(350 * (attempt + 1));
    }
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new ApiClientError("network_error", "通信に失敗しました。", 0);
}

async function toApiError(response: Response): Promise<ApiClientError> {
  try {
    const payload: ApiError = await response.json();
    return new ApiClientError(payload.error.code, payload.error.message, response.status);
  } catch {
    return new ApiClientError("http_error", `HTTP ${String(response.status)}`, response.status);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
