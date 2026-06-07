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
  fG,
  fS,
  R,
  useTheme,
} from "./design-system";
import type { Theme } from "./design-system";

// ─── Helpers ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  const t = useTheme();
  return (
    <section style={{ marginBottom: 48 }}>
      <h2
        style={{
          fontFamily: fS,
          fontSize: 18,
          fontWeight: 700,
          color: t.text.primary,
          marginBottom: 4,
          borderBottom: `2px solid ${t.border.default}`,
          paddingBottom: 8,
        }}
      >
        {title}
      </h2>
      <div style={{ paddingTop: 20 }}>{children}</div>
    </section>
  );
}

function Row({ children, gap = 12 }: { children: preact.ComponentChildren; gap?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap, alignItems: "flex-start" }}>
      {children}
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 64,
          height: 40,
          borderRadius: R.md,
          backgroundColor: color,
          border: `1px solid ${t.border.default}`,
        }}
      />
      <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary, textAlign: "center" }}>
        {label}
      </span>
      <span style={{ fontFamily: "monospace", fontSize: 9, color: t.text.tertiary }}>
        {color}
      </span>
    </div>
  );
}

// ─── Main Showcase ────────────────────────────────────

function Showcase({ theme, name }: { theme: Theme; name: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const t = theme;

  return (
    <ThemeCtx.Provider value={theme}>
      <div
        style={{
          backgroundColor: t.bg.primary,
          minHeight: "100vh",
          padding: "40px 48px",
          flex: 1,
        }}
      >
        {/* ─── Header ─── */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontFamily: fS, fontSize: 28, fontWeight: 800, color: t.text.primary, margin: 0 }}>
            デザインシステム
          </h1>
          <p style={{ fontFamily: fG, fontSize: 13, color: t.text.secondary, margin: "6px 0 0" }}>
            {name} — 将棋をしよう
          </p>
        </div>

        {/* ─── Colors ─── */}
        <Section title="カラートークン">
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>背景</p>
              <Row>
                {(["primary", "secondary", "tertiary", "elevated"] as const).map((k) => (
                  <Swatch key={k} color={t.bg[k]} label={`bg.${k}`} />
                ))}
              </Row>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>テキスト</p>
              <Row>
                {(["primary", "secondary", "tertiary"] as const).map((k) => (
                  <Swatch key={k} color={t.text[k]} label={`text.${k}`} />
                ))}
              </Row>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>アクセント</p>
              <Row>
                <Swatch color={t.accent.gold} label="accent.gold" />
                <Swatch color={t.accent.goldLight} label="accent.goldLight" />
                <Swatch color={t.accent.vermillion} label="accent.vermillion" />
                <Swatch color={t.accent.jade} label="accent.jade" />
              </Row>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>将棋盤</p>
              <Row>
                <Swatch color={t.board.kaya} label="board.kaya" />
                <Swatch color={t.board.kayaLight} label="board.kayaLight" />
                <Swatch color={t.board.kayaDark} label="board.kayaDark" />
                <Swatch color={t.board.grid} label="board.grid" />
              </Row>
            </div>
          </div>
        </Section>

        {/* ─── ShogiPiece ─── */}
        <Section title="将棋駒 (ShogiPiece)">
          <div style={{ display: "grid", gap: 24 }}>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 16, letterSpacing: "0.05em" }}>通常駒 / 各種状態</p>
              <Row gap={24}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ShogiPiece kanji="歩" size={52} />
                  <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>通常</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ShogiPiece kanji="と" size={52} promoted />
                  <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>成り</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ShogiPiece kanji="歩" size={52} flipped />
                  <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>反転（相手）</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ShogiPiece kanji="歩" size={52} selected />
                  <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>選択中</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ShogiPiece kanji="歩" size={52} dim />
                  <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>非アクティブ</span>
                </div>
              </Row>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 16, letterSpacing: "0.05em" }}>各駒 (size=52)</p>
              <div
                style={{
                  display: "inline-grid",
                  gridTemplateColumns: "repeat(9, 64px)",
                  gap: 8,
                  padding: 16,
                  backgroundColor: t.board.kaya,
                  borderRadius: R.lg,
                }}
              >
                {[
                  { kanji: "香", label: "香" },
                  { kanji: "桂", label: "桂" },
                  { kanji: "銀", label: "銀" },
                  { kanji: "金", label: "金" },
                  { kanji: "玉", label: "玉" },
                  { kanji: "角", label: "角" },
                  { kanji: "飛", label: "飛" },
                  { kanji: "歩", label: "歩" },
                  { kanji: "王", label: "王" },
                ].map(({ kanji }) => (
                  <div key={kanji} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <ShogiPiece kanji={kanji} size={52} />
                  </div>
                ))}
                {[
                  { kanji: "と" },
                  { kanji: "杏" },
                  { kanji: "圭" },
                  { kanji: "全" },
                  { kanji: "馬" },
                  { kanji: "龍" },
                ].map(({ kanji }) => (
                  <div key={kanji} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <ShogiPiece kanji={kanji} size={52} promoted />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 16, letterSpacing: "0.05em" }}>サイズバリエーション</p>
              <Row gap={24}>
                {[28, 36, 44, 52, 64].map((sz) => (
                  <div key={sz} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <ShogiPiece kanji="王" size={sz} />
                    <span style={{ fontFamily: fG, fontSize: 10, color: t.text.tertiary }}>size={sz}</span>
                  </div>
                ))}
              </Row>
            </div>
          </div>
        </Section>

        {/* ─── Btn ─── */}
        <Section title="ボタン (Btn)">
          <div style={{ display: "grid", gap: 20 }}>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>バリアント</p>
              <Row>
                <Btn variant="primary">Primary</Btn>
                <Btn variant="secondary">Secondary</Btn>
                <Btn variant="ghost">Ghost</Btn>
                <Btn variant="danger">Danger</Btn>
                <Btn variant="primary" disabled>Disabled</Btn>
              </Row>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>サイズ</p>
              <Row>
                <Btn variant="primary" size="sm">Small</Btn>
                <Btn variant="primary" size="md">Medium</Btn>
                <Btn variant="primary" size="lg">Large</Btn>
              </Row>
            </div>
            <div>
              <p style={{ fontFamily: fG, fontSize: 11, fontWeight: 600, color: t.text.tertiary, marginBottom: 12, letterSpacing: "0.05em" }}>アクション</p>
              <Row>
                <Btn variant="primary" onClick={() => { setShowToast(true); setTimeout(() => { setShowToast(false); }, 2500); }}>
                  Toast を表示
                </Btn>
                <Btn variant="secondary" onClick={() => { setModalOpen(true); }}>
                  Modal を開く
                </Btn>
              </Row>
            </div>
          </div>
        </Section>

        {/* ─── Badge ─── */}
        <Section title="バッジ (Badge)">
          <Row>
            <Badge variant="default">Default</Badge>
            <Badge variant="gold">Gold</Badge>
            <Badge variant="win">勝利</Badge>
            <Badge variant="lose">敗北</Badge>
          </Row>
        </Section>

        {/* ─── StatusChip ─── */}
        <Section title="ステータスチップ (StatusChip)">
          <Row>
            <StatusChip color={t.semantic.online}>● オンライン</StatusChip>
            <StatusChip color={t.semantic.offline}>● オフライン</StatusChip>
            <StatusChip color={t.semantic.away}>● 離席中</StatusChip>
            <StatusChip>デフォルト</StatusChip>
          </Row>
        </Section>

        {/* ─── Card ─── */}
        <Section title="カード (Card)">
          <Row gap={16}>
            <div style={{ width: 240 }}>
              <Card title="タイトルなし">
                <p style={{ fontFamily: fG, fontSize: 13, color: t.text.primary, margin: 0 }}>
                  カードコンテンツ
                </p>
              </Card>
            </div>
            <div style={{ width: 240 }}>
              <Card title="タイトルあり" accent={t.accent.gold}>
                <p style={{ fontFamily: fG, fontSize: 13, color: t.text.primary, margin: 0 }}>
                  ゴールドアクセント付き
                </p>
              </Card>
            </div>
            <div style={{ width: 240 }}>
              <Card title="勝利" accent={t.semantic.win}>
                <p style={{ fontFamily: fG, fontSize: 13, color: t.text.primary, margin: 0 }}>
                  翡翠アクセント付き
                </p>
              </Card>
            </div>
          </Row>
        </Section>

        {/* ─── Typography ─── */}
        <Section title="タイポグラフィ">
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ fontFamily: fS, fontSize: 28, fontWeight: 800, color: t.text.primary, margin: 0 }}>
              将棋をしよう（明朝体 28px Bold）
            </p>
            <p style={{ fontFamily: fS, fontSize: 20, fontWeight: 700, color: t.text.primary, margin: 0 }}>
              将棋をしよう（明朝体 20px）
            </p>
            <p style={{ fontFamily: fG, fontSize: 16, fontWeight: 600, color: t.text.primary, margin: 0 }}>
              将棋をしよう（ゴシック体 16px SemiBold）
            </p>
            <p style={{ fontFamily: fG, fontSize: 13, color: t.text.primary, margin: 0 }}>
              将棋をしよう（ゴシック体 13px Regular）
            </p>
            <p style={{ fontFamily: fG, fontSize: 11, color: t.text.secondary, margin: 0 }}>
              将棋をしよう（ゴシック体 11px Secondary）
            </p>
          </div>
        </Section>

        {/* ─── Modal ─── */}
        <Modal open={modalOpen} onClose={() => { setModalOpen(false); }} title="モーダルサンプル">
          <p style={{ fontFamily: fG, fontSize: 13, color: t.text.primary, margin: "0 0 16px" }}>
            モーダルのコンテンツです。背景クリックで閉じます。
          </p>
          <Row>
            <Btn variant="primary" onClick={() => { setModalOpen(false); }}>閉じる</Btn>
            <Btn variant="ghost" onClick={() => { setModalOpen(false); }}>キャンセル</Btn>
          </Row>
        </Modal>

        {/* ─── Toast ─── */}
        {showToast && <Toast message="トーストメッセージのサンプルです" type="success" />}
      </div>
    </ThemeCtx.Provider>
  );
}

// ─── Root ─────────────────────────────────────────────

export function DesignDemo() {
  const [darkMode, setDarkMode] = useState(false);
  const theme = darkMode ? DARK : LIGHT;
  const t = theme;

  return (
    <ThemeCtx.Provider value={theme}>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          backgroundColor: t.bg.elevated,
          borderBottom: `1px solid ${t.border.default}`,
          padding: "12px 48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: fG, fontSize: 12, fontWeight: 600, color: t.text.secondary, letterSpacing: "0.05em" }}>
          DESIGN SYSTEM — dev only
        </span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a
            href="/"
            style={{ fontFamily: fG, fontSize: 12, color: t.accent.gold, textDecoration: "none" }}
          >
            ← アプリへ戻る
          </a>
          <Btn variant="ghost" size="sm" onClick={() => { setDarkMode((d) => !d); }}>
            {darkMode ? "☀ ライト" : "☽ ダーク"}
          </Btn>
        </div>
      </div>

      <Showcase theme={theme} name={darkMode ? "Dark Mode" : "Light Mode"} />
    </ThemeCtx.Provider>
  );
}
