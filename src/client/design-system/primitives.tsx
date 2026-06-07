import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

import { R, MOTION, ZINDEX, fS, fG } from "./tokens";
import { useTheme } from "./theme";

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
