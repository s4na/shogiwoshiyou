import type { GameResponse } from "../shared/types";
import type { Env } from "./env";
import { loadUsers, toStoredGame, type GameRow } from "./game-store";
import {
  applyUsiMove,
  createInitialGame,
  expectedUserForTurn,
  opponentUserId,
  playerColorForUser,
  snapshotFromStoredGame,
  type StoredGame,
} from "./shogi";

type GameEventType = "game.created" | "game.joined" | "move.played" | "game.resigned";

type MoveRequest = {
  usi: string;
  requestId: string;
};

type ResignRequest = {
  requestId: string;
};

const STORAGE_KEY = "game";

export class GameRoom implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const userId = request.headers.get("x-user-id");
      if (!userId) {
        return jsonError(401, "unauthorized", "ログインが必要です。");
      }

      if (url.pathname === "/create" && request.method === "POST") {
        return await this.createGame(userId);
      }
      if (url.pathname === "/join" && request.method === "POST") {
        return await this.joinGame(userId);
      }
      if (url.pathname === "/move" && request.method === "POST") {
        const body: Partial<MoveRequest> = await request.json();
        return await this.playMove(userId, body);
      }
      if (url.pathname === "/resign" && request.method === "POST") {
        const body: Partial<ResignRequest> = await request.json();
        return await this.resign(userId, body);
      }
      if (url.pathname === "/snapshot" && request.method === "GET") {
        const game = await this.loadGame();
        if (!game) {
          return jsonError(404, "game_not_found", "対局が見つかりません。");
        }
        return await this.snapshotResponse(game);
      }
      if (url.pathname === "/ws" && request.method === "GET") {
        return await this.connectWebSocket();
      }
      return jsonError(404, "not_found", "ルートが見つかりません。");
    } catch (error) {
      if (error instanceof DuplicateRequest) {
        return error.response;
      }
      if (error instanceof RoomError) {
        return jsonError(error.status, error.code, error.message);
      }
      console.error(error);
      return jsonError(500, "internal_error", "サーバー内でエラーが発生しました。");
    }
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      return;
    }
    if (message === "ping") {
      ws.send("pong");
      return;
    }
    try {
      const parsed = JSON.parse(message) as { type?: string };
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", at: new Date().toISOString() }));
      }
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "unknown message" }));
    }
  }

  private async createGame(userId: string): Promise<Response> {
    const existing = await this.loadGame();
    if (existing) {
      return this.snapshotResponse(existing);
    }
    const now = new Date().toISOString();
    const id = this.state.id.name ?? crypto.randomUUID();
    const game = createInitialGame(id, userId, now);
    await this.persistNewGame(game, {
      type: "game.created",
      actorUserId: userId,
      payload: { blackUserId: userId },
      clientRequestId: null,
    });
    await this.broadcast(game);
    return this.snapshotResponse(game, 201);
  }

  private async joinGame(userId: string): Promise<Response> {
    const game = await this.requireGame();
    if (game.blackUserId === userId) {
      throw new RoomError(409, "cannot_join_own_game", "自分で作った対局には参加できません。");
    }
    if (game.whiteUserId === userId) {
      return this.snapshotResponse(game);
    }
    if (game.status !== "waiting") {
      throw new RoomError(409, "game_not_waiting", "参加できる状態ではありません。");
    }
    const now = new Date().toISOString();
    const next: StoredGame = {
      ...game,
      whiteUserId: userId,
      status: "active",
      version: game.version + 1,
      lastEventSeq: game.lastEventSeq + 1,
      updatedAt: now,
    };
    await this.persistGame(next, {
      type: "game.joined",
      actorUserId: userId,
      payload: { whiteUserId: userId },
      clientRequestId: null,
    });
    await this.broadcast(next);
    return this.snapshotResponse(next);
  }

  private async playMove(userId: string, body: Partial<MoveRequest>): Promise<Response> {
    const requestId = validateRequestId(body.requestId);
    const usi = validateUsi(body.usi);
    const game = await this.requireGame();
    await this.returnIfDuplicateRequest(game, requestId);
    if (game.status !== "active") {
      throw new RoomError(409, "game_not_active", "対局中ではありません。");
    }
    if (expectedUserForTurn(game) !== userId) {
      throw new RoomError(409, "not_your_turn", "手番ではありません。");
    }
    const applied = applyUsiMove(game.sfen, usi);
    if (!applied.ok) {
      throw new RoomError(422, "illegal_move", applied.message);
    }
    const now = new Date().toISOString();
    const next: StoredGame = {
      ...game,
      sfen: applied.sfen,
      moves: [...game.moves, usi],
      currentTurn: applied.currentTurn,
      version: game.version + 1,
      lastEventSeq: game.lastEventSeq + 1,
      updatedAt: now,
    };
    await this.persistGame(next, {
      type: "move.played",
      actorUserId: userId,
      payload: {
        usi,
        ply: next.moves.length,
        color: playerColorForUser(game, userId),
      },
      clientRequestId: requestId,
    });
    await this.broadcast(next);
    return this.snapshotResponse(next);
  }

  private async resign(userId: string, body: Partial<ResignRequest>): Promise<Response> {
    const requestId = validateRequestId(body.requestId);
    const game = await this.requireGame();
    await this.returnIfDuplicateRequest(game, requestId);
    const color = playerColorForUser(game, userId);
    if (!color) {
      throw new RoomError(403, "not_player", "対局者ではありません。");
    }
    if (game.status === "ended") {
      return this.snapshotResponse(game);
    }
    const now = new Date().toISOString();
    const winnerUserId = opponentUserId(game, userId);
    const next: StoredGame = {
      ...game,
      status: "ended",
      winnerUserId,
      endReason: "resign",
      version: game.version + 1,
      lastEventSeq: game.lastEventSeq + 1,
      updatedAt: now,
    };
    await this.persistGame(next, {
      type: "game.resigned",
      actorUserId: userId,
      payload: { color, winnerUserId },
      clientRequestId: requestId,
    });
    await this.broadcast(next);
    return this.snapshotResponse(next);
  }

  private async returnIfDuplicateRequest(
    game: StoredGame,
    clientRequestId: string,
  ): Promise<void> {
    const existing = await this.env.DB.prepare(
      `SELECT id FROM game_events WHERE game_id = ?1 AND client_request_id = ?2 LIMIT 1`,
    )
      .bind(game.id, clientRequestId)
      .first<{ id: string }>();
    if (existing) {
      throw new DuplicateRequest(await this.snapshotResponse(game));
    }
  }

  private async loadGame(): Promise<StoredGame | null> {
    const stored = await this.state.storage.get<StoredGame>(STORAGE_KEY);
    if (stored) {
      return stored;
    }
    const id = this.state.id.name;
    if (!id) {
      return null;
    }
    const row = await this.env.DB.prepare(
      `SELECT g.*,
              COALESCE(MAX(e.seq), 0) AS last_event_seq
       FROM games g
       LEFT JOIN game_events e ON e.game_id = g.id
       WHERE g.id = ?1
       GROUP BY g.id
       LIMIT 1`,
    )
      .bind(id)
      .first<GameRow>();
    if (!row) {
      return null;
    }
    const game = toStoredGame(row);
    await this.state.storage.put(STORAGE_KEY, game);
    return game;
  }

  private async requireGame(): Promise<StoredGame> {
    const game = await this.loadGame();
    if (!game) {
      throw new RoomError(404, "game_not_found", "対局が見つかりません。");
    }
    return game;
  }

  private async snapshotResponse(game: StoredGame, status = 200): Promise<Response> {
    return Response.json(await this.snapshotPayload(game), { status });
  }

  private async snapshotPayload(game: StoredGame): Promise<GameResponse> {
    const users = await loadUsers(
      this.env.DB,
      [game.blackUserId, game.whiteUserId ?? "", game.winnerUserId ?? ""].filter(Boolean),
    );
    return { game: snapshotFromStoredGame(game, users) };
  }

  private async connectWebSocket(): Promise<Response> {
    const game = await this.requireGame();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.send(
      JSON.stringify({
        type: "game.snapshot",
        ...(await this.snapshotPayload(game)),
      }),
    );
    return new Response(null, { status: 101, webSocket: client });
  }

  private async broadcast(game: StoredGame): Promise<void> {
    const message = JSON.stringify({
      type: "game.updated",
      ...(await this.snapshotPayload(game)),
    });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        ws.close(1011, "broadcast failed");
      }
    }
  }

  private async persistNewGame(
    game: StoredGame,
    event: PersistableEvent,
  ): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO games
         (id, black_user_id, white_user_id, status, sfen, moves_json, current_turn,
          winner_user_id, end_reason, version, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      ).bind(
        game.id,
        game.blackUserId,
        game.whiteUserId,
        game.status,
        game.sfen,
        JSON.stringify(game.moves),
        game.currentTurn,
        game.winnerUserId,
        game.endReason,
        game.version,
        game.createdAt,
        game.updatedAt,
      ),
      this.insertEventStatement(game, event),
    ]);
    await this.state.storage.put(STORAGE_KEY, game);
  }

  private async persistGame(game: StoredGame, event: PersistableEvent): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE games
         SET white_user_id = ?2,
             status = ?3,
             sfen = ?4,
             moves_json = ?5,
             current_turn = ?6,
             winner_user_id = ?7,
             end_reason = ?8,
             version = ?9,
             updated_at = ?10
         WHERE id = ?1`,
      ).bind(
        game.id,
        game.whiteUserId,
        game.status,
        game.sfen,
        JSON.stringify(game.moves),
        game.currentTurn,
        game.winnerUserId,
        game.endReason,
        game.version,
        game.updatedAt,
      ),
      this.insertEventStatement(game, event),
    ]);
    await this.state.storage.put(STORAGE_KEY, game);
  }

  private insertEventStatement(game: StoredGame, event: PersistableEvent): D1PreparedStatement {
    return this.env.DB.prepare(
      `INSERT INTO game_events
       (id, game_id, seq, type, actor_user_id, payload_json, client_request_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      crypto.randomUUID(),
      game.id,
      game.lastEventSeq,
      event.type,
      event.actorUserId,
      JSON.stringify(event.payload),
      event.clientRequestId,
      game.updatedAt,
    );
  }
}

type PersistableEvent = {
  type: GameEventType;
  actorUserId: string | null;
  payload: unknown;
  clientRequestId: string | null;
};

class RoomError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

class DuplicateRequest extends RoomError {
  constructor(public readonly response: Response) {
    super(200, "duplicate_request", "同じ操作はすでに処理されています。");
  }
}

function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

function validateRequestId(value: string | undefined): string {
  if (!value || !/^[0-9a-f-]{20,80}$/i.test(value)) {
    throw new RoomError(400, "bad_request_id", "requestId が不正です。");
  }
  return value;
}

function validateUsi(value: string | undefined): string {
  if (!value || value.length > 8) {
    throw new RoomError(400, "bad_usi", "指し手が不正です。");
  }
  return value;
}
