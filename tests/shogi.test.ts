import { describe, expect, it } from "vitest";

import type { UserSummary } from "../src/shared/types";
import {
  applyUsiMove,
  chooseCpuMove,
  createInitialGame,
  snapshotFromStoredGame,
} from "../src/worker/shogi";

describe("shogi rule boundary", () => {
  it("accepts a legal opening move and flips the turn", () => {
    const game = createInitialGame("game-1", "black-user", "2026-06-07T00:00:00.000Z");

    const result = applyUsiMove(game.sfen, "7g7f");

    expect(result).toEqual({
      ok: true,
      currentTurn: "white",
      sfen: "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 1",
    });
  });

  it("rejects a syntactically valid but illegal move", () => {
    const game = createInitialGame("game-1", "black-user", "2026-06-07T00:00:00.000Z");

    const result = applyUsiMove(game.sfen, "7g7e");

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
      }),
    );
  });

  it("accepts a legal drop", () => {
    expect(applyUsiMove("4k4/9/9/9/9/9/9/9/4K4 b P 1", "P*5e")).toEqual({
      ok: true,
      currentTurn: "white",
      sfen: "4k4/9/9/9/4P4/9/9/9/4K4 w - 1",
    });
  });

  it("accepts a legal promotion", () => {
    expect(applyUsiMove("k8/4P4/9/9/9/9/9/9/4K4 b - 1", "5b5a+")).toEqual({
      ok: true,
      currentTurn: "white",
      sfen: "k3+P4/9/9/9/9/9/9/9/4K4 w - 1",
    });
  });

  it("chooses a CPU move that can be applied to the current position", () => {
    const sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 1";

    const usi = chooseCpuMove(sfen);

    expect(usi).toEqual(
      expect.stringMatching(/^(?:[1-9][a-i][1-9][a-i]\+?|[PLNSGBR]\*[1-9][a-i])$/),
    );
    expect(applyUsiMove(sfen, usi ?? "")).toEqual(expect.objectContaining({ ok: true }));
  });

  it("chooses a material gain when the CPU can safely capture a piece", () => {
    const sfen = "4k4/9/4r4/4G4/9/9/9/9/4K4 w - 1";

    const usi = chooseCpuMove(sfen);

    expect(usi).toBe("5c5d");
    expect(applyUsiMove(sfen, usi ?? "")).toEqual(
      expect.objectContaining({
        ok: true,
        currentTurn: "black",
        sfen: "4k4/9/9/4r4/9/9/9/9/4K4 b g 1",
      }),
    );
  });
});

describe("game snapshots", () => {
  it("contains board, hands, players, and move history derived from persisted state", () => {
    const createdAt = "2026-06-07T00:00:00.000Z";
    const users = new Map<string, UserSummary>([
      ["black-user", { id: "black-user", handle: "sente", displayName: "先手" }],
      ["white-user", { id: "white-user", handle: "gote", displayName: "後手" }],
    ]);
    const first = createInitialGame("game-1", "black-user", createdAt);
    const game = {
      ...first,
      whiteUserId: "white-user",
      status: "active" as const,
      sfen: "4k4/9/9/9/9/9/9/9/4K4 b Pp 1",
      moves: ["P*5e"],
      currentTurn: "black" as const,
      lastEventSeq: 3,
      version: 2,
    };

    const snapshot = snapshotFromStoredGame(game, users);
    const whiteKing = snapshot.board.find((square) => square.square === "5a");
    const blackKing = snapshot.board.find((square) => square.square === "5i");

    expect(snapshot.board).toHaveLength(81);
    expect(snapshot.mode).toBe("cpu");
    expect(whiteKing?.piece).toEqual({ color: "white", type: "king", label: "玉" });
    expect(blackKing?.piece).toEqual({ color: "black", type: "king", label: "玉" });
    expect(snapshot.hands.black).toContainEqual({ type: "pawn", count: 1, label: "歩" });
    expect(snapshot.hands.white).toContainEqual({ type: "pawn", count: 1, label: "歩" });
    expect(snapshot.players.black.displayName).toBe("先手");
    expect(snapshot.players.white?.displayName).toBe("後手");
    expect(snapshot.moves).toEqual([{ ply: 1, usi: "P*5e" }]);
    expect(snapshot.currentTurn).toBe("black");
  });
});
