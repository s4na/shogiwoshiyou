import { useRef } from "preact/hooks";

import { MOTION, fS } from "./tokens";
import { useTheme } from "./theme";

const KP = "M50 2 L87 30 L93 103 L7 103 L13 30 Z";
const KI = "M50 8 L83.5 32.5 L89.5 100 L10.5 100 L16.5 32.5 Z";
const KVB = "0 0 100 105";
const KR = 1.05;
const CO = 0.05;

// SVG linearGradient id はドキュメント内でユニークである必要があるためカウンターで生成
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
        transition: `opacity ${MOTION.normal}`,
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
            <stop offset="0%" style={{ stopColor: promoted ? "#f2d08a" : "#ecc77f" }} />
            <stop offset="100%" style={{ stopColor: promoted ? "#d4a45c" : "#cf9c52" }} />
          </linearGradient>
        </defs>
        <path d={KP} fill={`url(#${id.current})`} stroke={t.piece.border} strokeWidth="2" strokeLinejoin="round" />
        <path
          d={KI}
          fill="none"
          stroke={t.piece.border}
          strokeWidth="1"
          strokeLinejoin="round"
          opacity={0.55}
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
