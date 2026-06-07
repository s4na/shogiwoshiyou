import type { GameEvent, GameSummary, UserSummary } from "../shared/types";
import { type StoredGame, snapshotFromStoredGame, summaryFromSnapshot } from "./shogi";

export type GameRow = {
  id: string;
  mode: StoredGame["mode"];
  black_user_id: string;
  white_user_id: string | null;
  status: StoredGame["status"];
  sfen: string;
  moves_json: string;
  current_turn: StoredGame["currentTurn"];
  winner_user_id: string | null;
  end_reason: StoredGame["endReason"];
  version: number;
  created_at: string;
  updated_at: string;
  last_event_seq: number | null;
};

type UserRow = {
  id: string;
  handle: string;
  display_name: string;
};

type EventRow = {
  id: string;
  game_id: string;
  seq: number;
  type: string;
  actor_user_id: string | null;
  payload_json: string;
  client_request_id: string | null;
  created_at: string;
};

export async function loadUsers(db: D1Database, ids: string[]): Promise<Map<string, UserSummary>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const placeholders = uniqueIds.map((_, index) => `?${String(index + 1)}`).join(", ");
  const result = await db
    .prepare(`SELECT id, handle, display_name FROM users WHERE id IN (${placeholders})`)
    .bind(...uniqueIds)
    .all<UserRow>();
  return new Map(
    result.results.map((row) => [
      row.id,
      { id: row.id, handle: row.handle, displayName: row.display_name },
    ]),
  );
}

export async function listGameSummariesForUser(
  db: D1Database,
  userId: string,
): Promise<GameSummary[]> {
  const result = await db
    .prepare(
      `SELECT g.*,
              COALESCE(MAX(e.seq), 0) AS last_event_seq
       FROM games g
       LEFT JOIN game_events e ON e.game_id = g.id
       WHERE g.black_user_id = ?1
          OR g.white_user_id = ?2
       GROUP BY g.id
       ORDER BY g.updated_at DESC
       LIMIT 30`,
    )
    .bind(userId, userId)
    .all<GameRow>();
  const games = result.results.map(toStoredGame);
  const users = await loadUsers(
    db,
    games.flatMap((game) => [
      game.blackUserId,
      game.whiteUserId ?? "",
      game.winnerUserId ?? "",
    ]),
  );
  return games.map((game) => summaryFromSnapshot(snapshotFromStoredGame(game, users)));
}

export async function canViewGame(
  db: D1Database,
  gameId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS allowed
       FROM games
       WHERE id = ?1
         AND (black_user_id = ?2 OR white_user_id = ?3)
       LIMIT 1`,
    )
    .bind(gameId, userId, userId)
    .first<{ allowed: number }>();
  return Boolean(row);
}

export async function loadGameEvents(
  db: D1Database,
  gameId: string,
  afterSeq: number,
): Promise<GameEvent[]> {
  const result = await db
    .prepare(
      `SELECT id, game_id, seq, type, actor_user_id, payload_json, client_request_id, created_at
       FROM game_events
       WHERE game_id = ?1
         AND seq > ?2
       ORDER BY seq ASC
       LIMIT 100`,
    )
    .bind(gameId, afterSeq)
    .all<EventRow>();
  return result.results.map((row) => ({
    id: row.id,
    gameId: row.game_id,
    seq: row.seq,
    type: row.type,
    actorUserId: row.actor_user_id,
    payload: JSON.parse(row.payload_json) as unknown,
    clientRequestId: row.client_request_id,
    createdAt: row.created_at,
  }));
}

export function toStoredGame(row: GameRow): StoredGame {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    blackUserId: row.black_user_id,
    whiteUserId: row.white_user_id,
    sfen: row.sfen,
    moves: JSON.parse(row.moves_json) as string[],
    currentTurn: row.current_turn,
    winnerUserId: row.winner_user_id,
    endReason: row.end_reason,
    version: row.version,
    lastEventSeq: row.last_event_seq ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
