import { describe, expect, it } from "vitest";
import { InitialPositionSFEN } from "tsshogi";

import type { GameSnapshot } from "../src/shared/types";
import {
  dropUsi,
  legalDropDestinations,
  legalMoveDestinations,
  moveNotationLabel,
  moveUsiTitle,
  myColor,
  promotionMoveOptions,
  handHasPiece,
  retainedPieceSelection,
  squareHasPlayerPiece,
} from "../src/client/shogi-ui";

describe("client shogi helpers", () => {
  it("builds USI drops from hand pieces", () => {
    expect(dropUsi("pawn", "5e")).toBe("P*5e");
    expect(dropUsi("rook", "2b")).toBe("R*2b");
  });

  it("uses readable notation as the visible move label and keeps USI as supplemental text", () => {
    const move = { ply: 1, usi: "7g7f", notation: "７六歩" };

    expect(moveNotationLabel(move)).toBe("７六歩");
    expect(moveUsiTitle(move)).toBe("7g7f");
  });

  it("detects a player color from a game snapshot", () => {
    expect(myColor(sampleGame(), "black-user")).toBe("black");
    expect(myColor(sampleGame(), "white-user")).toBe("white");
    expect(myColor(sampleGame(), "watcher")).toBeNull();
  });

  it("detects a player's board piece regardless of whose turn it is", () => {
    const game = {
      ...sampleGame({
        square: "7g",
        file: 7,
        rank: 7,
        piece: { color: "black", type: "pawn", label: "歩" },
      }),
      currentTurn: "white" as const,
    };

    expect(squareHasPlayerPiece(game, "black", "7g")).toBe(true);
    expect(squareHasPlayerPiece(game, "white", "7g")).toBe(false);
  });

  it("detects whether a player still has a selected hand piece", () => {
    const game = {
      ...sampleGame(),
      currentTurn: "white" as const,
      hands: {
        black: [{ type: "pawn" as const, label: "歩", count: 1 }],
        white: [],
      },
    };

    expect(handHasPiece(game, "black", "pawn")).toBe(true);
    expect(handHasPiece(game, "black", "rook")).toBe(false);
  });

  it("retains a player's selected board piece during the opponent's turn", () => {
    const game = {
      ...sampleGame({
        square: "7g",
        file: 7,
        rank: 7,
        piece: { color: "black", type: "pawn", label: "歩" },
      }),
      currentTurn: "white" as const,
      hands: {
        black: [{ type: "pawn" as const, label: "歩", count: 1 }],
        white: [],
      },
    };

    expect(retainedPieceSelection(game, "black", { selectedSquare: "7g", selectedHand: null })).toEqual({
      selectedSquare: "7g",
      selectedHand: null,
    });
  });

  it("retains a player's selected hand piece during the opponent's turn", () => {
    const game = {
      ...sampleGame(),
      currentTurn: "white" as const,
      hands: {
        black: [{ type: "pawn" as const, label: "歩", count: 1 }],
        white: [],
      },
    };

    expect(retainedPieceSelection(game, "black", { selectedSquare: null, selectedHand: "pawn" })).toEqual({
      selectedSquare: null,
      selectedHand: "pawn",
    });
  });

  it("clears a selected board piece that no longer belongs to the player", () => {
    const game = {
      ...sampleGame({
        square: "7g",
        file: 7,
        rank: 7,
        piece: { color: "white", type: "pawn", label: "歩" },
      }),
      currentTurn: "white" as const,
    };

    expect(retainedPieceSelection(game, "black", { selectedSquare: "7g", selectedHand: null })).toEqual({
      selectedSquare: null,
      selectedHand: null,
    });
  });

  it("clears a selected hand piece that is no longer in the player's hand", () => {
    const game = {
      ...sampleGame(),
      currentTurn: "white" as const,
      hands: {
        black: [],
        white: [],
      },
    };

    expect(retainedPieceSelection(game, "black", { selectedSquare: null, selectedHand: "pawn" })).toEqual({
      selectedSquare: null,
      selectedHand: null,
    });
  });

  it("requires promotion when a black pawn reaches the last rank", () => {
    const game = sampleGame({
      square: "5b",
      file: 5,
      rank: 2,
      piece: { color: "black", type: "pawn", label: "歩" },
    });

    expect(promotionMoveOptions(game, "5b", "5a")).toEqual({
      baseUsi: "5b5a",
      promotedUsi: "5b5a+",
      mustPromote: true,
      canPromote: true,
    });
  });

  it("offers promotion when a black pawn enters the promotion zone", () => {
    const game = sampleGame({
      square: "5d",
      file: 5,
      rank: 4,
      piece: { color: "black", type: "pawn", label: "歩" },
    });

    expect(promotionMoveOptions(game, "5d", "5c")).toEqual({
      baseUsi: "5d5c",
      promotedUsi: "5d5c+",
      mustPromote: false,
      canPromote: true,
    });
  });

  it("does not offer promotion outside the promotion zone", () => {
    const game = sampleGame({
      square: "5g",
      file: 5,
      rank: 7,
      piece: { color: "black", type: "pawn", label: "歩" },
    });

    expect(promotionMoveOptions(game, "5g", "5f")).toEqual({
      baseUsi: "5g5f",
      promotedUsi: "5g5f+",
      mustPromote: false,
      canPromote: false,
    });
  });

  it("lists legal destinations for a selected board piece", () => {
    const game = { ...sampleGame(), sfen: InitialPositionSFEN.STANDARD };

    expect(legalMoveDestinations(game, "7g")).toEqual(["7f"]);
  });

  it("lists legal drop destinations for a selected hand piece", () => {
    const game = {
      ...sampleGame(),
      sfen: "4k4/9/9/9/9/9/9/9/4K4 b P 1",
    };
    const destinations = legalDropDestinations(game, "pawn");

    expect(destinations).toContain("5e");
    expect(destinations).not.toContain("5a");
  });
});

function sampleGame(overrideSquare?: GameSnapshot["board"][number]): GameSnapshot {
  const board = Array.from({ length: 81 }, (_, index): GameSnapshot["board"][number] => {
    const rank = Math.floor(index / 9) + 1;
    const file = 9 - (index % 9);
    const rankLetter = "abcdefghi"[rank - 1];
    if (!rankLetter) {
      throw new Error(`invalid rank ${String(rank)}`);
    }
    const square = `${String(file)}${rankLetter}`;
    return { square, file, rank, piece: null };
  });
  if (overrideSquare) {
    const index = board.findIndex((square) => square.square === overrideSquare.square);
    if (index < 0) {
      throw new Error(`square ${overrideSquare.square} was not found`);
    }
    board[index] = overrideSquare;
  }
  return {
    id: "game-1",
    mode: "cpu",
    status: "active",
    sfen: "",
    currentTurn: "black",
    version: 1,
    lastEventSeq: 1,
    players: {
      black: { id: "black-user", handle: "sente", displayName: "先手", color: "black" },
      white: { id: "white-user", handle: "gote", displayName: "後手", color: "white" },
    },
    winner: null,
    endReason: null,
    board,
    hands: { black: [], white: [] },
    moves: [],
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
  };
}
