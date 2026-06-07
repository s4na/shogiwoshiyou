import { useState } from "preact/hooks";
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
          <Swatch color={t.accent.vermillion} label="accent.vermillion" />
          <Swatch color={t.accent.jade} label="accent.jade" />
        </Row>
      </SubSection>
      <SubSection title="セマンティック">
        <Row>
          <Swatch color={t.semantic.win} label="semantic.win" />
          <Swatch color={t.semantic.lose} label="semantic.lose" />
          <Swatch color={t.semantic.draw} label="semantic.draw" />
          <Swatch color={t.semantic.check} label="semantic.check" />
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
        </Section>

        {/* ─── UI Components ─── */}
        <Section title="UIコンポーネント">
          <FormControls />
          <TypographySection />
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
