import type { GameResponse } from "../shared/types";
import type { Env } from "./env";
import { loadUsers, toStoredGame, type GameRow } from "./game-store";
import {
  applyUsiMove,
  chooseCpuMove,
  createInitialGame,
  endGameByCheckmate,
  expectedUserForTurn,
  isCurrentPlayerCheckmated,
  opponentUserId,
  playerColorForUser,
  snapshotFromStoredGame,
  type StoredGame,
} from "./shogi";

type GameEventType =
  | "game.created"
  | "game.joined"
  | "move.played"
  | "game.resigned"
  | "game.checkmated";

const CPU_USER_ID = "cpu-basic";
const CPU_MOVE_DELAY_MS = 800;

type MoveRequest = {
  usi: string;
  requestId: string;
};

type ResignRequest = {
  requestId: string;
};

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
        return await this.createGame(userId, request.headers.get("x-game-mode"));
      }
      if (url.pathname === "/join" && request.method === "POST") {
        return await this.joinGame(userId, request.headers.get("x-join-mode"));
      }
      if (url.pathname === "/friend" && request.method === "POST") {
        return await this.createOrJoinFriendGame(userId);
      }
      if (url.pathname === "/friend-lobby" && request.method === "POST") {
        return await this.createOrJoinFriendLobby(userId);
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
        this.ensureCanViewGame(game, userId);
        return await this.snapshotResponse(game);
      }
      if (url.pathname === "/ws" && request.method === "GET") {
        return await this.connectWebSocket(userId);
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

  async alarm(): Promise<void> {
    const game = await this.loadGame();
    if (game?.mode !== "cpu" || game.status !== "active") {
      return;
    }
    if (expectedUserForTurn(game) !== CPU_USER_ID) {
      return;
    }
    const next = await this.playCpuMove(game);
    if (next.version !== game.version) {
      await this.broadcast(next);
    }
  }

  private async createGame(userId: string, rawMode: string | null): Promise<Response> {
    const existing = await this.loadGame();
    if (existing) {
      return this.snapshotResponse(existing);
    }
    const mode = rawMode === "friend" ? "friend" : "cpu";
    const now = new Date().toISOString();
    const id = this.state.id.name ?? crypto.randomUUID();
    if (mode === "cpu") {
      await this.ensureCpuUser(now);
    }
    const game = createInitialGame(id, userId, now, mode, mode === "cpu" ? CPU_USER_ID : null);
    await this.persistNewGame(game, {
      type: "game.created",
      actorUserId: userId,
      payload: { blackUserId: userId, mode },
      clientRequestId: null,
    });
    await this.broadcast(game);
    return this.snapshotResponse(game, 201);
  }

  private async joinGame(userId: string, rawJoinMode: string | null): Promise<Response> {
    const game = await this.requireGame();
    if (rawJoinMode !== "friend" || game.mode !== "friend") {
      throw new RoomError(403, "join_mode_mismatch", "この参加方法では参加できません。");
    }
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

  private async createOrJoinFriendGame(userId: string): Promise<Response> {
    const existing = await this.loadGame();
    if (!existing) {
      return this.createGame(userId, "friend");
    }
    if (existing.blackUserId === userId || existing.whiteUserId === userId) {
      return this.snapshotResponse(existing);
    }
    return this.joinGame(userId, "friend");
  }

  private async createOrJoinFriendLobby(userId: string): Promise<Response> {
    const currentGameId = await this.state.storage.get<string>("friendGameId");
    if (currentGameId) {
      const currentGame = await this.loadGameById(currentGameId);
      if (currentGame && currentGame.status !== "ended") {
        return this.forwardToGame(currentGameId, userId, "/friend");
      }
    }
    const nextGameId = crypto.randomUUID();
    await this.state.storage.put("friendGameId", nextGameId);
    return this.forwardToGame(nextGameId, userId, "/friend");
  }

  private async playMove(userId: string, body: Partial<MoveRequest>): Promise<Response> {
    const requestId = validateRequestId(body.requestId);
    const usi = validateUsi(body.usi);
    const game = await this.requireGame();
    if (game.status !== "active") {
      throw new RoomError(409, "game_not_active", "対局中ではありません。");
    }
    if (expectedUserForTurn(game) !== userId) {
      throw new RoomError(409, "not_your_turn", "手番ではありません。");
    }
    await this.returnIfDuplicateRequest(game, requestId);
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
    const moveEvent: PersistableEvent = {
      type: "move.played",
      actorUserId: userId,
      payload: {
        usi,
        ply: next.moves.length,
        color: playerColorForUser(game, userId),
      },
      clientRequestId: requestId,
    };
    if (isCurrentPlayerCheckmated(next.sfen)) {
      const ended = endGameByCheckmate(next, expectedUserForTurn(next), new Date().toISOString());
      await this.persistGame(ended, [
        { ...moveEvent, seq: next.lastEventSeq, createdAt: next.updatedAt },
        this.checkmateEvent(ended, expectedUserForTurn(next)),
      ]);
      await this.broadcast(ended);
      return this.snapshotResponse(ended);
    }
    await this.persistGame(next, moveEvent);
    if (next.mode === "cpu" && expectedUserForTurn(next) === CPU_USER_ID) {
      await this.state.storage.setAlarm(Date.now() + CPU_MOVE_DELAY_MS);
    }
    await this.broadcast(next);
    return this.snapshotResponse(next);
  }

  private async resign(userId: string, body: Partial<ResignRequest>): Promise<Response> {
    const requestId = validateRequestId(body.requestId);
    const game = await this.requireGame();
    const color = playerColorForUser(game, userId);
    if (!color) {
      throw new RoomError(403, "not_player", "対局者ではありません。");
    }
    await this.returnIfDuplicateRequest(game, requestId);
    if (game.status === "ended") {
      return this.snapshotResponse(game);
    }
    if (game.status !== "active") {
      throw new RoomError(409, "game_not_active", "対局中ではありません。");
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
    const id = this.state.id.name;
    if (!id) {
      return null;
    }
    return this.loadGameById(id);
  }

  private async loadGameById(id: string): Promise<StoredGame | null> {
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
    return toStoredGame(row);
  }

  private forwardToGame(gameId: string, userId: string, path: string): Promise<Response> {
    const id = this.env.GAME_ROOM.idFromName(gameId);
    const stub = this.env.GAME_ROOM.get(id);
    return stub.fetch(`https://game-room${path}`, {
      method: "POST",
      headers: {
        "x-user-id": userId,
        "x-join-mode": "friend",
      },
    });
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

  private async playCpuMove(game: StoredGame): Promise<StoredGame> {
    const usi = chooseCpuMove(game.sfen);
    if (!usi) {
      if (isCurrentPlayerCheckmated(game.sfen)) {
        return await this.endByCheckmate(game, CPU_USER_ID);
      }
      return game;
    }
    const applied = applyUsiMove(game.sfen, usi);
    if (!applied.ok) {
      return game;
    }
    const now = new Date().toISOString();
    const moved: StoredGame = {
      ...game,
      sfen: applied.sfen,
      moves: [...game.moves, usi],
      currentTurn: applied.currentTurn,
      version: game.version + 1,
      lastEventSeq: game.lastEventSeq + 1,
      updatedAt: now,
    };
    const moveEvent: PersistableEvent = {
      type: "move.played",
      actorUserId: CPU_USER_ID,
      payload: {
        usi,
        ply: moved.moves.length,
        color: "white",
      },
      clientRequestId: null,
    };
    if (isCurrentPlayerCheckmated(moved.sfen)) {
      const ended = endGameByCheckmate(moved, game.blackUserId, new Date().toISOString());
      await this.persistGame(ended, [
        { ...moveEvent, seq: moved.lastEventSeq, createdAt: moved.updatedAt },
        this.checkmateEvent(ended, game.blackUserId),
      ]);
      return ended;
    }
    await this.persistGame(moved, moveEvent);
    return moved;
  }

  private async endByCheckmate(game: StoredGame, loserUserId: string): Promise<StoredGame> {
    const now = new Date().toISOString();
    const next = endGameByCheckmate(game, loserUserId, now);
    await this.persistGame(next, this.checkmateEvent(next, loserUserId));
    return next;
  }

  private checkmateEvent(game: StoredGame, loserUserId: string): PersistableEvent {
    return {
      type: "game.checkmated",
      actorUserId: null,
      payload: { loserUserId, winnerUserId: game.winnerUserId },
      clientRequestId: null,
    };
  }

  private async ensureCpuUser(now: string): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO users (id, handle, display_name, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(id) DO NOTHING`,
    )
      .bind(CPU_USER_ID, "cpu", "CPU", now)
      .run();
  }

  private async connectWebSocket(userId: string): Promise<Response> {
    const game = await this.requireGame();
    this.ensureCanViewGame(game, userId);
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

  private ensureCanViewGame(game: StoredGame, userId: string): void {
    if (!playerColorForUser(game, userId)) {
      throw new RoomError(403, "not_player", "対局者ではありません。");
    }
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
          winner_user_id, end_reason, version, created_at, updated_at, mode)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
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
        game.mode,
      ),
      this.insertEventStatement(game, event),
    ]);
  }

  private async persistGame(
    game: StoredGame,
    eventOrEvents: PersistableEvent | PersistableEvent[],
  ): Promise<void> {
    const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents];
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
      ...events.map((event) => this.insertEventStatement(game, event)),
    ]);
  }

  private insertEventStatement(game: StoredGame, event: PersistableEvent): D1PreparedStatement {
    return this.env.DB.prepare(
      `INSERT INTO game_events
       (id, game_id, seq, type, actor_user_id, payload_json, client_request_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(
      crypto.randomUUID(),
      game.id,
      event.seq ?? game.lastEventSeq,
      event.type,
      event.actorUserId,
      JSON.stringify(event.payload),
      event.clientRequestId,
      event.createdAt ?? game.updatedAt,
    );
  }
}

type PersistableEvent = {
  type: GameEventType;
  actorUserId: string | null;
  payload: unknown;
  clientRequestId: string | null;
  seq?: number;
  createdAt?: string;
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
