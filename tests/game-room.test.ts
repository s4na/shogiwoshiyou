import { describe, expect, it } from "vitest";

import { GameRoom } from "../src/worker/game-room";
import type { Env } from "../src/worker/env";
import type { StoredGame } from "../src/worker/shogi";

describe("GameRoom moves", () => {
  it("does not return a duplicate move snapshot to a non-player", async () => {
    const requestId = "00000000-0000-4000-8000-000000000002";
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      sfen: "4k4/9/9/9/9/9/9/9/4K4 b - 1",
      currentTurn: "black",
    });
    const db = new FakeD1(game, [requestId]);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/move", {
        method: "POST",
        headers: { "x-user-id": "watcher" },
        body: JSON.stringify({ usi: "5i5h", requestId }),
      }),
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("not_your_turn");
  });

  it("does not return a duplicate resign snapshot to a non-player", async () => {
    const requestId = "00000000-0000-4000-8000-000000000003";
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
    });
    const db = new FakeD1(game, [requestId]);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/resign", {
        method: "POST",
        headers: { "x-user-id": "watcher" },
        body: JSON.stringify({ requestId }),
      }),
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("not_player");
  });

  it("ends the game when a player move checkmates the opponent", async () => {
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      sfen: "4k4/3ppp3/9/9/9/9/9/8r/4K4 b RG 1",
      currentTurn: "black",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/move", {
        method: "POST",
        headers: { "x-user-id": "black-user" },
        body: JSON.stringify({ usi: "R*3a", requestId: "00000000-0000-4000-8000-000000000001" }),
      }),
    );
    const body: { game?: { status?: string; endReason?: string } } = await response.json();

    expect(response.status).toBe(200);
    expect(body.game).toEqual(
      expect.objectContaining({
        status: "ended",
        endReason: "checkmate",
      }),
    );
    expect(db.updatedGame).toEqual(
      expect.objectContaining({
        status: "ended",
        winner_user_id: "black-user",
        end_reason: "checkmate",
        version: 2,
        current_turn: "white",
      }),
    );
    expect(db.batchStatementTypes).toContainEqual([
      "UPDATE games",
      "move.played",
      "game.checkmated",
    ]);
    expect(db.insertedEvents).toHaveLength(2);
    expect(db.insertedEvents[0]).toEqual(
      expect.objectContaining({
        seq: 2,
        type: "move.played",
        actor_user_id: "black-user",
        client_request_id: "00000000-0000-4000-8000-000000000001",
      }),
    );
    expect(db.insertedEvents[1]).toEqual(
      expect.objectContaining({
        seq: 3,
        type: "game.checkmated",
        actor_user_id: null,
        payload_json: JSON.stringify({
          loserUserId: "white-user",
          winnerUserId: "black-user",
        }),
      }),
    );
  });

  it("ends the game when the CPU move checkmates the player", async () => {
    const game = storedGame({
      sfen: "4k4/8R/9/9/9/9/9/3PPP3/4K4 w rg 1",
      currentTurn: "white",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    await room.alarm();

    expect(db.updatedGame).toEqual(
      expect.objectContaining({
        status: "ended",
        winner_user_id: "cpu-basic",
        end_reason: "checkmate",
        version: 2,
        current_turn: "black",
      }),
    );
    expect(db.batchStatementTypes).toContainEqual([
      "UPDATE games",
      "move.played",
      "game.checkmated",
    ]);
    expect(db.insertedEvents).toHaveLength(2);
    expect(db.insertedEvents[0]).toEqual(
      expect.objectContaining({
        seq: 2,
        type: "move.played",
        actor_user_id: "cpu-basic",
      }),
    );
    expect(JSON.parse(String(db.insertedEvents[0]?.payload_json))).toEqual(
      expect.objectContaining({
        color: "white",
        ply: 1,
      }),
    );
    expect(db.insertedEvents[1]).toEqual(
      expect.objectContaining({
        seq: 3,
        type: "game.checkmated",
        actor_user_id: null,
        payload_json: JSON.stringify({
          loserUserId: "black-user",
          winnerUserId: "cpu-basic",
        }),
      }),
    );
  });

  it("ends the game when the CPU has no legal escape from check", async () => {
    const game = storedGame({
      sfen: "4k1R2/6R2/9/9/9/9/9/9/4K4 w - 1",
      currentTurn: "white",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    await room.alarm();

    expect(db.updatedGame).toEqual(
      expect.objectContaining({
        status: "ended",
        winner_user_id: "black-user",
        end_reason: "checkmate",
        version: 1,
        current_turn: "white",
      }),
    );
    expect(db.insertedEvents).toHaveLength(1);
    expect(db.insertedEvents[0]).toEqual(
      expect.objectContaining({
        seq: 2,
        type: "game.checkmated",
        actor_user_id: null,
        payload_json: JSON.stringify({
          loserUserId: "cpu-basic",
          winnerUserId: "black-user",
        }),
      }),
    );
  });
});

function createRoom(game: StoredGame, db: FakeD1): GameRoom {
  const state = {
    id: { name: game.id },
    storage: { setAlarm: () => Promise.resolve() },
    acceptWebSocket: () => undefined,
    getWebSockets: () => [],
  } as unknown as DurableObjectState;
  return new GameRoom(state, {
    DB: db as unknown as D1Database,
    GAME_ROOM: {} as DurableObjectNamespace,
    SESSION_COOKIE_NAME: "sid",
  } satisfies Env);
}

function storedGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: "game-1",
    mode: "cpu",
    status: "active",
    blackUserId: "black-user",
    whiteUserId: "cpu-basic",
    sfen: "4k4/9/9/9/9/9/9/9/4K4 w - 1",
    moves: [],
    currentTurn: "white",
    winnerUserId: null,
    endReason: null,
    version: 0,
    lastEventSeq: 1,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    ...overrides,
  };
}

