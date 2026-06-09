import type {
  AnalysisResponse,
  AnalysisSnapshot,
  BoardPiece,
  BoardSquare,
  FriendRematchResponse,
  GameResponse,
  HandPiece,
  PlayerColor,
  UserSummary,
} from "../shared/types";
import type { Env } from "./env";
import { loadUsers, toStoredGame, type GameRow } from "./game-store";
import {
  applyUsiMove,
  chooseCpuMove,
  createInitialGame,
  endGameByCheckmate,
  exportGameAsKif,
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
const PIECE_TYPES = new Set([
  "pawn",
  "lance",
  "knight",
  "silver",
  "gold",
  "bishop",
  "rook",
  "king",
  "promPawn",
  "promLance",
  "promKnight",
  "promSilver",
  "horse",
  "dragon",
]);
const HAND_PIECE_TYPES = new Set(["pawn", "lance", "knight", "silver", "gold", "bishop", "rook"]);
const COLORS = new Set(["black", "white"]);
const RANK_CODES = "abcdefghi";

type MoveRequest = {
  usi: string;
  requestId: string;
};

type ResignRequest = {
  requestId: string;
};

type FriendRematchRequest = {
  gameId: string;
};

type AnalysisUpdateRequest = {
  requestId: string;
  baseRevision: number;
  board: BoardSquare[];
  hands: Record<PlayerColor, HandPiece[]>;
};

type StoredAnalysisSnapshot = Omit<AnalysisSnapshot, "updatedBy"> & {
  updatedByUserId: string | null;
};

type StoredFriendRematch = {
  gameId: string;
  acceptedUserIds: string[];
  nextGameId: string | null;
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
      if (url.pathname === "/friend-rematch" && request.method === "POST") {
        const body: Partial<FriendRematchRequest> = await request.json();
        return await this.requestFriendRematch(userId, body);
      }
      if (url.pathname === "/move" && request.method === "POST") {
        const body: Partial<MoveRequest> = await request.json();
        return await this.playMove(userId, body);
      }
      if (url.pathname === "/resign" && request.method === "POST") {
        const body: Partial<ResignRequest> = await request.json();
        return await this.resign(userId, body);
      }
      if (url.pathname === "/export/kif" && request.method === "GET") {
        return await this.exportKif(userId);
      }
      if (url.pathname === "/analysis" && request.method === "GET") {
        return await this.analysisSnapshotResponse(userId);
      }
      if (url.pathname === "/analysis" && request.method === "POST") {
        const body: Partial<AnalysisUpdateRequest> = await request.json();
        return await this.updateAnalysis(userId, body);
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
      if (isClientRequestConflict(error)) {
        const latest = await this.loadGame();
        if (latest) {
          return this.snapshotResponse(latest);
        }
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

  private async requestFriendRematch(
    userId: string,
    body: Partial<FriendRematchRequest>,
  ): Promise<Response> {
    const gameId = validateGameId(body.gameId);
    const game = await this.loadGameById(gameId);
    if (!game) {
      throw new RoomError(404, "game_not_found", "対局が見つかりません。");
    }
    this.ensureCanViewGame(game, userId);
    if (game.mode !== "friend") {
      throw new RoomError(409, "not_friend_game", "友達対戦ではありません。");
    }
    if (game.status !== "ended") {
      throw new RoomError(409, "game_not_ended", "もう一局は終局後に選べます。");
    }
    if (!game.whiteUserId) {
      throw new RoomError(409, "opponent_missing", "相手が参加していません。");
    }

    const key = friendRematchStorageKey(game.id);
    const previous = await this.state.storage.get<StoredFriendRematch>(key);
    const currentGameId = await this.state.storage.get<string>("friendGameId");
    if (!previous && currentGameId !== game.id) {
      throw new RoomError(403, "passcode_mismatch", "合言葉がこの対局と一致しません。");
    }
    if (previous?.nextGameId) {
      return await this.startedFriendRematchResponse(previous.nextGameId, userId);
    }

    const acceptedUserIds = new Set(previous?.acceptedUserIds ?? []);
    acceptedUserIds.add(userId);
    const accepted = [...acceptedUserIds].filter((id) => id === game.blackUserId || id === game.whiteUserId);
    if (accepted.length < 2) {
      await this.state.storage.put(key, {
        gameId: game.id,
        acceptedUserIds: accepted,
        nextGameId: null,
      } satisfies StoredFriendRematch);
      return Response.json(
        {
          ...(await this.snapshotPayload(game)),
          rematch: { status: "waiting", acceptedCount: accepted.length, requiredCount: 2 },
        } satisfies FriendRematchResponse,
      );
    }

    const nextGameId = crypto.randomUUID();
    await this.state.storage.put("friendGameId", nextGameId);
    await this.state.storage.put(key, {
      gameId: game.id,
      acceptedUserIds: accepted,
      nextGameId,
    } satisfies StoredFriendRematch);
    return await this.startedFriendRematchResponse(nextGameId, userId);
  }

  private async startedFriendRematchResponse(nextGameId: string, userId: string): Promise<Response> {
    const response = await this.forwardToGame(nextGameId, userId, "/friend");
    if (!response.ok) {
      return response;
    }
    const payload: GameResponse = await response.json();
    return Response.json(
      {
        ...payload,
        rematch: { status: "started", acceptedCount: 2, requiredCount: 2 },
      } satisfies FriendRematchResponse,
      { status: response.status },
    );
  }

  private async playMove(userId: string, body: Partial<MoveRequest>): Promise<Response> {
    const requestId = validateRequestId(body.requestId);
    const usi = validateUsi(body.usi);
    const game = await this.requireGame();
    this.ensureCanViewGame(game, userId);
    await this.returnIfDuplicateRequest(game, requestId, userId);
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
    await this.returnIfDuplicateRequest(game, requestId, userId);
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

  private async exportKif(userId: string): Promise<Response> {
    const game = await this.requireGame();
    this.ensureCanViewGame(game, userId);
    const users = await loadUsers(
      this.env.DB,
      [game.blackUserId, game.whiteUserId ?? "", game.winnerUserId ?? ""].filter(Boolean),
    );
    return new Response(exportGameAsKif(game, users), {
      headers: {
        "content-type": "application/x-kif; charset=utf-8",
        "content-disposition": `attachment; filename="${game.id}.kif"`,
      },
    });
  }

  private async analysisSnapshotResponse(userId: string): Promise<Response> {
    const game = await this.requireGame();
    this.ensureCanUseAnalysis(game, userId);
    return Response.json({ analysis: await this.loadOrCreateAnalysis(game) } satisfies AnalysisResponse);
  }

  private async updateAnalysis(
    userId: string,
    body: Partial<AnalysisUpdateRequest>,
  ): Promise<Response> {
    const requestId = validateRequestId(body.requestId);
    const game = await this.requireGame();
    this.ensureCanUseAnalysis(game, userId);
    const now = new Date().toISOString();
    const previous = await this.loadOrCreateStoredAnalysis(game);
    if (body.baseRevision !== previous.revision) {
      throw new RoomError(409, "analysis_revision_conflict", "感想戦の盤面が更新されています。");
    }
    const next: StoredAnalysisSnapshot = {
      gameId: game.id,
      sourceGameVersion: game.version,
      revision: previous.revision + 1,
      board: validateAnalysisBoard(body.board),
      hands: validateAnalysisHands(body.hands),
      updatedAt: now,
      updatedByUserId: userId,
    };
    await this.state.storage.put(analysisStorageKey(game.id), next);
    const analysis = await this.publicAnalysis(next);
    this.broadcastAnalysis(analysis, requestId);
    return Response.json({ analysis } satisfies AnalysisResponse);
  }

  private async returnIfDuplicateRequest(
    game: StoredGame,
    clientRequestId: string,
    actorUserId: string,
  ): Promise<void> {
    const existing = await this.env.DB.prepare(
      `SELECT id FROM game_events
       WHERE game_id = ?1
         AND client_request_id = ?2
         AND actor_user_id = ?3
       LIMIT 1`,
    )
      .bind(game.id, clientRequestId, actorUserId)
      .first<{ id: string }>();
    if (existing) {
      const latest = (await this.loadGameById(game.id)) ?? game;
      throw new DuplicateRequest(await this.snapshotResponse(latest));
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
    if (game.status === "ended") {
      server.send(
        JSON.stringify({
          type: "analysis.snapshot",
          analysis: await this.loadOrCreateAnalysis(game),
        }),
      );
    }
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

  private broadcastAnalysis(analysis: AnalysisSnapshot, requestId: string): void {
    const message = JSON.stringify({ type: "analysis.updated", analysis, requestId });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        ws.close(1011, "analysis broadcast failed");
      }
    }
  }

  private ensureCanUseAnalysis(game: StoredGame, userId: string): void {
    this.ensureCanViewGame(game, userId);
    if (game.status !== "ended") {
      throw new RoomError(409, "game_not_ended", "感想戦は終局後に利用できます。");
    }
  }

  private async loadOrCreateAnalysis(game: StoredGame): Promise<AnalysisSnapshot> {
    return this.publicAnalysis(await this.loadOrCreateStoredAnalysis(game));
  }

  private async loadOrCreateStoredAnalysis(game: StoredGame): Promise<StoredAnalysisSnapshot> {
    const existing = await this.state.storage.get<StoredAnalysisSnapshot>(analysisStorageKey(game.id));
    if (existing?.sourceGameVersion === game.version) {
      return existing;
    }
    const snapshot = (await this.snapshotPayload(game)).game;
    const now = new Date().toISOString();
    const initial: StoredAnalysisSnapshot = {
      gameId: game.id,
      sourceGameVersion: game.version,
      revision: 0,
      board: snapshot.board,
      hands: snapshot.hands,
      updatedAt: now,
      updatedByUserId: null,
    };
    await this.state.storage.put(analysisStorageKey(game.id), initial);
    return initial;
  }

  private async publicAnalysis(snapshot: StoredAnalysisSnapshot): Promise<AnalysisSnapshot> {
    const users = snapshot.updatedByUserId
      ? await loadUsers(this.env.DB, [snapshot.updatedByUserId])
      : new Map<string, UserSummary>();
    return {
      gameId: snapshot.gameId,
      sourceGameVersion: snapshot.sourceGameVersion,
      revision: snapshot.revision,
      board: snapshot.board,
      hands: snapshot.hands,
      updatedAt: snapshot.updatedAt,
      updatedBy: snapshot.updatedByUserId ? users.get(snapshot.updatedByUserId) ?? null : null,
    };
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
    const expectedVersion = game.version - events.length;
    const results = await this.env.DB.batch([
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
         WHERE id = ?1
           AND version = ?11`,
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
        expectedVersion,
      ),
      ...events.map((event) => this.insertEventStatement(game, event)),
    ]);
    const updateResult = results[0] as { meta?: { changes?: number } } | undefined;
    if (updateResult?.meta?.changes === 0) {
      throw new StaleGameWrite(game.id);
    }
  }

  private insertEventStatement(game: StoredGame, event: PersistableEvent): D1PreparedStatement {
    return this.env.DB.prepare(
      `INSERT INTO game_events
       (id, game_id, seq, type, actor_user_id, payload_json, client_request_id, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
       WHERE EXISTS (
         SELECT 1 FROM games WHERE id = ?9 AND version = ?10
       )`,
    ).bind(
      crypto.randomUUID(),
      game.id,
      event.seq ?? game.lastEventSeq,
      event.type,
      event.actorUserId,
      JSON.stringify(event.payload),
      event.clientRequestId,
      event.createdAt ?? game.updatedAt,
      game.id,
      game.version,
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

class StaleGameWrite extends RoomError {
  constructor(public readonly gameId: string) {
    super(409, "stale_game", "対局状態が更新されています。");
  }
}

function isClientRequestConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed/i.test(error.message) &&
    error.message.includes("game_events")
  );
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

function analysisStorageKey(gameId: string): string {
  return `analysis:${gameId}`;
}

function friendRematchStorageKey(gameId: string): string {
  return `friend-rematch:${gameId}`;
}

function validateGameId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new RoomError(400, "bad_game_id", "対局IDが不正です。");
  }
  return value;
}

function validateAnalysisBoard(value: unknown): BoardSquare[] {
  if (!Array.isArray(value) || value.length !== 81) {
    throw new RoomError(400, "bad_analysis_board", "感想戦の盤面が不正です。");
  }
  const seen = new Set<string>();
  const squares: unknown[] = value;
  const normalized = new Map<string, BoardSquare>();
  for (const square of squares) {
    if (!isRecord(square)) {
      throw new RoomError(400, "bad_analysis_board", "感想戦の盤面が不正です。");
    }
    const expected = squareFromUsi(typeof square.square === "string" ? square.square : "");
    if (
      typeof square.square !== "string" ||
      !/^[1-9][a-i]$/.test(square.square) ||
      !expected ||
      seen.has(square.square)
    ) {
      throw new RoomError(400, "bad_analysis_board", "感想戦の盤面が不正です。");
    }
    seen.add(square.square);
    normalized.set(square.square, {
      square: square.square,
      file: expected.file,
      rank: expected.rank,
      piece: square.piece === null ? null : validateBoardPiece(square.piece),
    });
  }
  return orderedSquareIds().map((square) => {
    const normalizedSquare = normalized.get(square);
    if (!normalizedSquare) {
      throw new RoomError(400, "bad_analysis_board", "感想戦の盤面が不正です。");
    }
    return normalizedSquare;
  });
}

function validateAnalysisHands(value: unknown): Record<PlayerColor, HandPiece[]> {
  if (!isRecord(value) || !Array.isArray(value.black) || !Array.isArray(value.white)) {
    throw new RoomError(400, "bad_analysis_hands", "感想戦の持駒が不正です。");
  }
  return {
    black: validateHandPieces(value.black),
    white: validateHandPieces(value.white),
  };
}

function validateBoardPiece(value: unknown): BoardPiece {
  if (
    !isRecord(value) ||
    typeof value.color !== "string" ||
    !COLORS.has(value.color) ||
    typeof value.type !== "string" ||
    !PIECE_TYPES.has(value.type) ||
    typeof value.label !== "string" ||
    value.label.length < 1 ||
    value.label.length > 2
  ) {
    throw new RoomError(400, "bad_analysis_piece", "感想戦の駒が不正です。");
  }
  return {
    color: value.color as PlayerColor,
    type: value.type as BoardPiece["type"],
    label: value.label,
  };
}

function validateHandPieces(value: unknown[]): HandPiece[] {
  if (value.length > HAND_PIECE_TYPES.size) {
    throw new RoomError(400, "bad_analysis_hands", "感想戦の持駒が不正です。");
  }
  const seen = new Set<string>();
  return value.map((piece) => {
    const count = isRecord(piece) ? piece.count : null;
    if (
      !isRecord(piece) ||
      typeof piece.type !== "string" ||
      !HAND_PIECE_TYPES.has(piece.type) ||
      seen.has(piece.type) ||
      typeof piece.label !== "string" ||
      piece.label.length < 1 ||
      piece.label.length > 2 ||
      typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 18
    ) {
      throw new RoomError(400, "bad_analysis_hands", "感想戦の持駒が不正です。");
    }
    seen.add(piece.type);
    return {
      type: piece.type as HandPiece["type"],
      label: piece.label,
      count,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function squareFromUsi(square: string): { file: number; rank: number } | null {
  const file = Number(square[0]);
  const rank = RANK_CODES.indexOf(square[1] ?? "") + 1;
  if (!Number.isInteger(file) || file < 1 || file > 9 || rank < 1 || rank > 9) {
    return null;
  }
  return { file, rank };
}

function orderedSquareIds(): string[] {
  const squares: string[] = [];
  for (const rank of RANK_CODES) {
    for (let file = 9; file >= 1; file -= 1) {
      squares.push(`${String(file)}${rank}`);
    }
  }
  return squares;
}
