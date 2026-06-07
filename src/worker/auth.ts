import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";

import { currentTermsHash } from "../shared/terms";
import type { SessionPayload, UserSummary } from "../shared/types";
import { constantTimeEqual, hashPassword, PASSWORD_ITERATIONS, randomToken, sha256Base64Url } from "./crypto";
import type { AppEnv, Env } from "./env";
import { HttpError } from "./http";

const SESSION_DAYS = 30;
const COOKIE_DEFAULT = "shogiwoshiyou_session";
const RESERVED_HANDLES = new Set(["cpu"]);

export type RegisterInput = {
  handle: string;
  password: string;
  termsAccepted: true;
  termsHash: string;
};

export type TermsAgreementInput = {
  termsAccepted: true;
  termsHash: string;
};

export type LoginInput = {
  handle: string;
  password: string;
};

export type ProfileInput = {
  displayName: string;
};

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
};

type CredentialRow = {
  user_id: string;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
};

export function sessionCookieName(env: Env): string {
  return env.SESSION_COOKIE_NAME ?? COOKIE_DEFAULT;
}

export function authMiddleware(options: { requireCurrentTerms?: boolean } = {}): MiddlewareHandler<AppEnv> {
  const requireCurrentTerms = options.requireCurrentTerms ?? true;
  return async (c, next) => {
    const user = await currentUser(c);
    if (!user) {
      throw new HttpError(401, "unauthorized", "ログインが必要です。");
    }
    if (requireCurrentTerms) {
      const termsHash = await currentTermsHash();
      const accepted = await hasAcceptedTerms(c.env.DB, user.id, termsHash);
      if (!accepted) {
        throw new HttpError(403, "terms_agreement_required", "最新の利用規約への同意が必要です。");
      }
    }
    c.set("user", user);
    await next();
  };
}

export async function currentSession(c: Context<AppEnv>): Promise<SessionPayload> {
  return sessionPayload(c, await currentUser(c));
}

export async function currentUser(c: Context<AppEnv>): Promise<UserSummary | null> {
  const token = getCookie(c, sessionCookieName(c.env));
  if (!token) {
    return null;
  }
  const tokenHash = await sha256Base64Url(token);
  const now = new Date().toISOString();
  const row = await c.env.DB.prepare(
    `SELECT users.id, users.handle, users.display_name
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?1
       AND sessions.expires_at > ?2
       AND users.retired_at IS NULL`,
  )
    .bind(tokenHash, now)
    .first<UserRow>();
  if (!row) {
    return null;
  }
  await c.env.DB.prepare("UPDATE sessions SET last_seen_at = ?1 WHERE token_hash = ?2")
    .bind(now, tokenHash)
    .run();
  return toUserSummary(row);
}

export async function register(c: Context<AppEnv>, input: RegisterInput): Promise<UserSummary> {
  const normalizedHandle = normalizeHandle(input.handle);
  if (RESERVED_HANDLES.has(normalizedHandle)) {
    throw new HttpError(409, "handle_reserved", "そのハンドルは予約されています。");
  }
  const expectedTermsHash = await currentTermsHash();
  if (input.termsHash !== expectedTermsHash) {
    throw new HttpError(400, "terms_hash_mismatch", "利用規約を再読み込みしてください。");
  }
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const salt = randomToken(18);
  const passwordHash = await hashPassword(input.password, salt);
  const termsAgreementId = crypto.randomUUID();

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO users (id, handle, display_name, created_at)
         VALUES (?1, ?2, ?3, ?4)`,
      ).bind(userId, normalizedHandle, normalizedHandle, now),
      c.env.DB.prepare(
        `INSERT INTO user_credentials
         (user_id, password_salt, password_hash, password_iterations, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(userId, salt, passwordHash, PASSWORD_ITERATIONS, now, now),
      c.env.DB.prepare(
        `INSERT INTO user_terms_agreements (id, user_id, terms_hash, agreed_at)
         VALUES (?1, ?2, ?3, ?4)`,
      ).bind(termsAgreementId, userId, input.termsHash, now),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw new HttpError(409, "handle_taken", "そのハンドルはすでに使われています。");
    }
    throw error;
  }

  const user = { id: userId, handle: normalizedHandle, displayName: normalizedHandle };
  await createSession(c, user.id);
  return user;
}

