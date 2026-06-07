import { describe, expect, it } from "vitest";

import type { GameSnapshot } from "../src/shared/types";
import { dropUsi, myColor, promotionMoveOptions } from "../src/client/shogi-ui";

describe("client shogi helpers", () => {
  it("builds USI drops from hand pieces", () => {
    expect(dropUsi("pawn", "5e")).toBe("P*5e");
    expect(dropUsi("rook", "2b")).toBe("R*2b");
  });

  it("detects a player color from a game snapshot", () => {
    expect(myColor(sampleGame(), "black-user")).toBe("black");
    expect(myColor(sampleGame(), "white-user")).toBe("white");
    expect(myColor(sampleGame(), "watcher")).toBeNull();
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
