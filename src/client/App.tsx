import { computed, signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import {
  ApiClientError,
  createGame,
  getGame,
  getGameEvents,
  getSession,
  listGames,
  loginAccount,
  logoutAccount,
  playMove,
  registerAccount,
  resignGame,
  updateProfile,
} from "./api";
import {
  dropUsi,
  myColor,
  orderedBoardSquares,
  promotionMoveOptions,
  shouldInvertPiece,
} from "./shogi-ui";
import type {
  BoardPiece,
  GameEvent,
  GameMode,
  GameSnapshot,
  GameSummary,
  HandPieceType,
  PlayerColor,
  UserSummary,
} from "../shared/types";

const user = signal<UserSummary | null | undefined>(undefined);
const games = signal<GameSummary[]>([]);
const activeGame = signal<GameSnapshot | null>(null);
const events = signal<GameEvent[]>([]);
const selectedSquare = signal<string | null>(null);
const selectedHand = signal<HandPieceType | null>(null);
const promotionChoice = signal<{ baseUsi: string; promotedUsi: string } | null>(null);
const notice = signal<string | null>(null);
const busy = signal(false);
const connection = signal<"idle" | "connecting" | "live" | "reconnecting" | "polling">("idle");
const authMode = signal<"register" | "login">("register");
const gameMode = signal<GameMode>("cpu");

const signedIn = computed(() => user.value !== null && user.value !== undefined);

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pollingTimer: number | null = null;
let reconnectAttempts = 0;

export function App() {
  useEffect(() => {
    void bootstrap();
    return () => {
      closeRealtime();
    };
  }, []);

  if (user.value === undefined) {
    return <main class="app-shell loading">読み込み中</main>;
  }

  return (
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">workers.dev free start</p>
          <h1>将棋をしよう</h1>
        </div>
        <SessionArea />
      </header>
      {!signedIn.value ? (
        <AuthPanel />
      ) : (
        <section class="play-layout">
          <GameList />
          <BoardArea />
          <HistoryPanel />
        </section>
      )}
      {notice.value ? <div class="toast" role="alert">{notice.value}</div> : null}
    </main>
  );
}

function SessionArea() {
  if (!user.value) {
    return <span class="session-chip">未ログイン</span>;
  }
  return (
    <div class="session-area">
      <span class="session-chip">{user.value.displayName}</span>
      <form class="profile-form" onSubmit={(event) => void submitProfile(event)}>
        <label for="profile-display-name">表示名</label>
        <input
          id="profile-display-name"
          name="displayName"
          defaultValue={user.value.displayName}
          required
          minlength={1}
          maxlength={32}
          aria-describedby="profile-display-name-help"
        />
        <button type="submit" disabled={busy.value}>保存</button>
        <span id="profile-display-name-help">1〜32文字。対局画面に表示されます。</span>
      </form>
      <button type="button" class="ghost-button" onClick={() => void handleLogout()}>
        ログアウト
      </button>
    </div>
  );
}

function AuthPanel() {
  return (
    <section class="auth-panel">
      <div class="segmented">
        <button
          type="button"
          class={authMode.value === "register" ? "active" : ""}
          aria-pressed={authMode.value === "register"}
          onClick={() => {
            authMode.value = "register";
          }}
        >
          登録
        </button>
        <button
          type="button"
          class={authMode.value === "login" ? "active" : ""}
          aria-pressed={authMode.value === "login"}
          onClick={() => {
            authMode.value = "login";
          }}
        >
          ログイン
        </button>
      </div>
      <form class="auth-form" onSubmit={(event) => void submitAuth(event)}>
        <label for="auth-handle">ハンドル</label>
        <input
          id="auth-handle"
          name="handle"
          autocomplete="username"
          required
          minlength={3}
          maxlength={24}
          pattern="[A-Za-z0-9_]+"
          aria-describedby="auth-handle-help"
        />
        <p id="auth-handle-help" class="field-help">
          3〜24文字。半角英数字と _ のみ。cpu は予約済みです。
        </p>
        <label for="auth-password">パスワード</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          autocomplete={authMode.value === "register" ? "new-password" : "current-password"}
          required
          minlength={8}
          maxlength={128}
          aria-describedby="auth-password-help"
        />
        <p id="auth-password-help" class="field-help">
          8〜128文字。メールアドレスなどの個人情報は登録しません。
        </p>
        <button type="submit" disabled={busy.value}>
          {authMode.value === "register" ? "登録して始める" : "ログイン"}
        </button>
      </form>
    </section>
  );
}

function GameList() {
  return (
    <aside class="side-panel">
      <div class="panel-heading">
        <h2>対局</h2>
        <button type="button" onClick={() => void refreshGames()} disabled={busy.value}>
          更新
        </button>
      </div>
      <form class="create-game-form" onSubmit={(event) => void submitCreateGame(event)}>
        <fieldset>
          <legend>対戦モード</legend>
          <label>
            <input
              type="radio"
              name="mode"
              value="cpu"
              checked={gameMode.value === "cpu"}
              onChange={() => {
                gameMode.value = "cpu";
              }}
            />
            CPU対戦
          </label>
          <label>
            <input
              type="radio"
              name="mode"
              value="friend"
              checked={gameMode.value === "friend"}
              onChange={() => {
                gameMode.value = "friend";
              }}
            />
            友達対戦
          </label>
        </fieldset>
        {gameMode.value === "friend" ? (
          <>
            <label for="friend-passcode">合言葉</label>
            <input
              id="friend-passcode"
              name="passcode"
              required
              minlength={12}
              maxlength={64}
              autocomplete="off"
              aria-describedby="friend-passcode-help"
            />
            <p id="friend-passcode-help" class="field-help">
              12〜64文字。推測されにくい合言葉を相手だけに共有します。
            </p>
          </>
        ) : null}
        <button type="submit" class="primary-action" disabled={busy.value}>
          {createGameButtonLabel()}
        </button>
      </form>
      <div class="game-list">
        {games.value.length === 0 ? <p class="empty">対局なし</p> : null}
        {games.value.map((game) => {
          return (
            <button
              type="button"
              key={game.id}
              class={activeGame.value?.id === game.id ? "game-item active" : "game-item"}
              onClick={() => void selectGame(game.id)}
            >
              <span class="game-main">
                <strong>{game.players.black.displayName}</strong>
                <span>対</span>
                <strong>{game.players.white?.displayName ?? waitingLabel(game.mode)}</strong>
              </span>
              <span class="game-sub">
                {modeLabel(game.mode)} / {game.status === "waiting" ? statusLabel(game) : game.status === "active" ? `${String(game.moves.length)}手` : "終局"}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function BoardArea() {
  const game = activeGame.value;
  if (!game || !user.value) {
    return (
      <section class="board-panel placeholder">
        <p>対局を選択</p>
      </section>
    );
  }
  const color = myColor(game, user.value.id);
  const orientation = color ?? "black";
  const myTurn = color !== null && game.status === "active" && game.currentTurn === color;
  const choice = promotionChoice.value;

  return (
    <section class="board-panel">
      <div class="game-toolbar">
        <div>
          <span class="status-pill">{statusLabel(game)}</span>
          <h2>
            {game.players.black.displayName} 対 {game.players.white?.displayName ?? waitingLabel(game.mode)}
          </h2>
        </div>
        <div class="toolbar-actions">
          <span class={`connection ${connection.value}`}>{connectionLabel()}</span>
          {color && game.status === "active" ? (
            <button type="button" class="danger-button" onClick={() => void handleResign(game.id)} disabled={busy.value}>
              投了
            </button>
          ) : null}
        </div>
      </div>
      <HandRow game={game} color="white" orientation={orientation} />
      <div class="board-grid" aria-label="将棋盤">
        {orderedBoardSquares(game, orientation).map((square) => {
          const selected = selectedSquare.value === square.square;
          const label = boardSquareLabel(square.square, square.piece, selected);
          return (
            <button
              type="button"
              key={square.square}
              class={selected ? "board-square selected" : "board-square"}
              onClick={() => void handleSquareClick(square.square)}
              disabled={busy.value}
              aria-disabled={!myTurn}
              aria-label={label}
            >
              {square.piece ? (
                <span class={shouldInvertPiece(square.piece, orientation) ? "piece inverted" : "piece"}>
                  {square.piece.label}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <HandRow game={game} color="black" orientation={orientation} />
      {choice ? (
        <div class="promotion-bar">
          <span>成りますか</span>
          <button type="button" onClick={() => void submitMove(choice.promotedUsi)} disabled={busy.value}>
            成る
          </button>
          <button type="button" onClick={() => void submitMove(choice.baseUsi)} disabled={busy.value}>
            不成
          </button>
        </div>
      ) : null}
    </section>
  );
}

function HandRow({
  game,
  color,
  orientation,
}: {
  game: GameSnapshot;
  color: PlayerColor;
  orientation: PlayerColor;
}) {
  const visibleColor = orientation === "black" ? color : color === "black" ? "white" : "black";
  const pieces = game.hands[visibleColor];
  const ownHand = user.value ? myColor(game, user.value.id) === visibleColor : false;
  return (
    <div class={`hand-row ${visibleColor}`}>
      <span class="hand-label">{visibleColor === "black" ? "先手" : "後手"}</span>
      {pieces.length === 0 ? <span class="hand-empty">なし</span> : null}
      {pieces.map((piece) => {
        const selected = ownHand && selectedHand.value === piece.type;
        return (
          <button
            type="button"
            key={piece.type}
            class={selected ? "hand-piece active" : "hand-piece"}
            aria-pressed={selected}
            disabled={busy.value || !ownHand || game.status !== "active" || game.currentTurn !== visibleColor}
            onClick={() => {
              selectedSquare.value = null;
              selectedHand.value = selectedHand.value === piece.type ? null : piece.type;
            }}
          >
            {piece.label}
            <span>{piece.count}</span>
          </button>
        );
      })}
    </div>
  );
}

function HistoryPanel() {
  const game = activeGame.value;
  return (
    <aside class="side-panel history-panel">
      <div class="panel-heading">
        <h2>履歴</h2>
        {game ? <span>{game.moves.length}手</span> : null}
      </div>
      {!game ? <p class="empty">対局未選択</p> : null}
      {game ? (
        <ol class="move-list">
          {game.moves.map((move) => (
            <li key={move.ply}>
              <span>{move.ply}</span>
              <code>{move.usi}</code>
            </li>
          ))}
        </ol>
      ) : null}
      {events.value.length > 0 ? (
        <div class="event-list">
          {events.value.slice(-6).map((event) => (
            <p key={event.id}>
              <span>{event.seq}</span>
              {event.type}
            </p>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

async function bootstrap(): Promise<void> {
  try {
    const session = await getSession();
    user.value = session.user;
    if (session.user) {
      await refreshGames();
    }
  } catch (error) {
    showError(error);
    user.value = null;
  }
}

async function submitAuth(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const input = Object.fromEntries(form.entries());
  await withBusy(async () => {
    const session =
      authMode.value === "register"
        ? await registerAccount(input)
        : await loginAccount(input);
    user.value = session.user;
    await refreshGames();
  });
}

async function submitProfile(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const input = Object.fromEntries(form.entries());
  await withBusy(async () => {
    const session = await updateProfile(input);
    user.value = session.user;
    await refreshGames();
    if (activeGame.value) {
      const response = await getGame(activeGame.value.id);
      applyGameSnapshot(response.game);
    }
  });
}

async function handleLogout(): Promise<void> {
  await withBusy(async () => {
    await logoutAccount();
    user.value = null;
    games.value = [];
    activeGame.value = null;
    events.value = [];
    closeRealtime();
  });
}

async function refreshGames(): Promise<void> {
  if (!user.value) {
    return;
  }
  const response = await listGames();
  games.value = response.games;
}

async function submitCreateGame(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const mode = (form.get("mode") ?? "cpu") as GameMode;
  const passcodeEntry = form.get("passcode");
  const passcode = typeof passcodeEntry === "string" ? passcodeEntry.trim() : "";
  await withBusy(async () => {
    const response = await createGame({ mode, ...(mode === "friend" ? { passcode } : {}) });
    applyGameSnapshot(response.game);
    await refreshGames();
    connectRealtime(response.game.id);
  });
}

async function selectGame(gameId: string): Promise<void> {
  await withBusy(async () => {
    const response = await getGame(gameId);
    applyGameSnapshot(response.game);
    selectedSquare.value = null;
    selectedHand.value = null;
    promotionChoice.value = null;
    await refreshEvents();
    connectRealtime(gameId);
  });
}

async function handleSquareClick(square: string): Promise<void> {
  const game = activeGame.value;
  if (!game || !user.value) {
    return;
  }
  if (busy.value) {
    return;
  }
  if (promotionChoice.value) {
    promotionChoice.value = null;
    return;
  }
  const color = myColor(game, user.value.id);
  if (!color || game.status !== "active" || game.currentTurn !== color) {
    return;
  }
  if (selectedHand.value) {
    await submitMove(dropUsi(selectedHand.value, square));
    return;
  }
  if (!selectedSquare.value) {
    const boardSquare = game.board.find((candidate) => candidate.square === square);
    if (boardSquare?.piece?.color === color) {
      selectedSquare.value = square;
    }
    return;
  }
  const from = selectedSquare.value;
  if (from === square) {
    selectedSquare.value = null;
    return;
  }
  const options = promotionMoveOptions(game, from, square);
  if (options.mustPromote) {
    await submitMove(options.promotedUsi);
    return;
  }
  if (options.canPromote) {
    promotionChoice.value = {
      baseUsi: options.baseUsi,
      promotedUsi: options.promotedUsi,
    };
    return;
  }
  await submitMove(options.baseUsi);
}

async function submitMove(usi: string): Promise<void> {
  const game = activeGame.value;
  if (!game) {
    return;
  }
  if (busy.value) {
    return;
  }
  await withBusy(async () => {
    const response = await playMove(game.id, usi, crypto.randomUUID());
    applyGameSnapshot(response.game);
    selectedSquare.value = null;
    selectedHand.value = null;
    promotionChoice.value = null;
    await refreshGames();
    await refreshEvents();
  });
}

async function handleResign(gameId: string): Promise<void> {
  await withBusy(async () => {
    const response = await resignGame(gameId, crypto.randomUUID());
    applyGameSnapshot(response.game);
    await refreshGames();
    await refreshEvents();
  });
}

async function refreshEvents(): Promise<void> {
  const game = activeGame.value;
  if (!game) {
    events.value = [];
    return;
  }
  const response = await getGameEvents(game.id, Math.max(0, game.lastEventSeq - 100));
  events.value = response.events;
}

function connectRealtime(gameId: string): void {
  closeRealtime();
  connection.value = "connecting";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${window.location.host}/api/games/${gameId}/ws`);
  socket = ws;
  ws.addEventListener("open", () => {
    reconnectAttempts = 0;
    connection.value = "live";
    stopPolling();
  });
  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(String(event.data)) as { type?: string; game?: GameSnapshot };
    if (payload.game) {
      if (socket !== ws || activeGame.value?.id !== gameId) {
        return;
      }
      applyGameSnapshot(payload.game);
      void refreshGames();
      void refreshEvents();
    }
  });
  ws.addEventListener("close", () => {
    if (socket === ws) {
      scheduleReconnect(gameId);
    }
  });
  ws.addEventListener("error", () => {
    connection.value = "reconnecting";
  });
}

function scheduleReconnect(gameId: string): void {
  if (activeGame.value?.id !== gameId) {
    return;
  }
  connection.value = "reconnecting";
  startPolling(gameId);
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
  }
  const delay = Math.min(5000, 600 * 2 ** reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = window.setTimeout(() => {
    connectRealtime(gameId);
  }, delay);
}

function startPolling(gameId: string): void {
  if (pollingTimer !== null) {
    return;
  }
  pollingTimer = window.setInterval(() => {
    if (activeGame.value?.id !== gameId) {
      stopPolling();
      return;
    }
    connection.value = "polling";
    void getGame(gameId)
      .then(async (response) => {
        if (activeGame.value?.id !== gameId) {
          return;
        }
        applyGameSnapshot(response.game);
        await refreshGames();
        await refreshEvents();
      })
      .catch(showError);
  }, 5000);
}

function stopPolling(): void {
  if (pollingTimer !== null) {
    window.clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

function closeRealtime(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPolling();
  socket?.close();
  socket = null;
  connection.value = "idle";
}

function applyGameSnapshot(game: GameSnapshot): void {
  activeGame.value = game;
  if (!user.value) {
    return;
  }
  const color = myColor(game, user.value.id);
  if (!color || game.status !== "active" || game.currentTurn !== color) {
    selectedSquare.value = null;
    selectedHand.value = null;
    promotionChoice.value = null;
  }
}

async function withBusy(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  notice.value = null;
  try {
    await action();
  } catch (error) {
    showError(error);
  } finally {
    busy.value = false;
  }
}

function showError(error: unknown): void {
  if (error instanceof ApiClientError) {
    notice.value = error.message;
    return;
  }
  if (error instanceof Error) {
    notice.value = error.message;
    return;
  }
  notice.value = "処理に失敗しました。";
}

function statusLabel(game: GameSnapshot | GameSummary): string {
  if (game.status === "waiting") {
    return "相手待ち";
  }
  if (game.status === "active") {
    return game.currentTurn === "black" ? "先手番" : "後手番";
  }
  if (game.winner) {
    return `${game.winner.displayName} 勝ち`;
  }
  return "終局";
}

function modeLabel(mode: GameMode): string {
  switch (mode) {
    case "cpu":
      return "CPU対戦";
    case "friend":
      return "友達対戦";
  }
}

function waitingLabel(mode: GameMode): string {
  return mode === "cpu" ? "CPU" : "相手待ち";
}

function createGameButtonLabel(): string {
  switch (gameMode.value) {
    case "cpu":
      return "CPUと始める";
    case "friend":
      return "合言葉で待ち合わせる";
  }
}

function boardSquareLabel(square: string, piece: BoardPiece | null, selected: boolean): string {
  const selectedText = selected ? " 選択中" : "";
  if (!piece) {
    return `${square} 空き${selectedText}`;
  }
  return `${square} ${piece.color === "black" ? "先手" : "後手"} ${piece.label}${selectedText}`;
}

function connectionLabel(): string {
  switch (connection.value) {
    case "connecting":
      return "接続中";
    case "live":
      return "接続";
    case "reconnecting":
      return "再接続";
    case "polling":
      return "同期";
    case "idle":
      return "待機";
  }
}
