import { useState, useRef, useEffect } from "preact/hooks";
import {
  DARK,
  LIGHT,
  ThemeCtx,
  ShogiPiece,
  Btn,
  Badge,
  Card,
  Toast,
  Modal,
  StatusChip,
  Input,
  FieldGroup,
  fG,
  fS,
  R,
  MOTION,
  ZINDEX,
  useTheme,
} from "./design-system";
import type { Theme } from "./design-system";

// ─── Layout helpers ───────────────────────────────────

function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  const t = useTheme();
  return (
    <section style={{ marginBottom: 56 }}>
      <h2
        style={{
          fontFamily: fS,
          fontSize: 18,
          fontWeight: 700,
          color: t.text.primary,
          marginBottom: 4,
          paddingBottom: 10,
          borderBottom: `2px solid ${t.border.default}`,
        }}
      >
        {title}
      </h2>
      <div style={{ paddingTop: 24 }}>{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: preact.ComponentChildren }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 700, color: t.text.tertiary, letterSpacing: "0.07em", marginBottom: 14 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({ children, gap = 12 }: { children: preact.ComponentChildren; gap?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "flex-start" }}>
      {children}
    </div>
  );
}

function TokenLabel({ top, bottom }: { top: string; bottom: string }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <span style={{ fontFamily: fG, fontSize: 10, color: t.text.secondary, textAlign: "center" }}>{top}</span>
      <span style={{ fontFamily: "monospace", fontSize: 9, color: t.text.tertiary }}>{bottom}</span>
    </div>
  );
}

// ─── Token sections ───────────────────────────────────

function ColorTokens({ theme: t }: { theme: Theme }) {
  function Swatch({ color, label }: { color: string; label: string }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ width: 64, height: 40, borderRadius: R.md, backgroundColor: color, border: `1px solid ${t.border.default}` }} />
        <TokenLabel top={label} bottom={color} />
      </div>
    );
  }

  return (
    <>
      <SubSection title="背景">
        <Row>
          {(["primary", "secondary", "tertiary", "elevated"] as const).map((k) => (
            <Swatch key={k} color={t.bg[k]} label={`bg.${k}`} />
          ))}
        </Row>
      </SubSection>
      <SubSection title="テキスト">
        <Row>
          {(["primary", "secondary", "tertiary"] as const).map((k) => (
            <Swatch key={k} color={t.text[k]} label={`text.${k}`} />
          ))}
          <Swatch color={t.text.inverse} label="text.inverse" />
        </Row>
      </SubSection>
      <SubSection title="アクセント">
        <Row>
          <Swatch color={t.accent.gold} label="accent.gold" />
          <Swatch color={t.accent.goldLight} label="accent.goldLight" />
          <Swatch color={t.accent.goldDim} label="accent.goldDim" />
          <Swatch color={t.accent.vermillion} label="accent.vermillion" />
          <Swatch color={t.accent.vermillionDim} label="accent.vermillionDim" />
          <Swatch color={t.accent.jade} label="accent.jade" />
          <Swatch color={t.accent.jadeDim} label="accent.jadeDim" />
        </Row>
      </SubSection>
      <SubSection title="セマンティック">
        <Row>
          <Swatch color={t.semantic.win} label="semantic.win" />
          <Swatch color={t.semantic.lose} label="semantic.lose" />
          <Swatch color={t.semantic.draw} label="semantic.draw" />
          <Swatch color={t.semantic.check} label="semantic.check" />
          <Swatch color={t.semantic.lastMove} label="semantic.lastMove" />
          <Swatch color={t.semantic.legalMove} label="semantic.legalMove" />
          <Swatch color={t.semantic.selected} label="semantic.selected" />
          <Swatch color={t.semantic.online} label="semantic.online" />
          <Swatch color={t.semantic.offline} label="semantic.offline" />
          <Swatch color={t.semantic.away} label="semantic.away" />
        </Row>
      </SubSection>
      <SubSection title="将棋盤">
        <Row>
          <Swatch color={t.board.kaya} label="board.kaya" />
          <Swatch color={t.board.kayaLight} label="board.kayaLight" />
          <Swatch color={t.board.kayaDark} label="board.kayaDark" />
          <Swatch color={t.board.grid} label="board.grid" />
          <Swatch color={t.board.star} label="board.star" />
        </Row>
      </SubSection>
      <SubSection title="駒">
        <Row>
          <Swatch color={t.piece.face} label="piece.face" />
          <Swatch color={t.piece.text} label="piece.text" />
          <Swatch color={t.piece.border} label="piece.border" />
          <Swatch color={t.piece.promoted} label="piece.promoted" />
          <Swatch color={t.piece.promotedGlow} label="piece.promotedGlow" />
        </Row>
      </SubSection>
    </>
  );
}

function RadiusTokens({ theme: t }: { theme: Theme }) {
  const entries = Object.entries(R);
  return (
    <SubSection title="角丸 (R)">
      <Row gap={20}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: val,
                backgroundColor: t.accent.goldDim,
                border: `2px solid ${t.accent.gold}`,
              }}
            />
            <TokenLabel top={`R.${key}`} bottom={`${String(val)}px`} />
          </div>
        ))}
      </Row>
    </SubSection>
  );
}

