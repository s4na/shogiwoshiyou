import { computed, signal } from "@preact/signals";
import { useEffect, useState, useRef } from "preact/hooks";

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
  legalDropDestinations,
  legalMoveDestinations,
  moveNotationLabel,
  moveUsiTitle,
  myColor,
  orderedBoardSquares,
  promotionMoveOptions,
  retainedPieceSelection,
  shouldInvertPiece,
} from "./shogi-ui";
import {
  DARK,
  LIGHT,
  ThemeCtx,
  useTheme,
  ShogiPiece,
  Btn,
  Card,
  Toast,
  Modal,
  StatusChip,
  Input,
  FieldGroup,
  R,
  MOTION,
  ZINDEX,
  fS,
  fG,
  type Theme,
} from "./design-system";
import type {
  BoardPiece,
  GameEvent,
  GameMode,
  GameSnapshot,
  GameSummary,
  HandPieceType,
  PlayerColor,
  PieceType,
  UserSummary,
} from "../shared/types";
import { currentTermsHash, TERMS_TEXT } from "../shared/terms";

// ─── Global state ─────────────────────────────────────
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
const currentPage = signal<"home" | "terms">(pageForPath(window.location.pathname));

const signedIn = computed(() => user.value !== null && user.value !== undefined);

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pollingTimer: number | null = null;
let reconnectAttempts = 0;

// ─── Helpers ──────────────────────────────────────────
const PROMOTED_TYPES = new Set<PieceType>([
  "promPawn", "promLance", "promKnight", "promSilver", "horse", "dragon",
]);
function isPromoted(type: PieceType): boolean {
  return PROMOTED_TYPES.has(type);
}

// ─── Root ─────────────────────────────────────────────
export function App() {
  const [darkMode, setDarkMode] = useState(false);
  const theme = darkMode ? DARK : LIGHT;
  const showingTerms = currentPage.value === "terms";

  useEffect(() => {
    void bootstrap();
    const onPopState = () => {
      currentPage.value = pageForPath(window.location.pathname);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      closeRealtime();
    };
  }, []);

  useEffect(() => {
    document.title = showingTerms ? "利用規約 | 将棋をしよう" : "将棋をしよう";
    if (!showingTerms) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('main[data-page="terms"]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [showingTerms]);

  return (
    <ThemeCtx.Provider value={theme}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${theme.bg.primary}; color: ${theme.text.primary}; font-family: ${fG}; }
        button { font: inherit; cursor: pointer; }
        input { font: inherit; }
        button:focus-visible, input:focus-visible { outline: 3px solid ${theme.accent.gold}; outline-offset: 2px; }
        input[type="radio"] { width: auto; accent-color: ${theme.accent.gold}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${theme.bg.secondary}; }
        ::-webkit-scrollbar-thumb { background: ${theme.border.default}; border-radius: 3px; }
        input::placeholder { color: ${theme.text.tertiary}; }
        .play-layout { display: grid; grid-template-columns: minmax(220px,280px) minmax(0,1fr) minmax(200px,260px); gap: 16px; }
        @media (max-width: 1020px) {
          .play-layout { grid-template-columns: 1fr !important; }
          .side-order-1 { order: 2; }
          .board-order { order: 1; }
          .history-order { order: 3; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100svh",
          backgroundColor: theme.bg.primary,
          color: theme.text.primary,
          transition: `background-color ${MOTION.slow}`,
        }}
      >
        {!showingTerms && user.value === undefined ? (
          <div
            style={{
              minHeight: "100svh",
              display: "grid",
              placeItems: "center",
              fontFamily: fG,
              fontSize: 14,
              color: theme.text.tertiary,
            }}
          >
            読み込み中…
          </div>
        ) : (
          <>
            <Header darkMode={darkMode} onToggleDark={() => { setDarkMode((d) => !d); }} />
            {showingTerms ? (
              <TermsPage />
            ) : !signedIn.value ? (
              <AuthScreen />
            ) : (
              <PlayScreen />
            )}
          </>
        )}
        {notice.value ? <Toast message={notice.value} type="error" /> : null}
      </div>
    </ThemeCtx.Provider>
  );
}

// ─── Header ───────────────────────────────────────────
function Header({ darkMode, onToggleDark }: { darkMode: boolean; onToggleDark: () => void }) {
  const t = useTheme();
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 24px",
        borderBottom: `1px solid ${t.border.subtle}`,
        backgroundColor: t.bg.secondary,
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1
          style={{
            fontFamily: fS,
            fontSize: "clamp(1.3rem, 1.1rem + 1vw, 2rem)",
            fontWeight: 800,
            color: t.text.primary,
          }}
        >
          将棋をしよう
        </h1>
        <span
          style={{
            fontFamily: fG,
            fontSize: 10,
            fontWeight: 300,
            color: t.text.tertiary,
            letterSpacing: "0.1em",
          }}
        >
          workers.dev free start
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <a
          href="/terms"
          onClick={(event) => { navigate(event, "/terms"); }}
          style={{
            color: t.text.secondary,
            fontFamily: fG,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            padding: "8px 4px",
          }}
        >
          利用規約
        </a>
        <SessionArea />
        <button
          type="button"
          onClick={onToggleDark}
          title={darkMode ? "ライトモードへ" : "ダークモードへ"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: R.full,
            backgroundColor: t.bg.tertiary,
            border: `1px solid ${t.border.default}`,
            color: t.text.secondary,
            fontSize: 16,
            flexShrink: 0,
            transition: `all ${MOTION.normal}`,
          }}
        >
          {darkMode ? "☀" : "☽"}
        </button>
      </div>
    </header>
  );
}

