import { describe, expect, it } from "vitest";

import type { UserSummary } from "../src/shared/types";
import {
  applyUsiMove,
  chooseCpuMove,
  createInitialGame,
  endGameByCheckmate,
  isCurrentPlayerCheckmated,
  snapshotFromStoredGame,
} from "../src/worker/shogi";

describe("shogi rule boundary", () => {
  it("accepts a legal opening move and flips the turn", () => {
    const game = createInitialGame("game-1", "black-user", "2026-06-07T00:00:00.000Z", "cpu");

    const result = applyUsiMove(game.sfen, "7g7f");

    expect(result).toEqual({
      ok: true,
      currentTurn: "white",
      sfen: "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 1",
    });
  });

  it("rejects a syntactically valid but illegal move", () => {
    const game = createInitialGame("game-1", "black-user", "2026-06-07T00:00:00.000Z", "cpu");

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

  it("detects when the current player has no legal escape from check", () => {
    expect(isCurrentPlayerCheckmated("4k1R2/6R2/9/9/9/9/9/9/4K4 w - 1")).toBe(true);
    expect(isCurrentPlayerCheckmated("4k4/9/9/9/9/9/9/9/4K4 w - 1")).toBe(false);
  });

  it("chooses an immediate checkmate when one is available", () => {
    const sfen = "4k4/8R/9/9/9/9/9/3PPP3/4K4 w rg 1";

    const usi = chooseCpuMove(sfen);

    expect(usi).not.toBeNull();
    expect(usi).toMatch(/^R\*[23789]i$/);
    const applied = applyUsiMove(sfen, usi ?? "");
    expect(applied).toEqual(expect.objectContaining({ ok: true }));
    expect(isCurrentPlayerCheckmated(applied.ok ? applied.sfen : "")).toBe(true);
  });
});

describe("game snapshots", () => {
  it("contains board, hands, players, and move history derived from persisted state", () => {
    const createdAt = "2026-06-07T00:00:00.000Z";
    const users = new Map<string, UserSummary>([
      ["black-user", { id: "black-user", handle: "sente", displayName: "先手" }],
      ["white-user", { id: "white-user", handle: "gote", displayName: "後手" }],
    ]);
    const first = createInitialGame("game-1", "black-user", createdAt, "cpu", "white-user");
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
    expect(snapshot.moves).toEqual([{ ply: 1, usi: "P*5e", notation: "P*5e" }]);
    expect(snapshot.currentTurn).toBe("black");
  });

  it("adds readable Japanese notation to move history while keeping USI", () => {
    const users = new Map<string, UserSummary>([
      ["black-user", { id: "black-user", handle: "sente", displayName: "先手" }],
      ["white-user", { id: "white-user", handle: "gote", displayName: "後手" }],
    ]);
    const createdAt = "2026-06-07T00:00:00.000Z";
    const first = createInitialGame("game-1", "black-user", createdAt, "friend", "white-user");
    const moves = ["7g7f", "3c3d", "8h2b+", "8c8d", "B*5e"];
    const replayed = replayMoves(first.sfen, moves);

    const snapshot = snapshotFromStoredGame(
      {
        ...first,
        sfen: replayed.sfen,
        moves,
        currentTurn: replayed.currentTurn,
        lastEventSeq: 6,
        version: 5,
      },
      users,
    );

    expect(snapshot.moves).toEqual([
      { ply: 1, usi: "7g7f", notation: "７六歩" },
      { ply: 2, usi: "3c3d", notation: "３四歩" },
      { ply: 3, usi: "8h2b+", notation: "２二角成" },
      { ply: 4, usi: "8c8d", notation: "８四歩" },
      { ply: 5, usi: "B*5e", notation: "５五角打" },
    ]);
  });

  it("ends a game by checkmate with the opponent as winner", () => {
    const game = createInitialGame(
      "game-1",
      "black-user",
      "2026-06-07T00:00:00.000Z",
      "cpu",
      "cpu-basic",
    );

    const next = endGameByCheckmate(game, "cpu-basic", "2026-06-07T00:01:00.000Z");

    expect(next).toEqual(
      expect.objectContaining({
        status: "ended",
        winnerUserId: "black-user",
        endReason: "checkmate",
        version: 1,
        lastEventSeq: 2,
        updatedAt: "2026-06-07T00:01:00.000Z",
      }),
    );
  });
});

function replayMoves(
  initialSfen: string,
  moves: string[],
): { sfen: string; currentTurn: "black" | "white" } {
  let state: { sfen: string; currentTurn: "black" | "white" } = {
    sfen: initialSfen,
    currentTurn: "black",
  };
  for (const usi of moves) {
    const result = applyUsiMove(state.sfen, usi);
    if (!result.ok) {
      throw new Error(result.message);
    }
    state = { sfen: result.sfen, currentTurn: result.currentTurn };
  }
  return state;
}