function ShadowTokens({ theme: t }: { theme: Theme }) {
  const entries = Object.entries(t.shadow);
  return (
    <SubSection title="シャドウ (shadow)">
      <Row gap={20}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 64,
                height: 48,
                borderRadius: R.md,
                backgroundColor: t.bg.elevated,
                boxShadow: val,
              }}
            />
            <TokenLabel top={`shadow.${key}`} bottom="" />
          </div>
        ))}
      </Row>
    </SubSection>
  );
}

function BorderTokens({ theme: t }: { theme: Theme }) {
  return (
    <SubSection title="ボーダー (border)">
      <Row gap={20}>
        {(["subtle", "default", "strong"] as const).map((key) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 64,
                height: 40,
                borderRadius: R.md,
                backgroundColor: t.bg.secondary,
                border: `2px solid ${t.border[key]}`,
              }}
            />
            <TokenLabel top={`border.${key}`} bottom="" />
          </div>
        ))}
      </Row>
    </SubSection>
  );
}

function MotionTokens() {
  const t = useTheme();
  const [triggered, setTrigger] = useState<string | null>(null);
  const entries = Object.entries(MOTION);

  function fire(key: string) {
    setTrigger(null);
    requestAnimationFrame(() => { setTrigger(key); });
  }

  return (
    <SubSection title="アニメーション (MOTION)">
      <Row gap={16}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 120 }}>
            <div style={{ overflow: "hidden", width: 120, height: 40, borderRadius: R.md, backgroundColor: t.bg.tertiary, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: triggered === key ? "calc(100% - 36px)" : 4,
                  top: 4,
                  width: 32,
                  height: 32,
                  borderRadius: R.md,
                  backgroundColor: t.accent.gold,
                  transition: triggered === key ? `left ${val}` : "none",
                }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontFamily: fG, fontSize: 10, color: t.text.secondary }}>MOTION.{key}</span>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: t.text.tertiary }}>{val}</span>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => { fire(key); }}>再生</Btn>
          </div>
        ))}
      </Row>
    </SubSection>
  );
}

function ZIndexTokens() {
  const t = useTheme();
  return (
    <SubSection title="Z-index (ZINDEX)">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.entries(ZINDEX).map(([key, val]) => (
          <div
            key={key}
            style={{
              padding: "6px 12px",
              borderRadius: R.md,
              backgroundColor: t.bg.tertiary,
              border: `1px solid ${t.border.default}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span style={{ fontFamily: fG, fontSize: 10, fontWeight: 700, color: t.text.secondary }}>ZINDEX.{key}</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: t.accent.gold }}>{val}</span>
          </div>
        ))}
      </div>
    </SubSection>
  );
}

// ─── Shogi-specific ───────────────────────────────────

function BoardStates({ theme: t }: { theme: Theme }) {
  const stateColors: { key: string; label: string; color: string }[] = [
    { key: "lastMove", label: "直前の手", color: t.semantic.lastMove },
    { key: "legalMove", label: "合法手", color: t.semantic.legalMove },
    { key: "selected", label: "選択中", color: t.semantic.selected },
    { key: "check", label: "王手", color: t.semantic.check },
  ];

  const CELL = 64;
  const PIECE_SZ = 46;

  return (
    <SubSection title="盤面ハイライト色">
      <Row gap={32}>
        {stateColors.map(({ key, label, color }) => (
          <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: CELL,
                height: CELL,
                backgroundColor: t.board.kaya,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid ${t.board.grid}`,
              }}
            >
              <div style={{ position: "absolute", inset: 0, backgroundColor: color }} />
              <div style={{ position: "relative" }}>
                <ShogiPiece kanji="歩" size={PIECE_SZ} />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.secondary }}>{label}</span>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: t.text.tertiary }}>semantic.{key}</span>
            </div>
          </div>
        ))}
      </Row>
    </SubSection>
  );
}