// ─── Session ──────────────────────────────────────────
function SessionArea() {
  const t = useTheme();
  const [editing, setEditing] = useState(false);

  if (!user.value) {
    return <StatusChip color={t.text.tertiary}>未ログイン</StatusChip>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <StatusChip color={t.semantic.online}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: R.full,
            backgroundColor: t.semantic.online,
            display: "inline-block",
          }}
        />
        {user.value.displayName}
      </StatusChip>
      <Btn variant="ghost" size="sm" onClick={() => { setEditing((e) => !e); }}>
        {editing ? "キャンセル" : "表示名"}
      </Btn>
      {editing && (
        <form
          onSubmit={(event) => { void submitProfile(event).then((ok) => { if (ok) setEditing(false); }); }}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <input
            name="displayName"
            defaultValue={user.value.displayName}
            required
            minLength={1}
            maxLength={32}
            aria-label="表示名"
            style={{
              padding: "6px 10px",
              borderRadius: R.md,
              border: `1px solid ${t.border.default}`,
              backgroundColor: t.bg.secondary,
              color: t.text.primary,
              fontSize: 13,
              width: 140,
            }}
          />
          <Btn variant="primary" size="sm" type="submit" disabled={busy.value}>保存</Btn>
        </form>
      )}
      <Btn variant="ghost" size="sm" onClick={() => void handleLogout()} disabled={busy.value}>
        ログアウト
      </Btn>
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────
function AuthScreen() {
  const t = useTheme();
  const [termsHash, setTermsHash] = useState("");

  useEffect(() => {
    let active = true;
    if (authMode.value !== "register") {
      setTermsHash("");
      return () => { active = false; };
    }
    void currentTermsHash().then((hash) => {
      if (active) {
        setTermsHash(hash);
      }
    });
    return () => { active = false; };
  }, [authMode.value]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100svh - 72px)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(400px, 100%)",
          backgroundColor: t.bg.elevated,
          borderRadius: R.xl,
          border: `1px solid ${t.border.default}`,
          boxShadow: t.shadow.lg,
          overflow: "hidden",
        }}
      >
        {/* Tab bar */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${t.border.subtle}` }}>
          {(["register", "login"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={authMode.value === mode}
              onClick={() => { authMode.value = mode; }}
              style={{
                padding: "14px",
                fontFamily: fG,
                fontSize: 13,
                fontWeight: 600,
                color: authMode.value === mode ? t.accent.gold : t.text.tertiary,
                backgroundColor: "transparent",
                border: "none",
                borderBottom: `2px solid ${authMode.value === mode ? t.accent.gold : "transparent"}`,
                cursor: "pointer",
                transition: `all ${MOTION.normal}`,
              }}
            >
              {mode === "register" ? "新規登録" : "ログイン"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={(event) => void submitAuth(event)} style={{ display: "grid", gap: 16, padding: 24 }}>
          <FieldGroup id="auth-handle" label="ハンドル" helpId="auth-handle-help" help="3〜24文字。半角英数字と _ のみ。cpu は予約済み。">
            <Input
              id="auth-handle"
              name="handle"
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z0-9_]+"
              aria-describedby="auth-handle-help"
            />
          </FieldGroup>

          <FieldGroup id="auth-password" label="パスワード" helpId="auth-password-help" help="8〜128文字。個人情報は登録しません。">
            <Input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={authMode.value === "register" ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
              aria-describedby="auth-password-help"
            />
          </FieldGroup>

          {authMode.value === "register" && (
            <div style={{ display: "grid", gap: 8 }}>
              <input type="hidden" name="termsHash" value={termsHash} />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minHeight: 48, paddingTop: 6 }}>
                <input
                  id="auth-terms"
                  name="termsAccepted"
                  type="checkbox"
                  required
                  style={{
                    width: 18,
                    height: 18,
                    marginTop: 7,
                    accentColor: t.accent.gold,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    color: t.text.secondary,
                    fontFamily: fG,
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: "4px 0 10px",
                  }}
                >
                  <label for="auth-terms">利用規約に同意します。</label>
                  <div>
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: t.accent.gold, fontWeight: 700 }}
                    >
                      利用規約を読む
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Btn variant="primary" size="lg" full type="submit" disabled={busy.value || (authMode.value === "register" && !termsHash)}>
            {authMode.value === "register" ? "登録して始める" : "ログイン"}
          </Btn>
        </form>
      </div>
    </div>
  );
}

function TermsPage() {
  const t = useTheme();
  const lines = TERMS_TEXT.split("\n");
  return (
    <main
      data-page="terms"
      tabIndex={-1}
      style={{ maxWidth: 860, margin: "0 auto", padding: "28px 24px 64px" }}
    >
      <article
        style={{
          backgroundColor: t.bg.elevated,
          border: `1px solid ${t.border.default}`,
          borderRadius: R.lg,
          boxShadow: t.shadow.md,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "28px 28px 16px", borderBottom: `1px solid ${t.border.subtle}` }}>
          <h2 style={{ color: t.text.primary, fontFamily: fS, fontSize: 28, fontWeight: 800 }}>
            利用規約
          </h2>
        </div>
        <div style={{ display: "grid", gap: 10, padding: 28 }}>
          {renderTermsBlocks(lines, t)}
          <div style={{ display: "flex", justifyContent: "flex-start", paddingTop: 8 }}>
            <Btn variant="secondary" size="md" onClick={() => { goHome(); }}>
              トップへ戻る
            </Btn>
          </div>
        </div>
      </article>
    </main>
  );
}

function renderTermsBlocks(lines: string[], t: Theme) {
  const blocks = [];
  const listItemPattern = /^(\s*)(\d+)\.\s(.+)$/;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const key = `${String(index)}-${line}`;
    if (line === "" || line === "---" || line === "# 利用規約") {
      blocks.push(<div key={key} style={{ height: line === "" ? 6 : 1 }} />);
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h3
          key={key}
          style={{
            color: t.text.primary,
            fontFamily: fS,
            fontSize: 17,
            fontWeight: 700,
            lineHeight: 1.6,
            marginTop: index === 0 ? 0 : 10,
          }}
        >
          {line.slice(3)}
        </h3>,
      );
      continue;
    }

    const listMatch = listItemPattern.exec(line);
    if (listMatch) {
      const [, indentText = "", startText = "1"] = listMatch;
      const indent = indentText.length;
      const groupStartIndex = index;
      const items = [];
      while (index < lines.length) {
        const itemMatch = listItemPattern.exec(lines[index] ?? "");
        if (!itemMatch) break;
        const [, itemIndent = "", itemNumber = "1", itemText = ""] = itemMatch;
        if (itemIndent.length !== indent) break;
        items.push({ index, number: Number(itemNumber), text: itemText });
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ol
          key={`${String(groupStartIndex)}-list`}
          start={Number(startText)}
          style={{
            color: t.text.secondary,
            fontFamily: fG,
            fontSize: 14,
            lineHeight: 1.8,
            margin: 0,
            marginLeft: indent > 0 ? 22 : 0,
            paddingLeft: 22,
          }}
        >
          {items.map((item) => (
            <li key={`${String(item.index)}-${String(item.number)}-${item.text}`} style={{ paddingLeft: 4 }}>
              {item.text}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;
    blocks.push(
      <p
        key={key}
        style={{
          color: t.text.secondary,
          fontFamily: fG,
          fontSize: 14,
          lineHeight: 1.8,
          marginLeft: indent > 0 ? 18 : 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {trimmed}
      </p>,
    );
  }
  return blocks;
}

// ─── Play layout ──────────────────────────────────────
function PlayScreen() {
  return (
    <div
      className="play-layout"
      style={{ maxWidth: 1380, margin: "0 auto", padding: "20px 24px 60px", alignItems: "start" }}
    >
      <div className="side-order-1"><GameListPanel /></div>
      <div className="board-order"><BoardPanel /></div>
      <div className="history-order"><HistoryPanel /></div>
    </div>
  );
}

// ─── Game list panel ──────────────────────────────────
function GameListPanel() {
  const t = useTheme();
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: fS, fontSize: 16, fontWeight: 700, color: t.text.primary }}>対局</h2>
        <Btn variant="secondary" size="sm" onClick={() => void refreshGames()} disabled={busy.value}>
          更新
        </Btn>
      </div>

      {/* Create game form */}
      <form onSubmit={(event) => void submitCreateGame(event)} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            borderRadius: R.md,
            border: `1px solid ${t.border.default}`,
            padding: "12px",
            display: "grid",
            gap: 8,
          }}
        >
          <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, letterSpacing: "0.05em" }}>
            対戦モード
          </p>
          {(["cpu", "friend"] as const).map((mode) => (
            <label
              key={mode}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: fG,
                fontSize: 13,
                fontWeight: gameMode.value === mode ? 600 : 400,
                color: t.text.primary,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="mode"
                value={mode}
                checked={gameMode.value === mode}
                onChange={() => { gameMode.value = mode; }}
              />
              {mode === "cpu" ? "CPU対戦" : "友達対戦"}
            </label>
          ))}
        </div>

        {gameMode.value === "friend" && (
          <FieldGroup id="friend-passcode" label="合言葉" helpId="friend-passcode-help" help="12〜64文字。推測されにくい合言葉を相手だけに共有します。">
            <Input
              id="friend-passcode"
              name="passcode"
              required
              minLength={12}
              maxLength={64}
              autoComplete="off"
              aria-describedby="friend-passcode-help"
            />
          </FieldGroup>
        )}

        <Btn variant="primary" size="md" full type="submit" disabled={busy.value}>
          {createGameButtonLabel()}
        </Btn>
      </form>

      {/* Game list */}
      <div style={{ display: "grid", gap: 6 }}>
        {games.value.length === 0 && (
          <p style={{ fontFamily: fG, fontSize: 13, color: t.text.tertiary, textAlign: "center", padding: "16px 0" }}>
            対局なし
          </p>
        )}
        {games.value.map((game) => {
          const active = activeGame.value?.id === game.id;
          return (
            <button
              type="button"
              key={game.id}
              onClick={() => void selectGame(game.id)}
              disabled={busy.value}
              style={{
                display: "grid",
                gap: 4,
                width: "100%",
                minHeight: 60,
                padding: "10px 12px",
                textAlign: "left",
                backgroundColor: active ? t.accent.jadeDim : t.bg.tertiary,
                border: `1px solid ${active ? t.accent.jade : t.border.subtle}`,
                borderRadius: R.md,
                cursor: busy.value ? "not-allowed" : "pointer",
                transition: `all ${MOTION.normal}`,
              }}
            >
              <span style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: fG, fontSize: 13 }}>
                <strong style={{ color: t.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {game.players.black.displayName}
                </strong>
                <span style={{ color: t.text.tertiary, flexShrink: 0 }}>対</span>
                <strong style={{ color: t.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {game.players.white?.displayName ?? waitingLabel(game.mode)}
                </strong>
              </span>
              <span style={{ fontFamily: fG, fontSize: 11, color: t.text.tertiary }}>
                {modeLabel(game.mode)} /{" "}
                {game.status === "waiting"
                  ? statusLabel(game)
                  : game.status === "active"
                    ? `${String(game.moves.length)}手`
                    : "終局"}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Board panel ──────────────────────────────────────
function BoardPanel() {
  const t = useTheme();
  const game = activeGame.value;

  if (!game || !user.value) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          minHeight: 500,
          backgroundColor: t.bg.secondary,
          borderRadius: R.lg,
          border: `1px solid ${t.border.subtle}`,
          color: t.text.tertiary,
          fontFamily: fG,
          fontSize: 14,
        }}
      >
        対局を選択してください
      </div>
    );
  }

  const color = myColor(game, user.value.id);
  const orientation = color ?? "black";
  const choice = promotionChoice.value;

  return (
    <div
      style={{
        backgroundColor: t.bg.secondary,
        borderRadius: R.lg,
        border: `1px solid ${t.border.subtle}`,
        padding: "14px",
        boxShadow: t.shadow.sm,
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <StatusChip color={statusColor(game, t)}>{statusLabel(game)}</StatusChip>
          <h2
            style={{
              fontFamily: fS,
              fontSize: 14,
              fontWeight: 700,
              color: t.text.primary,
              marginTop: 6,
            }}
          >
            {game.players.black.displayName} 対{" "}
            {game.players.white?.displayName ?? waitingLabel(game.mode)}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusChip color={connectionColor(connection.value, t)}>{connectionLabel()}</StatusChip>
          {color && game.status === "active" && (
            <Btn variant="danger" size="sm" onClick={() => void handleResign(game.id)} disabled={busy.value}>
              投了
            </Btn>
          )}
        </div>
      </div>

      {/* White hand */}
      <HandRow game={game} color="white" orientation={orientation} />

      {/* Board */}
      <ShogiBoard game={game} orientation={orientation} />

      {/* Black hand */}
      <HandRow game={game} color="black" orientation={orientation} />

      {/* Promotion dialog */}
      <Modal open={choice !== null} onClose={() => { promotionChoice.value = null; }} title="成りますか？">
        {choice && (
          <div style={{ display: "flex", gap: 32, justifyContent: "center", padding: "8px 0" }}>
            <button
              type="button"
              onClick={() => void submitMove(choice.promotedUsi)}
              disabled={busy.value}
              style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center" }}
            >
              <ShogiPiece kanji="龍" size={56} promoted />
              <p style={{ fontFamily: fG, fontSize: 12, color: t.piece.promoted, marginTop: 6, fontWeight: 600 }}>成る</p>
            </button>
            <button
              type="button"
              onClick={() => void submitMove(choice.baseUsi)}
              disabled={busy.value}
              style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center" }}
            >
              <ShogiPiece kanji="飛" size={56} />
              <p style={{ fontFamily: fG, fontSize: 12, color: t.text.secondary, marginTop: 6 }}>不成</p>
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Shogi board ──────────────────────────────────────
function ShogiBoard({
  game,
  orientation,
}: {
  game: GameSnapshot;
  orientation: PlayerColor;
}) {
  const t = useTheme();
  const outerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(50);
  const RANK_LABEL_W = 22;

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      setCellSize(Math.max(24, Math.floor((w - RANK_LABEL_W) / 9)));
    });
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);

  const pieceSize = Math.floor(cellSize * 0.76);
  const fileLabels = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
  const rankLabels = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const STARS = [[2, 2], [2, 5], [5, 2], [5, 5]];

  const lastMoveUsi = game.moves[game.moves.length - 1]?.usi ?? "";
  const lastFrom = lastMoveUsi.slice(0, 2);
  const lastTo = lastMoveUsi.slice(2, 4);
  const color = user.value ? myColor(game, user.value.id) : null;
  const canShowLegalDestinations = color !== null && game.currentTurn === color;
  const legalDestinations = new Set(
    canShowLegalDestinations
      ? selectedSquare.value
        ? legalMoveDestinations(game, selectedSquare.value)
        : selectedHand.value
          ? legalDropDestinations(game, selectedHand.value)
          : []
      : [],
  );

  return (
    <div ref={outerRef} style={{ width: "min(72svh, 100%)", maxWidth: 648, margin: "8px auto" }}>
      {/* File labels */}
      <div style={{ display: "flex", paddingRight: RANK_LABEL_W }}>
        {fileLabels.map((n, i) => (
          <div
            key={i}
            style={{
              width: cellSize,
              textAlign: "center",
              fontFamily: fS,
              fontSize: Math.max(9, cellSize * 0.22),
              color: t.board.grid,
              opacity: 0.8,
            }}
          >
            {n}
          </div>
        ))}
      </div>

      <div style={{ display: "flex" }}>
        {/* Board grid */}
        <div
          aria-label="将棋盤"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(9, ${String(cellSize)}px)`,
            gridTemplateRows: `repeat(9, ${String(cellSize)}px)`,
            background: `linear-gradient(135deg, ${t.board.kayaLight} 0%, ${t.board.kaya} 50%, ${t.board.kayaDark} 100%)`,
            border: `2px solid ${t.board.grid}`,
            borderRadius: 2,
            boxShadow: t.shadow.lg,
            flexShrink: 0,
          }}
        >
            {orderedBoardSquares(game, orientation).map((square, idx) => {
              const row = Math.floor(idx / 9);
              const col = idx % 9;
              const isStar = STARS.some(([r, c]) => r === row && c === col);
              const selected = selectedSquare.value === square.square;
              const sq = square.square;
              const isLastMove = sq === lastFrom || sq === lastTo;
              const isLegalDestination = legalDestinations.has(sq);

              let bgColor = "transparent";
              if (selected) bgColor = t.semantic.selected;
              else if (isLegalDestination) bgColor = t.semantic.legalMove;
              else if (isLastMove) bgColor = t.semantic.lastMove;

              return (
                <button
                  type="button"
                  key={square.square}
                  onClick={() => void handleSquareClick(square.square)}
                  disabled={busy.value}
                  aria-label={boardSquareLabel(square.square, square.piece, selected, isLegalDestination)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `0.5px solid ${t.board.grid}`,
                    borderRadius: 0,
                    backgroundColor: bgColor,
                    padding: 0,
                    cursor: "default",
                    transition: `background-color ${MOTION.fast}`,
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  {isStar && (
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: -2,
                        width: 4,
                        height: 4,
                        borderRadius: R.full,
                        backgroundColor: t.board.star,
                        pointerEvents: "none",
                        zIndex: ZINDEX.highlight,
                      }}
                    />
                  )}
                  {square.piece && (
                    <ShogiPiece
                      kanji={square.piece.label}
                      size={pieceSize}
                      promoted={isPromoted(square.piece.type)}
                      flipped={shouldInvertPiece(square.piece, orientation)}
                      selected={selected}
                    />
                  )}
                </button>
              );
            })}
          </div>

        {/* Rank labels */}
        <div style={{ display: "flex", flexDirection: "column", width: RANK_LABEL_W, flexShrink: 0 }}>
          {rankLabels.map((n, i) => (
            <div
              key={i}
              style={{
                height: cellSize,
                display: "flex",
                alignItems: "center",
                paddingLeft: 3,
                fontFamily: fS,
                fontSize: Math.max(9, cellSize * 0.22),
                color: t.board.grid,
                opacity: 0.8,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Hand row ─────────────────────────────────────────
function HandRow({
  game,
  color,
  orientation,
}: {
  game: GameSnapshot;
  color: PlayerColor;
  orientation: PlayerColor;
}) {
  const t = useTheme();
  const visibleColor = orientation === "black" ? color : color === "black" ? "white" : "black";
  const pieces = game.hands[visibleColor];
  const ownHand = user.value ? myColor(game, user.value.id) === visibleColor : false;
  const canSelectHand = game.status === "active" && ownHand;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 50,
        padding: "6px 4px",
        justifyContent: visibleColor === "white" ? "flex-start" : "flex-end",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, flexShrink: 0 }}>
        {visibleColor === "black" ? "先手" : "後手"}持駒
      </span>
      {pieces.length === 0 && (
        <span style={{ fontFamily: fG, fontSize: 12, color: t.text.tertiary }}>なし</span>
      )}
      {pieces.map((piece) => {
        const sel = ownHand && selectedHand.value === piece.type;
        return (
          <button
            type="button"
            key={piece.type}
            aria-pressed={sel}
            disabled={busy.value || !canSelectHand}
            onClick={() => {
              selectedSquare.value = null;
              selectedHand.value = selectedHand.value === piece.type ? null : piece.type;
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 3,
              padding: "4px 8px 4px 4px",
              backgroundColor: sel ? t.semantic.selected : t.bg.tertiary,
              border: `1px solid ${sel ? t.accent.gold : t.border.default}`,
              borderRadius: R.md,
              cursor: busy.value || !canSelectHand ? "default" : "pointer",
              transition: `all ${MOTION.normal}`,
            }}
          >
            <ShogiPiece kanji={piece.label} size={28} />
            <span style={{ fontFamily: fG, fontSize: 11, fontWeight: 700, color: t.accent.gold }}>
              {piece.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── History panel ────────────────────────────────────
function HistoryPanel() {
  const t = useTheme();
  const game = activeGame.value;
  return (
    <Card title="棋譜">
      {!game && (
        <p style={{ fontFamily: fG, fontSize: 13, color: t.text.tertiary, textAlign: "center", padding: 8 }}>
          対局未選択
        </p>
      )}
      {game && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: fG, fontSize: 12, color: t.text.secondary }}>{game.moves.length}手</span>
          </div>
          <ol
            style={{
              listStyle: "none",
              display: "grid",
              gap: 2,
              maxHeight: "45svh",
              overflowY: "auto",
            }}
          >
            {game.moves.map((move) => (
              <li
                key={move.ply}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr",
                  gap: 8,
                  alignItems: "center",
                  minHeight: 28,
                  padding: "3px 6px",
                  borderBottom: `1px solid ${t.border.subtle}`,
                  backgroundColor: move.ply === game.moves.length ? t.accent.goldDim : "transparent",
                  borderRadius: R.sm,
                }}
              >
                <span
                  style={{
                    fontFamily: fG,
                    fontSize: 10,
                    color: t.text.tertiary,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {move.ply}
                </span>
                <code
                  title={moveUsiTitle(move)}
                  style={{
                    fontFamily: `"SFMono-Regular", Consolas, monospace`,
                    fontSize: 11,
                    color: t.text.primary,
                  }}
                >
                  {moveNotationLabel(move)}
                </code>
              </li>
            ))}
          </ol>
        </>
      )}

      {events.value.length > 0 && (
        <div style={{ marginTop: 12, borderTop: `1px solid ${t.border.subtle}`, paddingTop: 8 }}>
          <p style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary, marginBottom: 6 }}>イベント</p>
          {events.value.slice(-6).map((event) => (
            <p
              key={event.id}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 1fr",
                gap: 6,
                fontFamily: fG,
                fontSize: 10,
                color: t.text.tertiary,
                marginBottom: 2,
              }}
            >
              <span>{event.seq}</span>
              <span>{event.type}</span>
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}

function statusColor(game: GameSnapshot, t: Theme): string {
  if (game.status === "ended") return game.winner ? t.semantic.win : t.semantic.draw;
  if (game.status === "waiting") return t.semantic.away;
  return t.accent.gold;
}

function connectionColor(conn: "idle" | "connecting" | "live" | "reconnecting" | "polling", t: Theme): string {
  if (conn === "live") return t.semantic.online;
  if (conn === "reconnecting" || conn === "polling") return t.semantic.away;
  return t.text.tertiary;
}

// ─── Event handlers (unchanged logic) ────────────────
async function bootstrap(): Promise<void> {
  try {
    const session = await getSession();
    user.value = session.user;
    if (session.user) { await refreshGames(); }
  } catch (error) {
    showError(error);
    user.value = null;
  }
}

async function submitAuth(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const input =
    authMode.value === "register"
      ? { ...Object.fromEntries(form.entries()), termsAccepted: form.get("termsAccepted") === "on" }
      : Object.fromEntries(form.entries());
  await withBusy(async () => {
    const session =
      authMode.value === "register"
        ? await registerAccount(input)
        : await loginAccount(input);
    user.value = session.user;
    await refreshGames();
  });
}

async function submitProfile(event: SubmitEvent): Promise<boolean> {
  event.preventDefault();
  const form = new FormData(event.currentTarget as HTMLFormElement);
  const input = Object.fromEntries(form.entries());
  let ok = false;
  await withBusy(async () => {
    const session = await updateProfile(input);
    user.value = session.user;
    await refreshGames();
    if (activeGame.value) {
      const response = await getGame(activeGame.value.id);
      applyGameSnapshot(response.game);
    }
    ok = true;
  });
  return ok;
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
  if (!user.value) return;
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
  if (!game || !user.value || busy.value) return;
  if (promotionChoice.value) { promotionChoice.value = null; return; }
  const color = myColor(game, user.value.id);
  if (!color || game.status !== "active") return;
  const myTurn = game.currentTurn === color;
  const boardSquare = game.board.find((candidate) => candidate.square === square);
  if (selectedHand.value) {
    if (boardSquare?.piece?.color === color) {
      selectedHand.value = null;
      selectedSquare.value = square;
      return;
    }
    if (myTurn) { await submitMove(dropUsi(selectedHand.value, square)); return; }
    return;
  }
  if (!selectedSquare.value) {
    if (boardSquare?.piece?.color === color) { selectedSquare.value = square; }
    return;
  }
  const from = selectedSquare.value;
  if (from === square) { selectedSquare.value = null; return; }
  if (boardSquare?.piece?.color === color) {
    selectedSquare.value = square;
    return;
  }
  if (!myTurn) return;
  const options = promotionMoveOptions(game, from, square);
  if (options.mustPromote) { await submitMove(options.promotedUsi); return; }
  if (options.canPromote) {
    promotionChoice.value = { baseUsi: options.baseUsi, promotedUsi: options.promotedUsi };
    return;
  }
  await submitMove(options.baseUsi);
}

async function submitMove(usi: string): Promise<void> {
  const game = activeGame.value;
  if (!game || busy.value) return;
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
  if (!game) { events.value = []; return; }
  const response = await getGameEvents(game.id, Math.max(0, game.lastEventSeq - 100));
  events.value = response.events;
}

function connectRealtime(gameId: string): void {
  closeRealtime();
  connection.value = "connecting";
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${protocol}://${window.location.host}/api/games/${gameId}/ws`);
  socket = ws;
  ws.addEventListener("open", () => { reconnectAttempts = 0; connection.value = "live"; stopPolling(); });
  ws.addEventListener("message", (event) => {
    const payload = JSON.parse(String(event.data)) as { type?: string; game?: GameSnapshot };
    if (payload.game) {
      if (socket !== ws || activeGame.value?.id !== gameId) return;
      applyGameSnapshot(payload.game);
      void refreshGames();
      void refreshEvents();
    }
  });
  ws.addEventListener("close", () => { if (socket === ws) { scheduleReconnect(gameId); } });
  ws.addEventListener("error", () => { connection.value = "reconnecting"; });
}

function scheduleReconnect(gameId: string): void {
  if (activeGame.value?.id !== gameId) return;
  connection.value = "reconnecting";
  startPolling(gameId);
  if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); }
  const delay = Math.min(5000, 600 * 2 ** reconnectAttempts);
  reconnectAttempts += 1;
  reconnectTimer = window.setTimeout(() => { connectRealtime(gameId); }, delay);
}

function startPolling(gameId: string): void {
  if (pollingTimer !== null) return;
  pollingTimer = window.setInterval(() => {
    if (activeGame.value?.id !== gameId) { stopPolling(); return; }
    connection.value = "polling";
    void getGame(gameId)
      .then(async (response) => {
        if (activeGame.value?.id !== gameId) return;
        applyGameSnapshot(response.game);
        await refreshGames();
        await refreshEvents();
      })
      .catch(showError);
  }, 5000);
}

function stopPolling(): void {
  if (pollingTimer !== null) { window.clearInterval(pollingTimer); pollingTimer = null; }
}

function closeRealtime(): void {
  if (reconnectTimer !== null) { window.clearTimeout(reconnectTimer); reconnectTimer = null; }
  stopPolling();
  socket?.close();
  socket = null;
  connection.value = "idle";
}

function applyGameSnapshot(game: GameSnapshot): void {
  activeGame.value = game;
  if (!user.value) return;
  const color = myColor(game, user.value.id);
  if (!color || game.status !== "active") {
    selectedSquare.value = null;
    selectedHand.value = null;
    promotionChoice.value = null;
    return;
  }
  const retained = retainedPieceSelection(game, color, {
    selectedSquare: selectedSquare.value,
    selectedHand: selectedHand.value,
  });
  selectedSquare.value = retained.selectedSquare;
  selectedHand.value = retained.selectedHand;
  if (game.currentTurn !== color) {
    promotionChoice.value = null;
  }
}

async function withBusy(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  notice.value = null;
  try { await action(); } catch (error) { showError(error); } finally { busy.value = false; }
}

function showError(error: unknown): void {
  if (error instanceof ApiClientError) { notice.value = error.message; return; }
  if (error instanceof Error) { notice.value = error.message; return; }
  notice.value = "処理に失敗しました。";
}

function navigate(event: MouseEvent, path: string): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
  currentPage.value = pageForPath(path);
}

function goHome(): void {
  if (window.location.pathname !== "/") {
    window.history.pushState(null, "", "/");
  }
  currentPage.value = "home";
}

function pageForPath(pathname: string): "home" | "terms" {
  return pathname.replace(/\/+$/, "") === "/terms" ? "terms" : "home";
}

// ─── Labels ───────────────────────────────────────────
function statusLabel(game: GameSnapshot | GameSummary): string {
  if (game.status === "waiting") return "相手待ち";
  if (game.status === "active") {
    if (game.mode === "cpu") return game.currentTurn === "black" ? "あなたの手番" : "CPU思考中";
    return game.currentTurn === "black" ? "先手番" : "後手番";
  }
  if (game.winner) return `${game.winner.displayName} の勝ち`;
  return "終局";
}

function modeLabel(mode: GameMode): string {
  return mode === "cpu" ? "CPU対戦" : "友達対戦";
}

function waitingLabel(mode: GameMode): string {
  return mode === "cpu" ? "CPU" : "相手待ち";
}

function createGameButtonLabel(): string {
  return gameMode.value === "cpu" ? "CPUと始める" : "合言葉で待ち合わせる";
}

function boardSquareLabel(square: string, piece: BoardPiece | null, selected: boolean, legalDestination: boolean): string {
  const sel = selected ? " 選択中" : "";
  const legal = legalDestination ? " 合法手" : "";
  if (!piece) return `${square} 空き${sel}${legal}`;
  return `${square} ${piece.color === "black" ? "先手" : "後手"} ${piece.label}${sel}${legal}`;
}

function connectionLabel(): string {
  switch (connection.value) {
    case "connecting": return "接続中";
    case "live": return "接続";
    case "reconnecting": return "再接続中";
    case "polling": return "同期中";
    case "idle": return "待機";
  }
}
