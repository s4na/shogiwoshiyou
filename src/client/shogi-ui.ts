import type { BoardPiece, BoardSquare, GameSnapshot, HandPieceType, PlayerColor } from "../shared/types";

const DROP_CODES: Record<HandPieceType, string> = {
  pawn: "P",
  lance: "L",
  knight: "N",
  silver: "S",
  gold: "G",
  bishop: "B",
  rook: "R",
};

const PROMOTABLE = new Set(["pawn", "lance", "knight", "silver", "bishop", "rook"]);
const RANKS = "abcdefghi";

export function dropUsi(type: HandPieceType, to: string): string {
  return `${DROP_CODES[type]}*${to}`;
}

export function myColor(game: GameSnapshot, userId: string): PlayerColor | null {
  if (game.players.black.id === userId) {
    return "black";
  }
  if (game.players.white?.id === userId) {
    return "white";
  }
  return null;
}

export function orderedBoardSquares(game: GameSnapshot, orientation: PlayerColor): BoardSquare[] {
  return orientation === "black" ? game.board : [...game.board].reverse();
}

export function shouldInvertPiece(piece: BoardPiece, orientation: PlayerColor): boolean {
  return piece.color !== orientation;
}

export function promotionMoveOptions(
  game: GameSnapshot,
  from: string,
  to: string,
): { baseUsi: string; promotedUsi: string; mustPromote: boolean; canPromote: boolean } {
  const fromSquare = game.board.find((square) => square.square === from);
  const piece = fromSquare?.piece;
  if (!piece || !PROMOTABLE.has(piece.type)) {
    return { baseUsi: `${from}${to}`, promotedUsi: `${from}${to}+`, mustPromote: false, canPromote: false };
  }
  const fromRank = rankNumber(from);
  const toRank = rankNumber(to);
  const inZone =
    piece.color === "black"
      ? fromRank <= 3 || toRank <= 3
      : fromRank >= 7 || toRank >= 7;
  const mustPromote =
    piece.color === "black"
      ? (piece.type === "pawn" || piece.type === "lance") && toRank === 1
        ? true
        : piece.type === "knight" && toRank <= 2
      : (piece.type === "pawn" || piece.type === "lance") && toRank === 9
        ? true
        : piece.type === "knight" && toRank >= 8;
  return {
    baseUsi: `${from}${to}`,
    promotedUsi: `${from}${to}+`,
    mustPromote,
    canPromote: inZone,
  };
}

function rankNumber(square: string): number {
  return RANKS.indexOf(square[1] ?? "") + 1;
}
