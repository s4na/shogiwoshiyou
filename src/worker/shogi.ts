import {
  Color as TsshogiColor,
  handPieceTypes,
  InitialPositionSFEN,
  PieceType as TsshogiPieceType,
  Position,
  Square,
  standardPieceName,
} from "tsshogi";
import type { Move } from "tsshogi";

import type {
  BoardSquare,
  GameMode,
  GameMove,
  GamePlayer,
  GameSnapshot,
  GameStatus,
  GameSummary,
  HandPiece,
  HandPieceType,
  PieceType,
  PlayerColor,
  UserSummary,
} from "../shared/types";

export type StoredGame = {
  id: string;
  mode: GameMode;
  status: GameStatus;
  blackUserId: string;
  whiteUserId: string | null;
  sfen: string;
  moves: string[];
  currentTurn: PlayerColor;
  winnerUserId: string | null;
  endReason: GameSnapshot["endReason"];
  version: number;
  lastEventSeq: number;
  createdAt: string;
  updatedAt: string;
};

export type MoveApplication =
  | {
      ok: true;
      sfen: string;
      currentTurn: PlayerColor;
    }
  | {
      ok: false;
      message: string;
    };

const USI_MOVE_PATTERN = /^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/;
const FILE_LABELS = ["", "１", "２", "３", "４", "５", "６", "７", "８", "９"];
const RANK_LABELS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const CHECK_BONUS = 80;
const MATE_SCORE = 100_000;
const PIECE_VALUES: Record<TsshogiPieceType, number> = {
  [TsshogiPieceType.PAWN]: 100,
  [TsshogiPieceType.LANCE]: 300,
  [TsshogiPieceType.KNIGHT]: 320,
  [TsshogiPieceType.SILVER]: 450,
  [TsshogiPieceType.GOLD]: 520,
  [TsshogiPieceType.BISHOP]: 800,
  [TsshogiPieceType.ROOK]: 1_000,
  [TsshogiPieceType.KING]: 20_000,
  [TsshogiPieceType.PROM_PAWN]: 520,
  [TsshogiPieceType.PROM_LANCE]: 520,
  [TsshogiPieceType.PROM_KNIGHT]: 520,
  [TsshogiPieceType.PROM_SILVER]: 520,
  [TsshogiPieceType.HORSE]: 950,
  [TsshogiPieceType.DRAGON]: 1_150,
};

