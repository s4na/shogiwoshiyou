import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context, Env as HonoEnv } from "hono";
import { z } from "zod";

import type { GamesResponse, SessionPayload } from "../shared/types";
import { authMiddleware, currentSession, login, logout, register, updateProfile } from "./auth";
import { sha256Hex } from "./crypto";
import type { AppEnv, Env } from "./env";
import { GameRoom } from "./game-room";
import { canViewGame, loadGameEvents, listGameSummariesForUser } from "./game-store";
import { apiError, ensureSameOrigin, HttpError } from "./http";

export { GameRoom };

const app = new Hono<AppEnv>();
const ROBOTS_HEADER = "noindex, nofollow, noarchive, nosnippet, noimageindex";

const handleSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Za-z0-9_]+$/);

const displayNameSchema = z.string().trim().min(1).max(32);
const passwordSchema = z.string().min(8).max(128);

const registerSchema = z.object({
  handle: handleSchema,
  password: passwordSchema,
  termsAccepted: z.literal(true),
});

const loginSchema = z.object({
  handle: handleSchema,
  password: passwordSchema,
});

const profileSchema = z.object({
  displayName: displayNameSchema,
});

const createGameSchema = z.object({
  mode: z.enum(["cpu", "friend"]).default("cpu"),
  passcode: z.string().trim().min(12).max(64).optional(),
});

const moveSchema = z.object({
  usi: z.string().min(4).max(8),
  requestId: z.string().min(20).max(80),
});

const resignSchema = z.object({
  requestId: z.string().min(20).max(80),
});

app.onError((error, c) => {
  c.header("X-Robots-Tag", ROBOTS_HEADER);
  if (error instanceof HttpError) {
    return apiError(c, error.status, error.code, error.message);
  }
  console.error(error);
  return apiError(c, 500, "internal_error", "サーバー内でエラーが発生しました。");
});

app.use("*", async (c, next) => {
  await next();
  c.header("X-Robots-Tag", ROBOTS_HEADER);
});

app.get("/healthz", (c) => c.json({ ok: true }));

app.get("/api/session", async (c) => {
  return c.json<SessionPayload>(await currentSession(c));
});

app.post("/api/auth/register", zValidator("json", registerSchema, validationHook), async (c) => {
  ensureSameOrigin(c);
  const user = await register(c, c.req.valid("json"));
  return c.json<SessionPayload>({ user }, 201);
});

app.post("/api/auth/login", zValidator("json", loginSchema, validationHook), async (c) => {
  ensureSameOrigin(c);
  const user = await login(c, c.req.valid("json"));
  return c.json<SessionPayload>({ user });
});

app.post("/api/auth/logout", async (c) => {
  ensureSameOrigin(c);
  await logout(c);
  return c.json<SessionPayload>({ user: null });
});

app.use("/api/profile", authMiddleware());

app.patch("/api/profile", zValidator("json", profileSchema, validationHook), async (c) => {
  ensureSameOrigin(c);
  const user = await updateProfile(c, c.get("user"), c.req.valid("json"));
  return c.json<SessionPayload>({ user });
});

app.use("/api/games", authMiddleware());
app.use("/api/games/*", authMiddleware());

app.get("/api/games", async (c) => {
  const games = await listGameSummariesForUser(c.env.DB, c.get("user").id);
  return c.json<GamesResponse>({ games });
});

app.post("/api/games", zValidator("json", createGameSchema, validationHook), async (c) => {
  ensureSameOrigin(c);
  const input = c.req.valid("json");
  if (input.mode === "friend") {
    const passcode = input.passcode?.trim();
    if (!passcode) {
      throw new HttpError(400, "passcode_required", "友達対戦には合言葉が必要です。");
    }
    return createOrJoinFriendGame(c.env, c.get("user").id, passcode);
  }
  const gameId = crypto.randomUUID();
  return callGameRoom(c.env, gameId, c.get("user").id, "/create", {
    method: "POST",
    headers: { "x-game-mode": input.mode },
  });
});

app.get("/api/games/:id", async (c) => {
  const gameId = validGameId(c.req.param("id"));
  return callGameRoom(c.env, gameId, c.get("user").id, "/snapshot");
});

app.post("/api/games/:id/moves", zValidator("json", moveSchema, validationHook), async (c) => {
  ensureSameOrigin(c);
  const gameId = validGameId(c.req.param("id"));
  return callGameRoom(c.env, gameId, c.get("user").id, "/move", {
    method: "POST",
    body: JSON.stringify(c.req.valid("json")),
  });
});

app.post("/api/games/:id/resign", zValidator("json", resignSchema, validationHook), async (c) => {
  ensureSameOrigin(c);
  const gameId = validGameId(c.req.param("id"));
  return callGameRoom(c.env, gameId, c.get("user").id, "/resign", {
    method: "POST",
    body: JSON.stringify(c.req.valid("json")),
  });
});

app.get("/api/games/:id/events", async (c) => {
  const gameId = validGameId(c.req.param("id"));
  if (!(await canViewGame(c.env.DB, gameId, c.get("user").id))) {
    throw new HttpError(403, "not_player", "対局者ではありません。");
  }
  const after = Number(c.req.query("after") ?? "0");
  if (!Number.isInteger(after) || after < 0) {
    throw new HttpError(400, "bad_after", "after は0以上の整数で指定してください。");
  }
  return c.json({ events: await loadGameEvents(c.env.DB, gameId, after) });
});

app.get("/api/games/:id/ws", async (c) => {
  ensureSameOrigin(c);
  const gameId = validGameId(c.req.param("id"));
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-user-id", c.get("user").id);
  const id = c.env.GAME_ROOM.idFromName(gameId);
  const stub = c.env.GAME_ROOM.get(id);
  return stub.fetch("https://game-room/ws", {
    method: "GET",
    headers,
  });
});

export default app;

function callGameRoom(
  env: Env,
  gameId: string,
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const id = env.GAME_ROOM.idFromName(gameId);
  const stub = env.GAME_ROOM.get(id);
  const headers = new Headers(init.headers);
  headers.set("x-user-id", userId);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return stub.fetch(`https://game-room${path}`, {
    ...init,
    headers,
  });
}

async function createOrJoinFriendGame(
  env: Env,
  userId: string,
  passcode: string,
): Promise<Response> {
  const gameId = friendGameId(await sha256Hex(passcode));
  return callGameRoom(env, gameId, userId, "/friend-lobby", {
    method: "POST",
  });
}

function validationHook(
  result: { success: true } | { success: false },
  c: Context<HonoEnv, string>,
): Response | undefined {
  if (!result.success) {
    return c.json(
      { error: { code: "validation_error", message: "入力内容を確認してください。" } },
      400,
    );
  }
  return undefined;
}

function validGameId(value: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    throw new HttpError(400, "bad_game_id", "対局IDが不正です。");
  }
  return value;
}

function friendGameId(hashHex: string): string {
  const hex = hashHex.slice(0, 32).split("");
  hex[12] = "4";
  const variant = Number.parseInt(hex[16] ?? "0", 16);
  hex[16] = ((variant & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join("-");
}