class FakeD1 {
  updatedGame: Record<string, unknown> | null = null;
  insertedEvents: Record<string, unknown>[] = [];
  batchStatementTypes: string[][] = [];
  private currentGame: StoredGame;
  private readonly duplicateRequestIds: Set<string>;

  constructor(game: StoredGame, duplicateRequestIds: string[] = []) {
    this.currentGame = game;
    this.duplicateRequestIds = new Set(duplicateRequestIds);
  }

  prepare(sql: string): FakeStatement {
    return new FakeStatement(sql, this);
  }

  async batch(statements: FakeStatement[]): Promise<unknown[]> {
    this.batchStatementTypes.push(statements.map((statement) => statement.kind()));
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  rowForGame(): Record<string, unknown> {
    return {
      id: this.currentGame.id,
      mode: this.currentGame.mode,
      black_user_id: this.currentGame.blackUserId,
      white_user_id: this.currentGame.whiteUserId,
      status: this.currentGame.status,
      sfen: this.currentGame.sfen,
      moves_json: JSON.stringify(this.currentGame.moves),
      current_turn: this.currentGame.currentTurn,
      winner_user_id: this.currentGame.winnerUserId,
      end_reason: this.currentGame.endReason,
      version: this.currentGame.version,
      created_at: this.currentGame.createdAt,
      updated_at: this.currentGame.updatedAt,
      last_event_seq: this.currentGame.lastEventSeq,
    };
  }

  hasDuplicateRequestId(requestId: unknown): boolean {
    return typeof requestId === "string" && this.duplicateRequestIds.has(requestId);
  }

  applyUpdatedGame(row: Record<string, unknown>): void {
    this.currentGame = {
      ...this.currentGame,
      whiteUserId: row.white_user_id as string | null,
      status: row.status as StoredGame["status"],
      sfen: String(row.sfen),
      moves: JSON.parse(String(row.moves_json)) as string[],
      currentTurn: row.current_turn as StoredGame["currentTurn"],
      winnerUserId: row.winner_user_id as string | null,
      endReason: row.end_reason as StoredGame["endReason"],
      version: Number(row.version),
      lastEventSeq: Number(row.version) + 1,
      updatedAt: String(row.updated_at),
    };
  }
}

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeD1,
  ) {}

  kind(): string {
    if (this.sql.includes("UPDATE games")) {
      return "UPDATE games";
    }
    if (this.sql.includes("INSERT INTO game_events")) {
      return String(this.values[3]);
    }
    return "other";
  }

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM game_events")) {
      return Promise.resolve(this.db.hasDuplicateRequestId(this.values[1]) ? ({ id: "event-1" } as T) : null);
    }
    if (this.sql.includes("FROM games")) {
      return Promise.resolve(this.db.rowForGame() as T);
    }
    return Promise.resolve(null);
  }

  all(): Promise<{ results: Record<string, unknown>[] }> {
    if (this.sql.includes("FROM users")) {
      return Promise.resolve({
        results: [
          { id: "black-user", handle: "sente", display_name: "先手" },
          { id: "white-user", handle: "gote", display_name: "後手" },
          { id: "cpu-basic", handle: "cpu", display_name: "CPU" },
        ],
      });
    }
    return Promise.resolve({ results: [] });
  }

  run(): Promise<unknown> {
    if (this.sql.includes("UPDATE games")) {
      this.db.updatedGame = {
        id: this.values[0],
        white_user_id: this.values[1],
        status: this.values[2],
        sfen: this.values[3],
        moves_json: this.values[4],
        current_turn: this.values[5],
        winner_user_id: this.values[6],
        end_reason: this.values[7],
        version: this.values[8],
        updated_at: this.values[9],
      };
      this.db.applyUpdatedGame(this.db.updatedGame);
    }
    if (this.sql.includes("INSERT INTO game_events")) {
      this.db.insertedEvents.push({
        id: this.values[0],
        game_id: this.values[1],
        seq: this.values[2],
        type: this.values[3],
        actor_user_id: this.values[4],
        payload_json: this.values[5],
        client_request_id: this.values[6],
        created_at: this.values[7],
      });
    }
    return Promise.resolve({ success: true });
  }
}