function PieceGallery() {
  const t = useTheme();
  const CELL = 64;
  const PIECE = 48;

  const normal: { kanji: string; name: string }[] = [
    { kanji: "歩", name: "歩兵" }, { kanji: "香", name: "香車" },
    { kanji: "桂", name: "桂馬" }, { kanji: "銀", name: "銀将" },
    { kanji: "金", name: "金将" }, { kanji: "角", name: "角行" },
    { kanji: "飛", name: "飛車" }, { kanji: "玉", name: "玉将" },
  ];
  const promoted: { kanji: string; name: string }[] = [
    { kanji: "と", name: "と金" }, { kanji: "杏", name: "成香" },
    { kanji: "圭", name: "成桂" }, { kanji: "全", name: "成銀" },
    { kanji: "馬", name: "龍馬" }, { kanji: "龍", name: "龍王" },
  ];

  function PieceCell({ kanji, name, isPromoted = false }: { kanji: string; name: string; isPromoted?: boolean }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div
          style={{
            width: CELL,
            height: CELL,
            backgroundColor: t.board.kaya,
            border: `1px solid ${t.board.grid}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShogiPiece kanji={kanji} size={PIECE} promoted={isPromoted} />
        </div>
        <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>{name}</span>
      </div>
    );
  }

  return (
    <>
      <SubSection title="駒一覧">
        <Row gap={8}>
          {normal.map(({ kanji, name }) => <PieceCell key={kanji} kanji={kanji} name={name} />)}
        </Row>
      </SubSection>
      <SubSection title="成り駒">
        <Row gap={8}>
          {promoted.map(({ kanji, name }) => <PieceCell key={kanji} kanji={kanji} name={name} isPromoted />)}
        </Row>
      </SubSection>
      <SubSection title="各種状態">
        <Row gap={24}>
          {([
            { kanji: "歩", label: "通常", props: {} },
            { kanji: "と", label: "成り", props: { promoted: true } },
            { kanji: "歩", label: "反転（相手）", props: { flipped: true } },
            { kanji: "歩", label: "選択中", props: { selected: true } },
            { kanji: "歩", label: "非アクティブ", props: { dim: true } },
          ] as const).map(({ kanji, label, props }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <ShogiPiece kanji={kanji} size={52} {...props} />
              <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>{label}</span>
            </div>
          ))}
        </Row>
      </SubSection>
      <SubSection title="サイズ">
        <Row gap={24}>
          {([28, 36, 44, 52, 64] as const).map((sz) => (
            <div key={sz} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <ShogiPiece kanji="王" size={sz} />
              <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>size={sz}</span>
            </div>
          ))}
        </Row>
      </SubSection>
    </>
  );
}

// ─── Interactive board demo ───────────────────────────

function InteractiveBoardDemo() {
  const t = useTheme();
  const [grid, setGrid] = useState<BoardGrid>(() => BOARD_INITIAL.map(row => [...row]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<{ ply: number; label: string }[]>([]);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history.length]);

  const FILES = ["９","８","７","６","５","４","３","２","１"];
  const RANKS = ["一","二","三","四","五","六","七","八","九"];

  function handleCellClick(ci: number, ri: number) {
    if (selected) {
      const sc = selected[0] ?? 0;
      const sr = selected[1] ?? 0;
      if (sc === ci && sr === ri) {
        setSelected(null);
        return;
      }
      const srcPiece = grid[sr]?.[sc] ?? null;
      if (srcPiece) {
        const newGrid = grid.map(row => [...row]);
        const targetRow = newGrid[ri];
        const srcRow = newGrid[sr];
        if (targetRow && srcRow) {
          targetRow[ci] = srcPiece;
          srcRow[sc] = null;
        }
        const color = srcPiece.color === "b" ? "▲" : "△";
        const label = `${color}${FILES[ci] ?? ""}${RANKS[ri] ?? ""}${srcPiece.kanji}`;
        setGrid(newGrid);
        setHistory(h => [...h, { ply: h.length + 1, label }]);
      }
      setSelected(null);
    } else if (grid[ri]?.[ci]) {
      setSelected([ci, ri]);
    }
  }

  function reset() {
    setGrid(BOARD_INITIAL.map(row => [...row]));
    setSelected(null);
    setHistory([]);
  }

  return (
    <SubSection title="インタラクティブ盤面 — 実際に動かして確認">
      <p style={{ fontFamily: fG, fontSize: 12, color: t.text.secondary, marginBottom: 12 }}>
        駒をクリックして選択し、移動先をクリックすると動かせます（将棋ルール無視）
      </p>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <StaticBoard
            grid={grid}
            {...(selected ? { selected } : {})}
            onCellClick={handleCellClick}
            cellSize={44}
          />
          <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
            <Btn variant="ghost" size="sm" onClick={reset}>リセット</Btn>
          </div>
        </div>
        <div style={{ minWidth: 160 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: fG, fontSize: 13, fontWeight: 700, color: t.text.primary }}>棋譜</span>
            <span style={{ fontFamily: fG, fontSize: 11, color: t.text.tertiary }}>{history.length}手</span>
          </div>
          <ol
            ref={listRef}
            style={{
              listStyle: "none",
              display: "grid",
              gap: 2,
              maxHeight: "45svh",
              overflowY: "auto",
            }}
          >
            {history.length === 0 && (
              <li style={{ padding: "8px 6px", fontFamily: fG, fontSize: 11, color: t.text.tertiary, textAlign: "center" }}>
                まだ手がありません
              </li>
            )}
            {history.map((m) => (
              <li
                key={m.ply}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr",
                  gap: 6,
                  alignItems: "center",
                  minHeight: 26,
                  padding: "3px 6px",
                  borderBottom: `1px solid ${t.border.subtle}`,
                  backgroundColor: m.ply === history.length ? t.accent.goldDim : "transparent",
                  borderRadius: R.sm,
                }}
              >
                <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary, fontVariantNumeric: "tabular-nums" }}>
                  {m.ply}
                </span>
                <code style={{ fontFamily: `"SFMono-Regular",Consolas,monospace`, fontSize: 11, color: t.text.primary }}>
                  {m.label}
                </code>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SubSection>
  );
}

// ─── Component sections ───────────────────────────────

function FormControls() {
  const [modalOpen, setModalOpen] = useState(false);
  const [showToast, setShowToast] = useState<"info" | "success" | "error" | null>(null);

  function fireToast(type: "info" | "success" | "error") {
    setShowToast(null);
    requestAnimationFrame(() => {
      setShowToast(type);
      setTimeout(() => { setShowToast(null); }, 2500);
    });
  }

  return (
    <>
      <SubSection title="Input — フォーカスで金色ボーダー">
        <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
          <FieldGroup id="demo-text" label="テキスト" help="通常のテキスト入力">
            <Input id="demo-text" placeholder="ハンドル名" />
          </FieldGroup>
          <FieldGroup id="demo-password" label="パスワード" help="入力内容はマスクされます">
            <Input id="demo-password" type="password" placeholder="パスワード" />
          </FieldGroup>
          <FieldGroup id="demo-disabled" label="無効化">
            <Input id="demo-disabled" disabled value="編集不可" />
          </FieldGroup>
        </div>
      </SubSection>

      <SubSection title="Btn — バリアントとサイズ">
        <div style={{ display: "grid", gap: 12 }}>
          <Row>
            <Btn variant="primary">Primary</Btn>
            <Btn variant="secondary">Secondary</Btn>
            <Btn variant="ghost">Ghost</Btn>
            <Btn variant="danger">Danger</Btn>
            <Btn variant="primary" disabled>Disabled</Btn>
          </Row>
          <Row>
            <Btn variant="primary" size="sm">Small</Btn>
            <Btn variant="primary" size="md">Medium</Btn>
            <Btn variant="primary" size="lg">Large</Btn>
          </Row>
          <Row>
            <Btn variant="primary" onClick={() => { fireToast("success"); }}>Toast (success)</Btn>
            <Btn variant="secondary" onClick={() => { fireToast("info"); }}>Toast (info)</Btn>
            <Btn variant="danger" onClick={() => { fireToast("error"); }}>Toast (error)</Btn>
            <Btn variant="ghost" onClick={() => { setModalOpen(true); }}>Modal を開く</Btn>
          </Row>
        </div>
      </SubSection>

      <SubSection title="Badge">
        <Row>
          <Badge variant="default">Default</Badge>
          <Badge variant="gold">Gold</Badge>
          <Badge variant="win">勝利</Badge>
          <Badge variant="lose">敗北</Badge>
        </Row>
      </SubSection>

      <SubSection title="StatusChip">
        <Row>
          <StatusChip color="#4CAF50">● オンライン</StatusChip>
          <StatusChip color="#9A9488">● オフライン</StatusChip>
          <StatusChip color="#E0C76E">● 離席中</StatusChip>
          <StatusChip>デフォルト</StatusChip>
        </Row>
      </SubSection>

      <SubSection title="Card">
        <Row gap={16}>
          {([
            { title: "タイトルなし", accent: undefined, body: "コンテンツ" },
            { title: "ゴールド", accent: "#C9A84C", body: "accent付き" },
            { title: "勝利", accent: "#2D8B6F", body: "翡翠アクセント" },
            { title: "敗北", accent: "#C41E3A", body: "朱アクセント" },
          ] as const).map(({ title, accent, body }) => (
            <div key={title} style={{ width: 180 }}>
              <Card title={title} {...(accent !== undefined ? { accent } : {})}>
                <p style={{ fontFamily: fG, fontSize: 13, margin: 0 }}>{body}</p>
              </Card>
            </div>
          ))}
        </Row>
      </SubSection>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); }} title="モーダルのサンプル">
        <p style={{ fontFamily: fG, fontSize: 13, margin: "0 0 16px" }}>
          背景クリックまたは下のボタンで閉じます。
        </p>
        <Row>
          <Btn variant="primary" onClick={() => { setModalOpen(false); }}>OK</Btn>
          <Btn variant="ghost" onClick={() => { setModalOpen(false); }}>キャンセル</Btn>
        </Row>
      </Modal>

      {showToast && <Toast message={`Toast (${showToast})`} type={showToast} />}
    </>
  );
}

function TypographySection() {
  const t = useTheme();
  const rows = [
    { family: fS, size: 28, weight: 800, label: "明朝体 28 / 800" },
    { family: fS, size: 20, weight: 700, label: "明朝体 20 / 700" },
    { family: fS, size: 16, weight: 600, label: "明朝体 16 / 600" },
    { family: fG, size: 16, weight: 600, label: "ゴシック 16 / 600" },
    { family: fG, size: 13, weight: 400, label: "ゴシック 13 / 400" },
    { family: fG, size: 11, weight: 400, label: "ゴシック 11 / 400" },
  ];
  return (
    <SubSection title="タイポグラフィ">
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map(({ family, size, weight, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary, minWidth: 120 }}>{label}</span>
            <span style={{ fontFamily: family, fontSize: size, fontWeight: weight, color: t.text.primary }}>
              将棋をしよう
            </span>
          </div>
        ))}
      </div>
    </SubSection>
  );
}

// ─── Screen flow mock data ────────────────────────────

type MockPiece = { kanji: string; color: "b" | "w"; promoted?: boolean };
type BoardGrid = (MockPiece | null)[][];
const bk = (kanji: string, promoted?: true): MockPiece => promoted ? { kanji, color: "b", promoted } : { kanji, color: "b" };
const wh = (kanji: string, promoted?: true): MockPiece => promoted ? { kanji, color: "w", promoted } : { kanji, color: "w" };

// Mid-game: white played 3三→3四 (col6 row2→row3), black to move
const BOARD_ACTIVE: BoardGrid = [
  [wh("香"),wh("桂"),wh("銀"),wh("金"),wh("王"),wh("金"),wh("銀"),wh("桂"),wh("香")],
  [null,    wh("飛"),null,    null,    null,    null,    null,    wh("角"),null    ],
  [wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩"),null,    wh("歩"),wh("歩")],
  [null,    null,    null,    null,    null,    null,    wh("歩"),null,    null    ],
  [null,    null,    null,    null,    null,    null,    null,    null,    null    ],
  [null,    null,    bk("歩"),null,    null,    null,    null,    null,    null    ],
  [bk("歩"),bk("歩"),null,    bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩")],
  [null,    bk("角"),null,    null,    null,    null,    null,    bk("飛"),null    ],
  [bk("香"),bk("桂"),bk("銀"),bk("金"),bk("王"),bk("金"),bk("銀"),bk("桂"),bk("香")],
];
const BOARD_INITIAL: BoardGrid = [
  [wh("香"),wh("桂"),wh("銀"),wh("金"),wh("王"),wh("金"),wh("銀"),wh("桂"),wh("香")],
  [null,    wh("飛"),null,    null,    null,    null,    null,    wh("角"),null   ],
  [wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩"),wh("歩")],
  [null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  [null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  [null,    null,    null,    null,    null,    null,    null,    null,    null   ],
  [bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩"),bk("歩")],
  [null,    bk("角"),null,    null,    null,    null,    null,    bk("飛"),null   ],
  [bk("香"),bk("桂"),bk("銀"),bk("金"),bk("玉"),bk("金"),bk("銀"),bk("桂"),bk("香")],
];

const LAST_FROM: [number, number] = [6, 2];
const LAST_TO:   [number, number] = [6, 3];
const SEL_CELL:  [number, number] = [2, 6]; // 7七の歩を選択中
const LEGAL_MVS: [number, number][] = [[2, 5], [2, 4]];

// ─── Static board ─────────────────────────────────────

function cellEq(cell: [number, number] | undefined, c: number, r: number): boolean {
  return cell?.[0] === c && cell[1] === r;
}

function StaticBoard({
  grid, selected, lastFrom, lastTo, legalMoves, checkCell, cellSize = 36, onCellClick,
}: {
  grid: BoardGrid;
  selected?: [number, number];
  lastFrom?: [number, number];
  lastTo?: [number, number];
  legalMoves?: [number, number][];
  checkCell?: [number, number];
  cellSize?: number;
  onCellClick?: (ci: number, ri: number) => void;
}) {
  const t = useTheme();
  const ps = Math.floor(cellSize * 0.76);
  const RW = 18;
  const files = ["９","８","７","６","５","４","３","２","１"];
  const ranks = ["一","二","三","四","五","六","七","八","九"];
  const STARS: [number, number][] = [[2,2],[2,5],[5,2],[5,5]];
  return (
    <div style={{ width: "fit-content", margin: "8px auto" }}>
      <div style={{ display: "flex", paddingRight: RW }}>
        {files.map((n, i) => (
          <div key={i} style={{ width: cellSize, textAlign: "center", fontFamily: fS, fontSize: Math.max(8, cellSize * 0.22), color: t.board.grid, opacity: 0.8 }}>{n}</div>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(9,${String(cellSize)}px)`, gridTemplateRows: `repeat(9,${String(cellSize)}px)`, background: `linear-gradient(135deg,${t.board.kayaLight} 0%,${t.board.kaya} 50%,${t.board.kayaDark} 100%)`, border: `2px solid ${t.board.grid}`, boxShadow: t.shadow.lg }}>
          {grid.flatMap((row, ri) => row.map((piece, ci) => {
            const isStar  = STARS.some(([r,c]) => r===ri && c===ci);
            const isSel   = cellEq(selected,  ci, ri);
            const isLast  = cellEq(lastFrom,  ci, ri) || cellEq(lastTo, ci, ri);
            const isLegal = legalMoves?.some(([lc,lr]) => lc===ci && lr===ri) ?? false;
            const isCheck = cellEq(checkCell, ci, ri);
            const bg = isSel ? t.semantic.selected : isCheck ? t.semantic.check : isLast ? t.semantic.lastMove : isLegal ? t.semantic.legalMove : "transparent";
            return (
              <div key={`${String(ci)}-${String(ri)}`} onClick={onCellClick ? () => { onCellClick(ci, ri); } : undefined} style={{ width: cellSize, height: cellSize, display: "flex", alignItems: "center", justifyContent: "center", border: `0.5px solid ${t.board.grid}`, backgroundColor: bg, position: "relative", cursor: onCellClick ? "pointer" : "default" }}>
                {isStar && <div style={{ position: "absolute", top: -2, left: -2, width: 4, height: 4, borderRadius: R.full, backgroundColor: t.board.star }} />}
                {piece && <ShogiPiece kanji={piece.kanji} size={ps} {...(piece.promoted ? { promoted: true } : {})} flipped={piece.color==="w"} selected={isSel} />}
              </div>
            );
          }))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", width: RW }}>
          {ranks.map((n, i) => (
            <div key={i} style={{ height: cellSize, display: "flex", alignItems: "center", paddingLeft: 3, fontFamily: fS, fontSize: Math.max(8, cellSize*0.22), color: t.board.grid, opacity: 0.8 }}>{n}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Screen mockup building blocks ───────────────────

function MockHand({ side, pieces }: { side: "black"|"white"; pieces: { kanji: string; count: number }[] }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, padding: "4px 0", justifyContent: side==="white" ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
      <span style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary }}>{side==="black" ? "先手" : "後手"}持駒</span>
      {pieces.length===0 && <span style={{ fontFamily: fG, fontSize: 12, color: t.text.tertiary }}>なし</span>}
      {pieces.map(({ kanji, count }) => (
        <div key={kanji} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px 4px 4px", backgroundColor: t.bg.tertiary, border: `1px solid ${t.border.default}`, borderRadius: R.md }}>
          <ShogiPiece kanji={kanji} size={26} />
          <span style={{ fontFamily: fG, fontSize: 11, fontWeight: 700, color: t.accent.gold }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function AppHeaderMock({ userSlot }: { userSlot?: preact.ComponentChildren }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: `1px solid ${t.border.subtle}`, backgroundColor: t.bg.secondary }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: fS, fontSize: 18, fontWeight: 800, color: t.text.primary }}>将棋をしよう</span>
        <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>workers.dev free start</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {userSlot}
        <div style={{ width: 28, height: 28, borderRadius: R.full, backgroundColor: t.bg.tertiary, border: `1px solid ${t.border.default}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: t.text.secondary }}>☽</div>
      </div>
    </div>
  );
}

function ScreenFrame({ label, children }: { label: string; children: preact.ComponentChildren }) {
  const t = useTheme();
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 700, color: t.text.tertiary, letterSpacing: "0.06em", marginBottom: 10 }}>{label}</p>
      <div style={{ border: `2px solid ${t.border.default}`, borderRadius: R.xl, overflow: "hidden", boxShadow: t.shadow.md }}>
        {children}
      </div>
    </div>
  );
}

function OnlineChip() {
  const t = useTheme();
  return (
    <StatusChip color={t.semantic.online}>
      <span style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: t.semantic.online, display: "inline-block" }} />
      nakata
    </StatusChip>
  );
}

// ─── Panel mockups ────────────────────────────────────

function MockGameListPanel({ mode, showWaiting }: { mode: "cpu"|"friend"; showWaiting?: boolean }) {
  const t = useTheme();
  const games = [
    { id:"1", b:"nakata", w:"CPU",    status:"active",  moves:12, mode:"cpu",    sel:true  },
    { id:"2", b:"nakata", w:"CPU",    status:"ended",   moves:45, mode:"cpu",    sel:false },
    ...(showWaiting ? [{ id:"3", b:"nakata", w:null, status:"waiting", moves:0, mode:"friend", sel:false }] : []),
  ];
  return (
    <div style={{ backgroundColor: t.bg.elevated, borderRadius: R.lg, border: `1px solid ${t.border.default}`, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ fontFamily: fS, fontSize: 15, fontWeight: 700, color: t.text.primary }}>対局</h2>
        <Btn variant="secondary" size="sm">更新</Btn>
      </div>
      <div style={{ borderRadius: R.md, border: `1px solid ${t.border.default}`, padding: "10px 12px", display: "grid", gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, letterSpacing: "0.05em" }}>対戦モード</p>
        {(["cpu","friend"] as const).map((m) => (
          <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: fG, fontSize: 13, fontWeight: mode===m ? 600 : 400, color: t.text.primary, cursor: "pointer" }}>
            <input type="radio" readOnly checked={mode===m} style={{ accentColor: t.accent.gold }} />
            {m==="cpu" ? "CPU対戦" : "友達対戦"}
          </label>
        ))}
        {mode==="friend" && (
          <div style={{ marginTop: 4 }}>
            <FieldGroup id="m-pc" label="合言葉" help="12〜64文字。推測されにくい合言葉を相手だけに共有します。">
              <Input id="m-pc" placeholder="secret-word-example-12" />
            </FieldGroup>
          </div>
        )}
      </div>
      <Btn variant="primary" size="md" full>{mode==="cpu" ? "CPUと始める" : "合言葉で待ち合わせる"}</Btn>
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        {games.map((g) => (
          <div key={g.id} style={{ display: "grid", gap: 4, padding: "8px 10px", backgroundColor: g.sel ? t.accent.jadeDim : t.bg.tertiary, border: `1px solid ${g.sel ? t.accent.jade : t.border.subtle}`, borderRadius: R.md }}>
            <span style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: fG, fontSize: 12 }}>
              <strong style={{ color: t.text.primary }}>{g.b}</strong>
              <span style={{ color: t.text.tertiary }}>対</span>
              <strong style={{ color: t.text.primary }}>{g.w ?? "相手待ち"}</strong>
            </span>
            <span style={{ fontFamily: fG, fontSize: 11, color: t.text.tertiary }}>
              {g.mode==="cpu" ? "CPU対戦" : "友達対戦"} / {g.status==="waiting" ? "相手待ち" : g.status==="active" ? `${String(g.moves)}手` : "終局"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockBoardPanel({ gameState }: { gameState: "my-turn"|"cpu-thinking"|"won"|"waiting" }) {
  const t = useTheme();
  const statusMap: Record<typeof gameState, { label: string; color: string }> = {
    "my-turn":      { label: "あなたの手番",   color: t.accent.gold },
    "cpu-thinking": { label: "CPU思考中",      color: t.semantic.away },
    "won":          { label: "nakata の勝ち",  color: t.semantic.win },
    "waiting":      { label: "相手待ち",        color: t.semantic.away },
  };
  const { label, color } = statusMap[gameState];
  const isPlaying = gameState==="my-turn" || gameState==="cpu-thinking";
  return (
    <div style={{ backgroundColor: t.bg.secondary, borderRadius: R.lg, border: `1px solid ${t.border.subtle}`, padding: 12, boxShadow: t.shadow.sm }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <StatusChip color={color}>{label}</StatusChip>
          <h2 style={{ fontFamily: fS, fontSize: 13, fontWeight: 700, color: t.text.primary, marginTop: 5 }}>
            nakata 対 {gameState==="waiting" ? "相手待ち" : "CPU"}
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusChip color={isPlaying ? t.semantic.online : t.text.tertiary}>{isPlaying ? "接続" : "待機"}</StatusChip>
          {gameState==="my-turn" && <Btn variant="danger" size="sm">投了</Btn>}
        </div>
      </div>
      <MockHand side="white" pieces={gameState==="won" ? [{ kanji:"歩", count:2 }] : []} />
      <StaticBoard
        grid={BOARD_ACTIVE}
        {...(gameState==="my-turn" ? { selected: SEL_CELL, legalMoves: LEGAL_MVS } : {})}
        {...(gameState==="won" ? { checkCell: [4, 0] as [number, number] } : {})}
        lastFrom={LAST_FROM}
        lastTo={LAST_TO}
        cellSize={28}
      />
      <MockHand side="black" pieces={gameState!=="waiting" ? [{ kanji:"歩", count:1 }] : []} />
    </div>
  );
}

const MOCK_MOVES = [
  {ply:1,usi:"7g7f"},{ply:2,usi:"3c3d"},{ply:3,usi:"2g2f"},
  {ply:4,usi:"8c8d"},{ply:5,usi:"2f2e"},{ply:6,usi:"8d8e"},
  {ply:7,usi:"2e2d"},{ply:8,usi:"2c2d"},{ply:9,usi:"B*4e"},
  {ply:10,usi:"2d2e"},{ply:11,usi:"P*2f"},{ply:12,usi:"2e3e"},
];

function MockHistoryPanel() {
  const t = useTheme();
  return (
    <div style={{ backgroundColor: t.bg.elevated, borderRadius: R.lg, border: `1px solid ${t.border.default}`, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ fontFamily: fS, fontSize: 15, fontWeight: 700, color: t.text.primary }}>棋譜</h2>
        <span style={{ fontFamily: fG, fontSize: 12, color: t.text.secondary }}>{MOCK_MOVES.length}手</span>
      </div>
      <ol style={{ listStyle: "none", display: "grid", gap: 2, maxHeight: 280, overflowY: "auto" }}>
        {MOCK_MOVES.map((m) => (
          <li key={m.ply} style={{ display: "grid", gridTemplateColumns: "26px 1fr", gap: 8, alignItems: "center", minHeight: 26, padding: "3px 6px", borderBottom: `1px solid ${t.border.subtle}`, backgroundColor: m.ply===MOCK_MOVES.length ? t.accent.goldDim : "transparent", borderRadius: R.sm }}>
            <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary, fontVariantNumeric: "tabular-nums" }}>{m.ply}</span>
            <code style={{ fontFamily: `"SFMono-Regular",Consolas,monospace`, fontSize: 11, color: t.text.primary }}>{m.usi}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Full play screen layout ──────────────────────────

function PlayScreenMock({ gameState }: { gameState: "my-turn"|"cpu-thinking"|"won" }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 290px 140px", gap: 12, alignItems: "start", minWidth: 634 }}>
      <MockGameListPanel mode="cpu" />
      <MockBoardPanel gameState={gameState} />
      <MockHistoryPanel />
    </div>
  );
}

// ─── Screen flows section ─────────────────────────────

function ScreenFlows() {
  const t = useTheme();

  return (
    <>
      <ScreenFrame label="① 認証画面（新規登録タブ）">
        <AppHeaderMock />
        <div style={{ backgroundColor: t.bg.primary, padding: "32px 24px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "min(380px,100%)", backgroundColor: t.bg.elevated, borderRadius: R.xl, border: `1px solid ${t.border.default}`, boxShadow: t.shadow.lg, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${t.border.subtle}` }}>
              {(["新規登録","ログイン"] as const).map((lb, i) => (
                <div key={lb} style={{ padding: "14px", fontFamily: fG, fontSize: 13, fontWeight: 600, textAlign: "center", color: i===0 ? t.accent.gold : t.text.tertiary, borderBottom: `2px solid ${i===0 ? t.accent.gold : "transparent"}` }}>{lb}</div>
              ))}
            </div>
            <div style={{ display: "grid", gap: 16, padding: 24 }}>
              <FieldGroup id="sf-h" label="ハンドル" help="3〜24文字。半角英数字と _ のみ。cpu は予約済み。">
                <Input id="sf-h" placeholder="例: shogi_master" />
              </FieldGroup>
              <FieldGroup id="sf-p" label="パスワード" help="8〜128文字。個人情報は登録しません。">
                <Input id="sf-p" type="password" placeholder="••••••••" />
              </FieldGroup>
              <Btn variant="primary" size="lg" full>登録して始める</Btn>
            </div>
          </div>
        </div>
      </ScreenFrame>

      <ScreenFrame label="② ロビー — CPU対戦モード（対局未選択）">
        <AppHeaderMock userSlot={<OnlineChip />} />
        <div style={{ backgroundColor: t.bg.primary, padding: "16px", display: "grid", gridTemplateColumns: "190px 1fr", gap: 14, alignItems: "start" }}>
          <MockGameListPanel mode="cpu" />
          <div style={{ backgroundColor: t.bg.secondary, borderRadius: R.lg, border: `1px solid ${t.border.subtle}`, display: "grid", placeItems: "center", minHeight: 340, color: t.text.tertiary, fontFamily: fG, fontSize: 14 }}>対局を選択してください</div>
        </div>
      </ScreenFrame>

      <ScreenFrame label="③ ロビー — 友達対戦モード（合言葉フォーム + 相手待ち対局）">
        <AppHeaderMock userSlot={<OnlineChip />} />
        <div style={{ backgroundColor: t.bg.primary, padding: "16px", display: "grid", gridTemplateColumns: "190px 1fr", gap: 14, alignItems: "start" }}>
          <MockGameListPanel mode="friend" showWaiting />
          <div style={{ backgroundColor: t.bg.secondary, borderRadius: R.lg, border: `1px solid ${t.border.subtle}`, display: "grid", placeItems: "center", minHeight: 340, color: t.text.tertiary, fontFamily: fG, fontSize: 14, padding: 24, textAlign: "center", gap: 8 }}>
            <StatusChip color={t.semantic.away}>相手待ち</StatusChip>
            <p style={{ fontFamily: fG, fontSize: 13, marginTop: 8 }}>合言葉を相手に共有して参加を待ちます</p>
          </div>
        </div>
      </ScreenFrame>

      <ScreenFrame label="④ 対局中 — あなたの手番（7七歩を選択、合法手を緑ハイライト）">
        <AppHeaderMock userSlot={<OnlineChip />} />
        <div style={{ backgroundColor: t.bg.primary, padding: 16, overflowX: "auto" }}>
          <PlayScreenMock gameState="my-turn" />
        </div>
      </ScreenFrame>

      <ScreenFrame label="⑤ 対局中 — CPU思考中（直前の手をアンバー強調、操作無効）">
        <AppHeaderMock userSlot={<OnlineChip />} />
        <div style={{ backgroundColor: t.bg.primary, padding: 16, overflowX: "auto" }}>
          <PlayScreenMock gameState="cpu-thinking" />
        </div>
      </ScreenFrame>

      <ScreenFrame label="⑥ 対局終了 — 勝利（ステータス緑、王将マスをチェックカラー）">
        <AppHeaderMock userSlot={<OnlineChip />} />
        <div style={{ backgroundColor: t.bg.primary, padding: 16, overflowX: "auto" }}>
          <PlayScreenMock gameState="won" />
        </div>
      </ScreenFrame>
    </>
  );
}

// ─── Showcase root ────────────────────────────────────

function Showcase({ theme }: { theme: Theme }) {
  const t = theme;
  return (
    <ThemeCtx.Provider value={theme}>
      <div style={{ backgroundColor: t.bg.primary, minHeight: "100vh", padding: "40px 48px" }}>
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: fS, fontSize: 28, fontWeight: 800, color: t.text.primary, margin: 0 }}>
            デザインシステム
          </h1>
        </div>

        {/* ─── Tokens ─── */}
        <Section title="カラートークン">
          <ColorTokens theme={t} />
        </Section>

        <Section title="スペーシング・シャドウ・アニメーション">
          <RadiusTokens theme={t} />
          <ShadowTokens theme={t} />
          <BorderTokens theme={t} />
          <MotionTokens />
          <ZIndexTokens />
        </Section>

        {/* ─── Shogi-specific ─── */}
        <Section title="将棋固有">
          <BoardStates theme={t} />
          <PieceGallery />
          <InteractiveBoardDemo />
        </Section>

        {/* ─── UI Components ─── */}
        <Section title="UIコンポーネント">
          <FormControls />
          <TypographySection />
        </Section>

        {/* ─── Screen flows ─── */}
        <Section title="画面フロー — ユーザー体験の全体像">
          <ScreenFlows />
        </Section>
      </div>
    </ThemeCtx.Provider>
  );
}

// ─── Entry ────────────────────────────────────────────

export function DesignDemo() {
  const [darkMode, setDarkMode] = useState(false);
  const theme = darkMode ? DARK : LIGHT;
  const t = theme;

  return (
    <ThemeCtx.Provider value={theme}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: ZINDEX.modal,
          backgroundColor: t.bg.elevated,
          borderBottom: `1px solid ${t.border.default}`,
          padding: "10px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: fG, fontSize: 11, fontWeight: 700, color: t.text.tertiary, letterSpacing: "0.08em" }}>
          DESIGN SYSTEM — dev only
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/" style={{ fontFamily: fG, fontSize: 12, color: t.accent.gold, textDecoration: "none" }}>
            ← アプリへ戻る
          </a>
          <Btn variant="ghost" size="sm" onClick={() => { setDarkMode((d) => !d); }}>
            {darkMode ? "☀ ライト" : "☽ ダーク"}
          </Btn>
        </div>
      </div>

      <Showcase theme={theme} />
    </ThemeCtx.Provider>
  );
}
