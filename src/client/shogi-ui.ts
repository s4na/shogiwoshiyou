import { Position, Square, type Move, PieceType as TsshogiPieceType } from "tsshogi";

import type {
  BoardPiece,
  BoardSquare,
  GameMove,
  GameSnapshot,
  HandPieceType,
  PlayerColor,
} from "../shared/types";

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

export function moveNotationLabel(move: GameMove): string {
  return move.notation;
}

export function moveUsiTitle(move: GameMove): string {
  return move.usi;
}

export function legalMoveDestinations(game: GameSnapshot, from: string): string[] {
  const position = Position.newBySFEN(game.sfen);
  const fromSquare = Square.newByUSI(from);
  if (!position || !fromSquare) {
    return [];
  }
  return legalDestinationsFrom(position, fromSquare);
}

export function legalDropDestinations(game: GameSnapshot, type: HandPieceType): string[] {
  const position = Position.newBySFEN(game.sfen);
  if (!position) {
    return [];
  }
  return legalDestinationsFrom(position, type as TsshogiPieceType);
}

export function squareHasPlayerPiece(game: GameSnapshot, color: PlayerColor, square: string): boolean {
  return game.board.find((candidate) => candidate.square === square)?.piece?.color === color;
}

export function handHasPiece(game: GameSnapshot, color: PlayerColor, type: HandPieceType): boolean {
  return game.hands[color].some((piece) => piece.type === type && piece.count > 0);
}

export function retainedPieceSelection(
  game: GameSnapshot,
  color: PlayerColor,
  selection: { selectedSquare: string | null; selectedHand: HandPieceType | null },
): { selectedSquare: string | null; selectedHand: HandPieceType | null } {
  return {
    selectedSquare:
      selection.selectedSquare && squareHasPlayerPiece(game, color, selection.selectedSquare)
        ? selection.selectedSquare
        : null,
    selectedHand:
      selection.selectedHand && handHasPiece(game, color, selection.selectedHand)
        ? selection.selectedHand
        : null,
  };
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

function legalDestinationsFrom(position: Position, from: Square | TsshogiPieceType): string[] {
  const destinations = new Set<string>();
  for (const to of Square.all) {
    addLegalDestination(position, destinations, position.createMove(from, to));
  }
  return [...destinations];
}

function addLegalDestination(position: Position, destinations: Set<string>, move: Move | null): void {
  if (!move) {
    return;
  }
  if (position.isValidMove(move)) {
    destinations.add(move.to.usi);
  }
  const promoted = move.withPromote();
  if (!promoted.equals(move) && position.isValidMove(promoted)) {
    destinations.add(promoted.to.usi);
  }
}