export async function acceptCurrentTerms(
  c: Context<AppEnv>,
  user: UserSummary,
  input: TermsAgreementInput,
): Promise<SessionPayload> {
  const expectedTermsHash = await currentTermsHash();
  if (input.termsHash !== expectedTermsHash) {
    throw new HttpError(400, "terms_hash_mismatch", "利用規約を再読み込みしてください。");
  }
  await recordTermsAgreement(c.env.DB, user.id, input.termsHash, new Date().toISOString());
  return sessionPayload(c, user);
}

export async function login(c: Context<AppEnv>, input: LoginInput): Promise<UserSummary> {
  const normalizedHandle = normalizeHandle(input.handle);
  const row = await c.env.DB.prepare(
    `SELECT users.id, users.handle, users.display_name,
            user_credentials.password_salt,
            user_credentials.password_hash,
            user_credentials.password_iterations,
            user_credentials.user_id
     FROM users
     JOIN user_credentials ON user_credentials.user_id = users.id
     WHERE users.handle = ?1
       AND users.retired_at IS NULL`,
  )
    .bind(normalizedHandle)
    .first<UserRow & CredentialRow>();
  if (!row) {
    throw new HttpError(401, "bad_credentials", "ハンドルまたはパスワードが違います。");
  }

  const passwordHash = await hashPassword(
    input.password,
    row.password_salt,
    row.password_iterations,
  );
  if (!constantTimeEqual(passwordHash, row.password_hash)) {
    throw new HttpError(401, "bad_credentials", "ハンドルまたはパスワードが違います。");
  }

  await createSession(c, row.id);
  return toUserSummary(row);
}

export async function logout(c: Context<AppEnv>): Promise<void> {
  const token = getCookie(c, sessionCookieName(c.env));
  if (token) {
    const tokenHash = await sha256Base64Url(token);
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(tokenHash).run();
  }
  deleteCookie(c, sessionCookieName(c.env), { path: "/" });
}

export async function updateProfile(
  c: Context<AppEnv>,
  user: UserSummary,
  input: ProfileInput,
): Promise<UserSummary> {
  const displayName = input.displayName.trim();
  await c.env.DB.prepare(
    `UPDATE users
     SET display_name = ?1
     WHERE id = ?2
       AND retired_at IS NULL`,
  )
    .bind(displayName, user.id)
    .run();
  return { ...user, displayName };
}

async function createSession(c: Context<AppEnv>, userId: string): Promise<void> {
  const token = randomToken();
  const tokenHash = await sha256Base64Url(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await c.env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(tokenHash, userId, expires.toISOString(), now.toISOString(), now.toISOString())
    .run();
  setCookie(c, sessionCookieName(c.env), token, {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
    secure: new URL(c.req.url).protocol === "https:",
    expires,
  });
}

export async function sessionPayload(c: Context<AppEnv>, user: UserSummary | null): Promise<SessionPayload> {
  const termsHash = await currentTermsHash();
  const termsAgreementRequired = user ? !(await hasAcceptedTerms(c.env.DB, user.id, termsHash)) : false;
  return { user, termsAgreementRequired, termsHash };
}

async function hasAcceptedTerms(db: D1Database, userId: string, termsHash: string): Promise<boolean> {
  const row = await db.prepare(
    `SELECT 1 AS accepted
     FROM user_terms_agreements
     WHERE user_id = ?1
       AND terms_hash = ?2
     LIMIT 1`,
  )
    .bind(userId, termsHash)
    .first<{ accepted: number }>();
  return Boolean(row);
}

async function recordTermsAgreement(
  db: D1Database,
  userId: string,
  termsHash: string,
  agreedAt: string,
): Promise<void> {
  await db.prepare(
    `INSERT INTO user_terms_agreements (id, user_id, terms_hash, agreed_at)
     VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(crypto.randomUUID(), userId, termsHash, agreedAt)
    .run();
}

function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
  };
}

function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}
