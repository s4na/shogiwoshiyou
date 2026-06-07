import { describe, expect, it } from "vitest";

import { GameRoom } from "../src/worker/game-room";
import type { Env } from "../src/worker/env";
import type { StoredGame } from "../src/worker/shogi";

describe("GameRoom CPU turns", () => {
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
        actor_user_id: "black-user",
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
        type: "game.checkmated",
        actor_user_id: "cpu-basic",
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

  constructor(private readonly game: StoredGame) {}

  prepare(sql: string): FakeStatement {
    return new FakeStatement(sql, this);
  }

  async batch(statements: FakeStatement[]): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  rowForGame(): Record<string, unknown> {
    return {
      id: this.game.id,
      mode: this.game.mode,
      black_user_id: this.game.blackUserId,
      white_user_id: this.game.whiteUserId,
      status: this.game.status,
      sfen: this.game.sfen,
      moves_json: JSON.stringify(this.game.moves),
      current_turn: this.game.currentTurn,
      winner_user_id: this.game.winnerUserId,
      end_reason: this.game.endReason,
      version: this.game.version,
      created_at: this.game.createdAt,
      updated_at: this.game.updatedAt,
      last_event_seq: this.game.lastEventSeq,
    };
  }
}

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeD1,
  ) {}

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  first<T>(): Promise<T | null> {
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
