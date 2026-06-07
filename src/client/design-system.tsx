import { createContext, type JSX } from "preact";
import { useState, useRef, useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";

// ─── Color Tokens ──────────────────────────────────────
export const DARK = {
  board: { kaya: "#D4A843", kayaLight: "#E2C06A", kayaDark: "#B8912E", grid: "#8B6914", star: "#7A5F10" },
  piece: { face: "#F5E6C8", promoted: "#C41E3A", promotedGlow: "rgba(196,30,58,0.4)", border: "#A08050", text: "#3A2A10" },
  bg: { primary: "#0D0D0F", secondary: "#15151A", tertiary: "#1C1C24", elevated: "#22222E", overlay: "rgba(0,0,0,0.6)" },
  text: { primary: "#E8E4DC", secondary: "#9A9488", tertiary: "#6B665E", inverse: "#0D0D0F" },
  accent: { gold: "#C9A84C", goldLight: "#E0C76E", goldDim: "rgba(201,168,76,0.15)", vermillion: "#C41E3A", vermillionDim: "rgba(196,30,58,0.12)", jade: "#2D8B6F", jadeDim: "rgba(45,139,111,0.12)" },
  semantic: { win: "#2D8B6F", lose: "#C41E3A", draw: "#9A9488", check: "#E85D3A", lastMove: "rgba(201,168,76,0.25)", legalMove: "rgba(201,168,76,0.35)", selected: "rgba(201,168,76,0.45)", online: "#4CAF50", offline: "#9A9488", away: "#E0C76E" },
  border: { subtle: "rgba(201,168,76,0.08)", default: "rgba(201,168,76,0.15)", strong: "rgba(201,168,76,0.3)" },
  shadow: { sm: "0 1px 3px rgba(0,0,0,0.4)", md: "0 4px 12px rgba(0,0,0,0.5)", lg: "0 8px 32px rgba(0,0,0,0.6)", glow: "0 0 20px rgba(201,168,76,0.2)", piece: "2px 3px 6px rgba(0,0,0,0.35)" },
};

export const LIGHT = {
  board: { kaya: "#D4A843", kayaLight: "#E8CE7A", kayaDark: "#C49E38", grid: "#9A7A20", star: "#8A6A10" },
  piece: { face: "#F8EDDA", promoted: "#B8162E", promotedGlow: "rgba(184,22,46,0.25)", border: "#B89860", text: "#3A2A10" },
  bg: { primary: "#F5F0E8", secondary: "#FEFCF9", tertiary: "#F0EBE2", elevated: "#FFFFFF", overlay: "rgba(0,0,0,0.4)" },
  text: { primary: "#1A1612", secondary: "#6B6358", tertiary: "#9A9488", inverse: "#FEFCF9" },
  accent: { gold: "#8A6A1E", goldLight: "#A07E28", goldDim: "rgba(138,106,30,0.1)", vermillion: "#B8162E", vermillionDim: "rgba(184,22,46,0.07)", jade: "#1E7A5A", jadeDim: "rgba(30,122,90,0.08)" },
  semantic: { win: "#1E7A5A", lose: "#B8162E", draw: "#9A9488", check: "#D44A2A", lastMove: "rgba(138,106,30,0.18)", legalMove: "rgba(138,106,30,0.28)", selected: "rgba(138,106,30,0.35)", online: "#2E8B57", offline: "#9A9488", away: "#A07E28" },
  border: { subtle: "rgba(26,22,18,0.06)", default: "rgba(26,22,18,0.12)", strong: "rgba(26,22,18,0.2)" },
  shadow: { sm: "0 1px 3px rgba(0,0,0,0.06)", md: "0 4px 12px rgba(0,0,0,0.08)", lg: "0 8px 24px rgba(0,0,0,0.12)", glow: "0 0 16px rgba(138,106,30,0.15)", piece: "1px 2px 4px rgba(0,0,0,0.12)" },
};

export type Theme = typeof LIGHT;
export const ThemeCtx = createContext<Theme>(LIGHT);
export const useTheme = (): Theme => useContext(ThemeCtx);

// ─── Constants ─────────────────────────────────────────
export const R = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 };
export const MOTION = { fast: "0.12s ease", normal: "0.2s ease", slow: "0.35s ease", spring: "0.4s cubic-bezier(0.34,1.56,0.64,1)" };
export const ZINDEX = { base: 0, board: 10, piece: 20, highlight: 15, modal: 100, toast: 110, overlay: 90 };
export const fS = `"Shippori Mincho B1","Noto Serif JP",serif`;
export const fG = `"Zen Kaku Gothic New","Noto Sans JP",sans-serif`;

