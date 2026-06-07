import { useRef } from "preact/hooks";

import { MOTION, fS } from "./tokens";
import { useTheme } from "./theme";

const KP = "M50 5 L84 32 L86 112 L14 112 L16 32 Z";
const KI = "M50 10 L81 34 L83 109 L17 109 L19 34 Z";
const KVB = "0 0 100 116";
const KR = 1.12;
const CO = 0.05;

let _gid = 0;
function nextGid() { return `sg${String(++_gid)}`; }

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
