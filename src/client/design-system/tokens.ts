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

export const R = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 };
export const MOTION = { fast: "0.12s ease", normal: "0.2s ease", slow: "0.35s ease", spring: "0.4s cubic-bezier(0.34,1.56,0.64,1)" };
export const ZINDEX = { base: 0, board: 10, highlight: 15, piece: 20, overlay: 90, modal: 100, toast: 110 };
export const fS = `"Shippori Mincho B1","Noto Serif JP",serif`;
export const fG = `"Zen Kaku Gothic New","Noto Sans JP",sans-serif`;