// ─── Piece Shape ───────────────────────────────────────
const KP = "M50 5 L84 32 L86 112 L14 112 L16 32 Z";
const KI = "M50 10 L81 34 L83 109 L17 109 L19 34 Z";
const KVB = "0 0 100 116";
const KR = 1.12;
const CO = 0.05;

let _gid = 0;
function nextGid() { return `sg${String(++_gid)}`; }

// ─── Components ────────────────────────────────────────

export function ShogiPiece({
  kanji,
  size = 52,
  promoted = false,
  flipped = false,
  selected = false,
  dim = false,
}: {
  kanji: string;
  size?: number;
  promoted?: boolean;
  flipped?: boolean;
  selected?: boolean;
  dim?: boolean;
}) {
  const t = useTheme();
  const id = useRef(nextGid());
  const h = size * KR;
  const oy = CO * h;
  return (
    <div
      style={{
        width: size,
        height: h,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "inherit",
        transform: flipped ? "rotate(180deg)" : "none",
        opacity: dim ? 0.35 : 1,
        transition: `transform ${MOTION.fast},opacity ${MOTION.normal}`,
        flexShrink: 0,
      }}
    >
      <svg
        viewBox={KVB}
        width={size}
        height={h}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          filter: selected
            ? `drop-shadow(0 0 8px ${t.accent.gold})`
            : `drop-shadow(1px 2px 3px rgba(0,0,0,0.25))`,
          transition: `filter ${MOTION.normal}`,
        }}
      >
        <defs>
          <linearGradient id={id.current} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" style={{ stopColor: promoted ? "#FFF3DC" : "#FBF0DA" }} />
            <stop offset="100%" style={{ stopColor: promoted ? "#EBDAB4" : "#E2CDA4" }} />
          </linearGradient>
        </defs>
        <path d={KP} fill={`url(#${id.current})`} stroke={t.piece.border} strokeWidth="1" strokeLinejoin="round" />
        <path
          d={KI}
          fill="none"
          stroke={promoted ? "rgba(184,22,46,0.12)" : "rgba(140,110,60,0.08)"}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          position: "relative",
          zIndex: 1,
          fontFamily: fS,
          fontSize: size * 0.4,
          fontWeight: 800,
          color: promoted ? t.piece.promoted : t.piece.text,
          lineHeight: 1,
          textAlign: "center",
          userSelect: "none",
          marginTop: oy,
        }}
      >
        {kanji}
      </span>
    </div>
  );
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  full,
  icon,
  type = "button",
}: {
  children?: ComponentChildren;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  onClick?: () => void;
  full?: boolean;
  icon?: ComponentChildren;
  type?: "button" | "submit" | "reset";
}) {
  const t = useTheme();
  const [hovered, setHovered] = useState(false);
  const sz = { sm: { p: "6px 12px", f: 12, h: 32 }, md: { p: "10px 20px", f: 13, h: 40 }, lg: { p: "12px 28px", f: 15, h: 48 } };
  const v = {
    primary: { bg: hovered ? t.accent.goldLight : t.accent.gold, c: t.text.inverse, b: "none" },
    secondary: { bg: hovered ? t.bg.elevated : t.bg.tertiary, c: t.text.primary, b: `1px solid ${t.border.default}` },
    ghost: { bg: hovered ? t.accent.goldDim : "transparent", c: t.accent.gold, b: "1px solid transparent" },
    danger: { bg: hovered ? t.accent.vermillion : t.accent.vermillionDim, c: hovered ? "#fff" : t.accent.vermillion, b: `1px solid ${hovered ? t.accent.vermillion : "rgba(196,30,58,0.3)"}` },
  };
  const vv = v[variant];
  const ss = sz[size];
  return (
    <button
      type={type}
      onMouseEnter={() => { setHovered(true); }}
      onMouseLeave={() => { setHovered(false); }}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: ss.p,
        minHeight: ss.h,
        fontSize: ss.f,
        fontFamily: fG,
        fontWeight: 600,
        backgroundColor: vv.bg,
        color: vv.c,
        border: vv.b,
        borderRadius: R.md,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: `all ${MOTION.normal}`,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        width: full ? "100%" : "auto",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: ComponentChildren;
  variant?: "default" | "gold" | "win" | "lose";
}) {
  const t = useTheme();
  const v = {
    default: { bg: t.bg.tertiary, c: t.text.secondary, b: t.border.default },
    gold: { bg: t.accent.goldDim, c: t.accent.gold, b: "rgba(201,168,76,0.25)" },
    win: { bg: t.accent.jadeDim, c: t.accent.jade, b: "rgba(45,139,111,0.25)" },
    lose: { bg: t.accent.vermillionDim, c: t.accent.vermillion, b: "rgba(196,30,58,0.25)" },
  };
  const vv = v[variant];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        fontSize: 11,
        fontFamily: fG,
        fontWeight: 600,
        backgroundColor: vv.bg,
        color: vv.c,
        border: `1px solid ${vv.b}`,
        borderRadius: R.full,
        letterSpacing: "0.03em",
      }}
    >
      {children}
    </span>
  );
}

