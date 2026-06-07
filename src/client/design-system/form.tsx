import { useState } from "preact/hooks";
import type { ComponentChildren, JSX } from "preact";

import { R, MOTION, fG } from "./tokens";
import { useTheme } from "./theme";

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
