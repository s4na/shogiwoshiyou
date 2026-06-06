import {
  Color as TsshogiColor,
  handPieceTypes,
  InitialPositionSFEN,
  PieceType as TsshogiPieceType,
  Position,
  Square,
  standardPieceName,
} from "tsshogi";

import type {
  BoardSquare,
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

export function createInitialGame(id: string, blackUserId: string, now: string): StoredGame {
  return {
    id,
    status: "waiting",
    blackUserId,
    whiteUserId: null,
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
    moves: game.moves.map((usi, index): GameMove => ({ ply: index + 1, usi })),
    createdAt: game.createdAt,
    updatedAt: game.updatedAt,
  };
}

export function summaryFromSnapshot(snapshot: GameSnapshot): GameSummary {
  return {
    id: snapshot.id,
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