export function Card({
  title,
  accent,
  children,
  p = 16,
}: {
  title?: string;
  accent?: string;
  children: ComponentChildren;
  p?: number;
}) {
  const t = useTheme();
  return (
    <div
      style={{
        backgroundColor: t.bg.secondary,
        borderRadius: R.lg,
        border: `1px solid ${t.border.subtle}`,
        overflow: "hidden",
      }}
    >
      {accent && <div style={{ height: 2, backgroundColor: accent }} />}
      {title && (
        <div
          style={{
            padding: "10px 16px",
            borderBottom: `1px solid ${t.border.subtle}`,
            fontFamily: fG,
            fontSize: 12,
            fontWeight: 600,
            color: t.text.secondary,
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </div>
      )}
      <div style={{ padding: p }}>{children}</div>
    </div>
  );
}

export function Toast({
  message,
  type = "info",
}: {
  message: string;
  type?: "info" | "success" | "error";
}) {
  const t = useTheme();
  const colors = { info: t.accent.gold, success: t.semantic.win, error: t.semantic.lose };
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        maxWidth: "min(420px, calc(100vw - 36px))",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderRadius: R.md,
        backgroundColor: t.bg.elevated,
        border: `1px solid ${t.border.default}`,
        boxShadow: t.shadow.md,
        fontFamily: fG,
        fontSize: 13,
        fontWeight: 600,
        color: t.text.primary,
        zIndex: ZINDEX.toast,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: R.full,
          backgroundColor: colors[type],
          flexShrink: 0,
        }}
      />
      {message}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ComponentChildren;
}) {
  const t = useTheme();
  if (!open) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: ZINDEX.modal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.bg.overlay,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => { e.stopPropagation(); }}
        style={{
          backgroundColor: t.bg.elevated,
          borderRadius: R.xl,
          border: `1px solid ${t.border.default}`,
          boxShadow: t.shadow.lg,
          width: "100%",
          maxWidth: 360,
          overflow: "hidden",
        }}
      >
        {title && (
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid ${t.border.subtle}`,
              fontFamily: fS,
              fontSize: 16,
              fontWeight: 700,
              color: t.text.primary,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

export function StatusChip({
  children,
  color,
}: {
  children: ComponentChildren;
  color?: string;
}) {
  const t = useTheme();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: R.full,
        backgroundColor: t.bg.tertiary,
        border: `1px solid ${t.border.default}`,
        fontFamily: fG,
        fontSize: 12,
        fontWeight: 600,
        color: color ?? t.text.secondary,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Input(props: JSX.IntrinsicElements['input']) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{
        padding: "10px 14px",
        borderRadius: R.md,
        border: `1px solid ${focused ? t.accent.gold : t.border.default}`,
        backgroundColor: t.bg.secondary,
        color: t.text.primary,
        fontFamily: fG,
        fontSize: 13,
        width: "100%",
        outline: "none",
        transition: `border-color ${MOTION.fast}`,
        boxSizing: "border-box",
        ...(props.style as object | undefined),
      }}
    />
  );
}

export function FieldGroup({
  id,
  label,
  help,
  helpId,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  helpId?: string;
  children: ComponentChildren;
}) {
  const t = useTheme();
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label htmlFor={id} style={{ fontFamily: fG, fontSize: 12, fontWeight: 600, color: t.text.secondary }}>
        {label}
      </label>
      {children}
      {help && (
        <p id={helpId} style={{ fontFamily: fG, fontSize: 11, color: t.text.tertiary, lineHeight: 1.4, margin: 0 }}>
          {help}
        </p>
      )}
    </div>
  );
}