export function createInitialGame(
  id: string,
  blackUserId: string,
  now: string,
  mode: GameMode,
  whiteUserId: string | null = null,
): StoredGame {
  return {
    id,
    mode,
    status: whiteUserId ? "active" : "waiting",
    blackUserId,
    whiteUserId,
    sfen: InitialPositionSFEN.STANDARD,
    moves: [],
    currentTurn: "black",
    winnerUserId: null,
    endReason: null,
    version: 0,
    lastEventSeq: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function chooseCpuMove(sfen: string): string | null {
  const position = Position.newBySFEN(sfen);
  if (!position) {
    return null;
  }
  const cpuColor = position.color;
  const moves = listLegalMoves(position);
  let bestMove: Move | null = null;
  let bestScore = -Infinity;
  for (const move of moves.sort(compareMoves)) {
    const next = position.clone();
    if (!next.doMove(move)) {
      continue;
    }
    const score =
      next.checked && listLegalMoves(next).length === 0
        ? MATE_SCORE
        : evaluatePosition(next, cpuColor);
    if (score > bestScore || (score === bestScore && move.usi.localeCompare(bestMove?.usi ?? "") < 0)) {
      bestMove = move;
      bestScore = score;
    }
  }
  return bestMove?.usi ?? null;
}

export function isCurrentPlayerCheckmated(sfen: string): boolean {
  const position = Position.newBySFEN(sfen);
  return Boolean(position?.checked && listLegalMoves(position).length === 0);
}

export function endGameByCheckmate(
  game: StoredGame,
  loserUserId: string,
  now: string,
): StoredGame {
  return {
    ...game,
    status: "ended",
    winnerUserId: opponentUserId(game, loserUserId),
    endReason: "checkmate",
    version: game.version + 1,
    lastEventSeq: game.lastEventSeq + 1,
    updatedAt: now,
  };
}

export function applyUsiMove(sfen: string, usi: string): MoveApplication {
  if (!USI_MOVE_PATTERN.test(usi)) {
    return { ok: false, message: "USI形式の指し手ではありません。" };
  }
  const position = Position.newBySFEN(sfen);
  if (!position) {
    return { ok: false, message: "局面を復元できませんでした。" };
  }
  const move = position.createMoveByUSI(usi);
  if (!move) {
    return { ok: false, message: "その指し手は現在の局面では作れません。" };
  }
  if (!position.doMove(move)) {
    return { ok: false, message: "その指し手は合法手ではありません。" };
  }
  return {
    ok: true,
    sfen: position.sfen,
    currentTurn: toPlayerColor(position.color),
  };
}

export function snapshotFromStoredGame(
  game: StoredGame,
  users: Map<string, UserSummary>,
): GameSnapshot {
  const black = users.get(game.blackUserId);
  if (!black) {
    throw new Error(`black player ${game.blackUserId} was not found`);
  }
  const white = game.whiteUserId ? users.get(game.whiteUserId) ?? null : null;
  const winner = game.winnerUserId ? users.get(game.winnerUserId) ?? null : null;
  const position = Position.newBySFEN(game.sfen);
  if (!position) {
    throw new Error(`invalid SFEN persisted for game ${game.id}`);
  }
  return {
    id: game.id,
    mode: game.mode,
    status: game.status,
    sfen: game.sfen,
    currentTurn: game.currentTurn,
    version: game.version,
    lastEventSeq: game.lastEventSeq,
    players: {
      black: toPlayer(black, "black"),
      white: white ? toPlayer(white, "white") : null,
    },
    winner: winner ? toPlayer(winner, winner.id === game.blackUserId ? "black" : "white") : null,
    endReason: game.endReason,
    board: boardSquares(position),
    hands: {
      black: handPieces(position, TsshogiColor.BLACK),
      white: handPieces(position, TsshogiColor.WHITE),
    },
    moves: notationFromUsiHistory(game.moves),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

export function summaryFromSnapshot(snapshot: GameSnapshot): GameSummary {
  return {
    id: snapshot.id,
    mode: snapshot.mode,
    status: snapshot.status,
    currentTurn: snapshot.currentTurn,
    version: snapshot.version,
    lastEventSeq: snapshot.lastEventSeq,
    players: snapshot.players,
    winner: snapshot.winner,
    endReason: snapshot.endReason,
    moves: snapshot.moves,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

export function toPlayerColor(color: TsshogiColor): PlayerColor {
  return color === TsshogiColor.BLACK ? "black" : "white";
}

function toTsshogiColor(color: PlayerColor): TsshogiColor {
  return color === "black" ? TsshogiColor.BLACK : TsshogiColor.WHITE;
}

function boardSquares(position: Position): BoardSquare[] {
  return Square.all.map((square) => {
    const piece = position.board.at(square);
    return {
      square: square.usi,
      file: square.file,
      rank: square.rank,
      piece: piece
        ? {
            color: toPlayerColor(piece.color),
            type: piece.type as PieceType,
            label: standardPieceName(piece.type),
          }
        : null,
    };
  });
}

function handPieces(position: Position, color: TsshogiColor): HandPiece[] {
  const hand = position.hand(color);
  return handPieceTypes
    .map((type) => ({
      type: type as HandPieceType,
      label: standardPieceName(type),
      count: hand.count(type),
    }))
    .filter((piece) => piece.count > 0);
}

function toPlayer(user: UserSummary, color: PlayerColor): GamePlayer {
  return {
    ...user,
    color,
  };
}

function notationFromUsiHistory(moves: string[]): GameMove[] {
  const position = Position.newBySFEN(InitialPositionSFEN.STANDARD);
  if (!position) {
    return moves.map((usi, index) => ({ ply: index + 1, usi, notation: usi }));
  }
  return moves.map((usi, index): GameMove => {
    const move = position.createMoveByUSI(usi);
    if (!move || !position.isValidMove(move)) {
      return { ply: index + 1, usi, notation: usi };
    }
    const notation = moveNotation(move);
    position.doMove(move);
    return { ply: index + 1, usi, notation };
  });
}

function moveNotation(move: Move): string {
  const destination = `${FILE_LABELS[move.to.file] ?? String(move.to.file)}${RANK_LABELS[move.to.rank] ?? String(move.to.rank)}`;
  const piece = standardPieceName(move.pieceType);
  const drop = typeof move.from === "string" ? "打" : "";
  const promote = move.promote ? "成" : "";
  return `${destination}${piece}${drop}${promote}`;
}

export function expectedUserForTurn(game: StoredGame): string {
  return game.currentTurn === "black" ? game.blackUserId : game.whiteUserId ?? "";
}

export function opponentUserId(game: StoredGame, userId: string): string | null {
  if (game.blackUserId === userId) {
    return game.whiteUserId;
  }
  if (game.whiteUserId === userId) {
    return game.blackUserId;
  }
  return null;
}

export function playerColorForUser(game: StoredGame, userId: string): PlayerColor | null {
  if (game.blackUserId === userId) {
    return "black";
  }
  if (game.whiteUserId === userId) {
    return "white";
  }
  return null;
}

export function isHandPieceType(type: TsshogiPieceType): type is TsshogiPieceType & HandPieceType {
  return handPieceTypes.includes(type);
}

export function colorToTsshogi(color: PlayerColor): TsshogiColor {
  return toTsshogiColor(color);
}

function listLegalMoves(position: Position): Move[] {
  const moves: Move[] = [];
  for (const from of Square.all) {
    const piece = position.board.at(from);
    if (piece?.color !== position.color) {
      continue;
    }
    for (const to of Square.all) {
      addLegalMove(position, moves, position.createMove(from, to));
    }
  }
  for (const type of handPieceTypes) {
    if (position.hand(position.color).count(type) === 0) {
      continue;
    }
    for (const to of Square.all) {
      addLegalMove(position, moves, position.createMove(type, to));
    }
  }
  return moves;
}

function evaluatePosition(position: Position, cpuColor: TsshogiColor): number {
  let score = position.checked ? (position.color === cpuColor ? -CHECK_BONUS : CHECK_BONUS) : 0;
  for (const square of Square.all) {
    const piece = position.board.at(square);
    if (!piece) {
      continue;
    }
    const advancement =
      (piece.color === TsshogiColor.BLACK ? 5 - square.rank : square.rank - 5) * 6;
    const center = (5 - Math.abs(5 - square.file) - Math.abs(5 - square.rank)) * 3;
    const value = PIECE_VALUES[piece.type] + advancement + center;
    score += piece.color === cpuColor ? value : -value;
  }
  for (const color of [TsshogiColor.BLACK, TsshogiColor.WHITE]) {
    const sign = color === cpuColor ? 1 : -1;
    const hand = position.hand(color);
    for (const type of handPieceTypes) {
      score += sign * hand.count(type) * PIECE_VALUES[type] * 0.92;
    }
  }
  return score;
}

function compareMoves(a: Move, b: Move): number {
  const captureDelta =
    (b.capturedPieceType ? PIECE_VALUES[b.capturedPieceType] : 0) -
    (a.capturedPieceType ? PIECE_VALUES[a.capturedPieceType] : 0);
  if (captureDelta !== 0) {
    return captureDelta;
  }
  if (a.promote !== b.promote) {
    return a.promote ? -1 : 1;
  }
  return a.usi.localeCompare(b.usi);
}

function addLegalMove(position: Position, moves: Move[], move: Move | null): void {
  if (!move) {
    return;
  }
  if (position.isValidMove(move)) {
    moves.push(move);
  }
  const promoted = move.withPromote();
  if (!promoted.equals(move) && position.isValidMove(promoted)) {
    moves.push(promoted);
  }
}
