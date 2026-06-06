import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ApiError } from "../shared/types";
import type { AppEnv } from "./env";

export class HttpError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
): Response {
  return c.json<ApiError>({ error: { code, message } }, status);
}

export function ensureSameOrigin(c: Context<AppEnv>): void {
  const origin = c.req.header("Origin");
  if (!origin) {
    throw new HttpError(403, "missing_origin", "Originヘッダーが必要です。");
  }
  const requestUrl = new URL(c.req.url);
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new HttpError(403, "bad_origin", "別のOriginからの操作はできません。");
  }
  if (originUrl.host !== requestUrl.host || originUrl.protocol !== requestUrl.protocol) {
    throw new HttpError(403, "bad_origin", "別のOriginからの操作はできません。");
  }
}
