import { describe, expect, it } from "vitest";

import app, { GameRoom } from "../src/worker";
import { currentTermsHash, TERMS_TEXT } from "../src/shared/terms";
import type { Env } from "../src/worker/env";
import type { StoredGame } from "../src/worker/shogi";

const CURRENT_TERMS_HASH = "3ffc4da40c4608f5731f7f6815d33c276fa05397d49ac65db3dc6317cb502862";
const TERMS_PLACEHOLDERS = [
  "［運営者名］",
  "［アプリ名］",
  "［メールアドレスまたは問い合わせフォームURL］",
  "［月］",
  "［日］",
] as const;

describe("terms text", () => {
  it("does not leave unresolved placeholders in the published terms", () => {
    for (const placeholder of TERMS_PLACEHOLDERS) {
      expect(TERMS_TEXT).not.toContain(placeholder);
    }
  });
});

describe("auth API", () => {
  it("rejects registration when the terms are not accepted", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";
    const userCountBefore = db.userCount();

    const response = await app.request(
      `${origin}/api/auth/register`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
        },
        body: JSON.stringify({ handle: "terms_missing", password: "password123" }),
      },
      env,
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("validation_error");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.userCount()).toBe(userCountBefore);
    expect(db.termsAgreements).toHaveLength(0);
  });

  it("records the accepted terms hash and agreement time when registering", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";

    const response = await app.request(
      `${origin}/api/auth/register`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
        },
        body: JSON.stringify({
          handle: "terms_ok",
          password: "password123",
          termsAccepted: true,
          termsHash: CURRENT_TERMS_HASH,
        }),
      },
      env,
    );
    const body: { user?: { id?: string } } = await response.json();

    expect(response.status).toBe(201);
    expect(db.termsAgreements).toHaveLength(1);
    const agreement = db.termsAgreements[0];
    expect(String(agreement?.id)).toMatch(/^[0-9a-f-]{36}$/i);
    expect(agreement?.user_id).toBe(body.user?.id);
    expect(agreement?.terms_hash).toBe(CURRENT_TERMS_HASH);
    expect(String(agreement?.agreed_at)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("requires an existing user to accept the current terms before using protected APIs", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";
    const session = await registerViaApi(env, origin, "terms_refresh_required");
    db.replaceTermsHashForUser(session.userId, "0".repeat(64));

    const sessionResponse = await app.request(
      `${origin}/api/session`,
      { headers: { cookie: session.cookie } },
      env,
    );
    const sessionBody: {
      termsAgreementRequired?: boolean;
      termsHash?: string;
      user?: { id?: string };
    } = await sessionResponse.json();

    const gamesResponse = await app.request(
      `${origin}/api/games`,
      { headers: { cookie: session.cookie, origin } },
      env,
    );
    const gamesBody: { error?: { code?: string } } = await gamesResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionBody.user?.id).toBe(session.userId);
    expect(sessionBody.termsAgreementRequired).toBe(true);
    expect(sessionBody.termsHash).toBe(CURRENT_TERMS_HASH);
    expect(gamesResponse.status).toBe(403);
    expect(gamesBody.error?.code).toBe("terms_agreement_required");
  });

  it("records a refreshed terms agreement and allows protected APIs again", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";
    const session = await registerViaApi(env, origin, "terms_refresh_ok");
    db.replaceTermsHashForUser(session.userId, "0".repeat(64));
    const agreementCountBefore = db.termsAgreements.length;

    const acceptResponse = await app.request(
      `${origin}/api/terms/agreements`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: session.cookie,
          origin,
        },
        body: JSON.stringify({
          termsAccepted: true,
          termsHash: CURRENT_TERMS_HASH,
        }),
      },
      env,
    );
    const acceptBody: { termsAgreementRequired?: boolean; user?: { id?: string } } =
      await acceptResponse.json();
    const gamesResponse = await app.request(
      `${origin}/api/games`,
      { headers: { cookie: session.cookie, origin } },
      env,
    );

    expect(acceptResponse.status).toBe(200);
    expect(acceptBody.user?.id).toBe(session.userId);
    expect(acceptBody.termsAgreementRequired).toBe(false);
    expect(db.termsAgreements).toHaveLength(agreementCountBefore + 1);
    expect(db.termsAgreements.at(-1)?.user_id).toBe(session.userId);
    expect(db.termsAgreements.at(-1)?.terms_hash).toBe(CURRENT_TERMS_HASH);
    expect(gamesResponse.status).toBe(200);
  });

  it("rejects a refreshed terms agreement when the submitted hash is stale", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";
    const staleTermsHash = "0".repeat(64);
    const session = await registerViaApi(env, origin, "terms_refresh_stale");
    db.replaceTermsHashForUser(session.userId, staleTermsHash);
    const agreementCountBefore = db.termsAgreements.length;

    const acceptResponse = await app.request(
      `${origin}/api/terms/agreements`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: session.cookie,
          origin,
        },
        body: JSON.stringify({
          termsAccepted: true,
          termsHash: staleTermsHash,
        }),
      },
      env,
    );
    const acceptBody: { error?: { code?: string } } = await acceptResponse.json();
    const gamesResponse = await app.request(
      `${origin}/api/games`,
      { headers: { cookie: session.cookie, origin } },
      env,
    );
    const gamesBody: { error?: { code?: string } } = await gamesResponse.json();

    expect(acceptResponse.status).toBe(400);
    expect(acceptBody.error?.code).toBe("terms_hash_mismatch");
    expect(db.termsAgreements).toHaveLength(agreementCountBefore);
    expect(gamesResponse.status).toBe(403);
    expect(gamesBody.error?.code).toBe("terms_agreement_required");
  });

  it("rejects registration when the submitted terms hash does not match the current terms", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";
    const userCountBefore = db.userCount();

    const response = await app.request(
      `${origin}/api/auth/register`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
        },
        body: JSON.stringify({
          handle: "terms_old",
          password: "password123",
          termsAccepted: true,
          termsHash: "0".repeat(64),
        }),
      },
      env,
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("terms_hash_mismatch");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(db.userCount()).toBe(userCountBefore);
    expect(db.termsAgreements).toHaveLength(0);
  });

  it("creates a guest session without storing password credentials", async () => {
    const db = new FakeD1(null);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: new FakeGameRoomNamespace(db) as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";

    const response = await app.request(
      `${origin}/api/auth/guest`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
        },
        body: JSON.stringify({
          termsAccepted: true,
          termsHash: CURRENT_TERMS_HASH,
        }),
      },
      env,
    );
    const body: { user?: { handle?: string; isGuest?: boolean } } = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toEqual(expect.stringContaining("sid="));
    expect(body.user?.handle).toEqual(expect.stringMatching(/^guest_[0-9a-f]{12}$/));
    expect(body.user?.isGuest).toBe(true);
    expect(db.credentialCount()).toBe(0);
    expect(db.termsAgreements).toHaveLength(1);
  });
});

describe("GameRoom moves", () => {
  it("creates, joins, moves, and reads events through the public friend game API", async () => {
    const db = new FakeD1(null);
    const namespace = new FakeGameRoomNamespace(db);
    const env = {
      DB: db as unknown as D1Database,
      GAME_ROOM: namespace as unknown as DurableObjectNamespace,
      SESSION_COOKIE_NAME: "sid",
    } satisfies Env;
    const origin = "http://localhost";

    const black = await registerViaApi(env, origin, "friend_black");
    const white = await registerViaApi(env, origin, "friend_white");
    const passcode = " shared-friend-passcode ";

    const first = await app.request(
      `${origin}/api/games`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: black.cookie,
          origin,
        },
        body: JSON.stringify({ mode: "friend", passcode }),
      },
      env,
    );
    const firstBody: { game?: { id?: string; status?: string; players?: { white?: unknown } } } =
      await first.json();

    const retry = await app.request(
      `${origin}/api/games`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: black.cookie,
          origin,
        },
        body: JSON.stringify({ mode: "friend", passcode: passcode.trim() }),
      },
      env,
    );
    const retryBody: { game?: { id?: string; status?: string; players?: { white?: unknown } } } =
      await retry.json();

    const second = await app.request(
      `${origin}/api/games`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: white.cookie,
          origin,
        },
        body: JSON.stringify({ mode: "friend", passcode: passcode.trim() }),
      },
      env,
    );
    const secondBody: { game?: { id?: string; status?: string } } = await second.json();
    const gameId = String(secondBody.game?.id);

    expect(first.status).toBe(201);
    expect(firstBody.game?.status).toBe("waiting");
    expect(firstBody.game?.players?.white).toBeNull();
    expect(retry.status).toBe(200);
    expect(retryBody.game?.id).toBe(firstBody.game?.id);
    expect(retryBody.game?.status).toBe("waiting");
    expect(retryBody.game?.players?.white).toBeNull();
    expect(second.status).toBe(200);
    expect(secondBody.game?.id).toBe(firstBody.game?.id);
    expect(secondBody.game?.status).toBe("active");

    await expect(
      app.request(
        `${origin}/api/games/${gameId}/moves`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: black.cookie,
            origin,
          },
          body: JSON.stringify({
            usi: "7g7f",
            requestId: "00000000-0000-4000-8000-000000000201",
          }),
        },
        env,
      ),
    ).resolves.toHaveProperty("status", 200);
    const whiteMove = await app.request(
      `${origin}/api/games/${gameId}/moves`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: white.cookie,
          origin,
        },
        body: JSON.stringify({
          usi: "3c3d",
          requestId: "00000000-0000-4000-8000-000000000202",
        }),
      },
      env,
    );
    const whiteMoveBody: { game?: { moves?: { ply?: number; usi?: string; notation?: string }[] } } =
      await whiteMove.json();

    expect(whiteMove.status).toBe(200);
    expect(whiteMoveBody.game?.moves).toEqual([
      { ply: 1, usi: "7g7f", notation: "７六歩" },
      { ply: 2, usi: "3c3d", notation: "３四歩" },
    ]);
    expect(db.updatedGame?.moves_json).toBe(JSON.stringify(["7g7f", "3c3d"]));

    const reloaded = await app.request(
      `${origin}/api/games/${gameId}`,
      {
        headers: { cookie: black.cookie },
      },
      env,
    );
    const reloadedBody: { game?: { moves?: { ply?: number; usi?: string; notation?: string }[] } } =
      await reloaded.json();

    expect(reloaded.status).toBe(200);
    expect(reloadedBody.game?.moves).toEqual([
      { ply: 1, usi: "7g7f", notation: "７六歩" },
      { ply: 2, usi: "3c3d", notation: "３四歩" },
    ]);

    const events = await app.request(
      `${origin}/api/games/${gameId}/events?after=0`,
      {
        headers: { cookie: black.cookie },
      },
      env,
    );
    const eventsBody: { events?: PublicTestEvent[] } = await events.json();
    const whiteEvents = await app.request(
      `${origin}/api/games/${gameId}/events?after=0`,
      {
        headers: { cookie: white.cookie },
      },
      env,
    );
    const whiteEventsBody: { events?: PublicTestEvent[] } = await whiteEvents.json();
    const expectedEvents = [
      { seq: 1, type: "game.created", actorUserId: black.userId },
      { seq: 2, type: "game.joined", actorUserId: white.userId },
      {
        seq: 3,
        type: "move.played",
        actorUserId: black.userId,
        color: "black",
        ply: 1,
        usi: "7g7f",
      },
      {
        seq: 4,
        type: "move.played",
        actorUserId: white.userId,
        color: "white",
        ply: 2,
        usi: "3c3d",
      },
    ];

    expect(events.status).toBe(200);
    expect(eventsBody.events?.map(publicEventSummary)).toEqual(expectedEvents);
    expect(whiteEvents.status).toBe(200);
    expect(whiteEventsBody.events?.map(publicEventSummary)).toEqual(expectedEvents);
  });

  it("does not return a duplicate move snapshot to a non-player", async () => {
    const requestId = "00000000-0000-4000-8000-000000000002";
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      sfen: "4k4/9/9/9/9/9/9/9/4K4 b - 1",
      currentTurn: "black",
    });
    const db = new FakeD1(game, [{ requestId, actorUserId: "black-user" }]);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/move", {
        method: "POST",
        headers: { "x-user-id": "watcher" },
        body: JSON.stringify({ usi: "5i5h", requestId }),
      }),
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("not_player");
  });

  it("returns a duplicate move snapshot to the original player after the turn changed", async () => {
    const requestId = "00000000-0000-4000-8000-000000000004";
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      sfen: "4k4/9/9/9/9/9/9/9/4K4 w - 1",
      currentTurn: "white",
      moves: ["5i5h"],
      lastEventSeq: 2,
      version: 1,
    });
    const db = new FakeD1(game, [{ requestId, actorUserId: "black-user" }]);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/move", {
        method: "POST",
        headers: { "x-user-id": "black-user" },
        body: JSON.stringify({ usi: "5i5h", requestId }),
      }),
    );
    const body: { game?: { currentTurn?: string } } = await response.json();

    expect(response.status).toBe(200);
    expect(body.game?.currentTurn).toBe("white");
  });

  it("does not treat another player's reused move request id as a duplicate", async () => {
    const requestId = "00000000-0000-4000-8000-000000000005";
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      sfen: "4k4/9/9/9/9/9/9/4r4/4K4 w - 1",
      currentTurn: "white",
      moves: ["5i5h"],
      lastEventSeq: 2,
      version: 1,
    });
    const db = new FakeD1(game, [{ requestId, actorUserId: "black-user" }]);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/move", {
        method: "POST",
        headers: { "x-user-id": "white-user" },
        body: JSON.stringify({ usi: "5h5g", requestId }),
      }),
    );
    const body: { game?: { currentTurn?: string } } = await response.json();

    expect(response.status).toBe(200);
    expect(body.game?.currentTurn).toBe("black");
    expect(db.insertedEvents).toContainEqual(
      expect.objectContaining({
        type: "move.played",
        actor_user_id: "white-user",
        client_request_id: requestId,
      }),
    );
  });

  it("does not return a duplicate resign snapshot to a non-player", async () => {
    const requestId = "00000000-0000-4000-8000-000000000003";
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
    });
    const db = new FakeD1(game, [{ requestId, actorUserId: "black-user" }]);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/resign", {
        method: "POST",
        headers: { "x-user-id": "watcher" },
        body: JSON.stringify({ requestId }),
      }),
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("not_player");
  });

  it("ends the game when a player move checkmates the opponent", async () => {
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      sfen: "4k4/3ppp3/9/9/9/9/9/8r/4K4 b RG 1",
      currentTurn: "black",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/move", {
        method: "POST",
        headers: { "x-user-id": "black-user" },
        body: JSON.stringify({ usi: "R*3a", requestId: "00000000-0000-4000-8000-000000000001" }),
      }),
    );
    const body: { game?: { status?: string; endReason?: string } } = await response.json();

    expect(response.status).toBe(200);
    expect(body.game).toEqual(
      expect.objectContaining({
        status: "ended",
        endReason: "checkmate",
      }),
    );
    expect(db.updatedGame).toEqual(
      expect.objectContaining({
        status: "ended",
        winner_user_id: "black-user",
        end_reason: "checkmate",
        version: 2,
        current_turn: "white",
      }),
    );
    expect(db.batchStatementTypes).toContainEqual([
      "UPDATE games",
      "move.played",
      "game.checkmated",
    ]);
    expect(db.insertedEvents).toHaveLength(2);
    expect(db.insertedEvents[0]).toEqual(
      expect.objectContaining({
        seq: 2,
        type: "move.played",
        actor_user_id: "black-user",
        client_request_id: "00000000-0000-4000-8000-000000000001",
      }),
    );
    expect(db.insertedEvents[1]).toEqual(
      expect.objectContaining({
        seq: 3,
        type: "game.checkmated",
        actor_user_id: null,
        payload_json: JSON.stringify({
          loserUserId: "white-user",
          winnerUserId: "black-user",
        }),
      }),
    );
  });

  it("ends the game when the CPU move checkmates the player", async () => {
    const game = storedGame({
      sfen: "4k4/8R/9/9/9/9/9/3PPP3/4K4 w rg 1",
      currentTurn: "white",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    await room.alarm();

    expect(db.updatedGame).toEqual(
      expect.objectContaining({
        status: "ended",
        winner_user_id: "cpu-basic",
        end_reason: "checkmate",
        version: 2,
        current_turn: "black",
      }),
    );
    expect(db.batchStatementTypes).toContainEqual([
      "UPDATE games",
      "move.played",
      "game.checkmated",
    ]);
    expect(db.insertedEvents).toHaveLength(2);
    expect(db.insertedEvents[0]).toEqual(
      expect.objectContaining({
        seq: 2,
        type: "move.played",
        actor_user_id: "cpu-basic",
      }),
    );
    expect(JSON.parse(String(db.insertedEvents[0]?.payload_json))).toEqual(
      expect.objectContaining({
        color: "white",
        ply: 1,
      }),
    );
    expect(db.insertedEvents[1]).toEqual(
      expect.objectContaining({
        seq: 3,
        type: "game.checkmated",
        actor_user_id: null,
        payload_json: JSON.stringify({
          loserUserId: "black-user",
          winnerUserId: "cpu-basic",
        }),
      }),
    );
  });

  it("ends the game when the CPU has no legal escape from check", async () => {
    const game = storedGame({
      sfen: "4k1R2/6R2/9/9/9/9/9/9/4K4 w - 1",
      currentTurn: "white",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    await room.alarm();

    expect(db.updatedGame).toEqual(
      expect.objectContaining({
        status: "ended",
        winner_user_id: "black-user",
        end_reason: "checkmate",
        version: 1,
        current_turn: "white",
      }),
    );
    expect(db.insertedEvents).toHaveLength(1);
    expect(db.insertedEvents[0]).toEqual(
      expect.objectContaining({
        seq: 2,
        type: "game.checkmated",
        actor_user_id: null,
        payload_json: JSON.stringify({
          loserUserId: "cpu-basic",
          winnerUserId: "black-user",
        }),
      }),
    );
  });

  it("downloads a KIF export without changing the stored move history", async () => {
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      moves: ["7g7f", "3c3d"],
      sfen: "lnsgkgsnl/1r5b1/1pppppppp/p8/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL b - 1",
      currentTurn: "black",
      status: "ended",
      winnerUserId: "black-user",
      endReason: "resign",
      version: 3,
      lastEventSeq: 4,
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    const response = await room.fetch(
      new Request("https://game-room/export/kif", {
        method: "GET",
        headers: { "x-user-id": "black-user" },
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-kif");
    expect(text).toContain("先手：先手");
    expect(text).toContain("後手：後手");
    expect(text).toContain("７六歩 (7g7f)");
    expect(text).toContain("投了");
    expect(db.updatedGame).toBeNull();
    expect(db.rowForGame(game.id)?.moves_json).toBe(JSON.stringify(["7g7f", "3c3d"]));
  });

  it("keeps post-game analysis separate from persisted game moves", async () => {
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      status: "ended",
      winnerUserId: "black-user",
      endReason: "resign",
      moves: ["7g7f"],
      sfen: "lnsgkgsnl/1r5b1/ppppppppp/9/9/2P6/PP1PPPPPP/1B5R1/LNSGKGSNL w - 1",
      currentTurn: "white",
      version: 2,
      lastEventSeq: 3,
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    const initial = await room.fetch(
      new Request("https://game-room/analysis", {
        method: "GET",
        headers: { "x-user-id": "black-user" },
      }),
    );
    const initialBody: { analysis?: { board?: { square: string; piece: unknown }[]; hands?: unknown } } =
      await initial.json();
    const board = (initialBody.analysis?.board ?? []).map((square) => ({
      ...square,
      piece: square.piece && typeof square.piece === "object" ? { ...square.piece } : null,
    }));
    const from = board.find((square) => square.square === "7f");
    const to = board.find((square) => square.square === "7e");
    expect(from?.piece).toBeTruthy();
    if (from && to) {
      to.piece = from.piece;
      from.piece = null;
    }

    const updated = await room.fetch(
      new Request("https://game-room/analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "white-user",
        },
        body: JSON.stringify({
          requestId: "00000000-0000-4000-8000-000000000301",
          board,
          hands: initialBody.analysis?.hands,
        }),
      }),
    );
    const updatedBody: {
      analysis?: {
        board?: { square: string; piece: { label?: string } | null }[];
        revision?: number;
        updatedBy?: { id?: string };
      };
    } = await updated.json();

    expect(initial.status).toBe(200);
    expect(to).toBeTruthy();
    expect(updated.status).toBe(200);
    expect(updatedBody.analysis?.revision).toBe(1);
    expect(updatedBody.analysis?.updatedBy?.id).toBe("white-user");
    expect(updatedBody.analysis?.board?.find((square) => square.square === "7f")?.piece).toBeNull();
    expect(updatedBody.analysis?.board?.find((square) => square.square === "7e")?.piece?.label).toBe("歩");
    expect(db.updatedGame).toBeNull();
    expect(db.insertedEvents).toHaveLength(0);
    expect(db.rowForGame(game.id)?.moves_json).toBe(JSON.stringify(["7g7f"]));
  });

  it("rejects analysis updates before the game ends", async () => {
    const game = storedGame({
      mode: "friend",
      whiteUserId: "white-user",
      status: "active",
    });
    const db = new FakeD1(game);
    const room = createRoom(game, db);

    const initial = await room.fetch(
      new Request("https://game-room/analysis", {
        method: "GET",
        headers: { "x-user-id": "black-user" },
      }),
    );
    const initialBody: { error?: { code?: string } } = await initial.json();
    const snapshot: { game?: { board?: unknown; hands?: unknown } } = await room.fetch(
      new Request("https://game-room/snapshot", {
        method: "GET",
        headers: { "x-user-id": "black-user" },
      }),
    ).then((response) => response.json());
    const response = await room.fetch(
      new Request("https://game-room/analysis", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "black-user",
        },
        body: JSON.stringify({
          requestId: "00000000-0000-4000-8000-000000000302",
          board: snapshot.game?.board,
          hands: snapshot.game?.hands,
        }),
      }),
    );
    const body: { error?: { code?: string } } = await response.json();

    expect(initial.status).toBe(409);
    expect(initialBody.error?.code).toBe("game_not_ended");
    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("game_not_ended");
  });
});

function createRoom(game: StoredGame, db: FakeD1): GameRoom {
  const state = {
    id: { name: game.id },
    storage: new FakeStorage(),
    acceptWebSocket: () => undefined,
    getWebSockets: () => [],
  } as unknown as DurableObjectState;
  return new GameRoom(state, {
    DB: db as unknown as D1Database,
    GAME_ROOM: {} as DurableObjectNamespace,
    SESSION_COOKIE_NAME: "sid",
  } satisfies Env);
}

async function registerViaApi(
  env: Env,
  origin: string,
  handle: string,
): Promise<{ cookie: string; userId: string }> {
  const termsHash = await currentTermsHash();
  const response = await app.request(
    `${origin}/api/auth/register`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
      },
      body: JSON.stringify({
        handle,
        password: "password123",
        termsAccepted: true,
        termsHash,
      }),
    },
    env,
  );
  const body: { user?: { id?: string } } = await response.json();
  const setCookie = response.headers.get("set-cookie");
  expect(response.status).toBe(201);
  expect(setCookie).toEqual(expect.stringContaining("sid="));
  const cookie = String(setCookie).split(";")[0] ?? "";
  return { cookie, userId: String(body.user?.id) };
}

type PublicTestEvent = {
  seq: number;
  type: string;
  actorUserId: string | null;
  payload?: {
    usi?: string;
    color?: string;
    ply?: number;
  };
};

function publicEventSummary(event: PublicTestEvent): Record<string, unknown> {
  return {
    seq: event.seq,
    type: event.type,
    actorUserId: event.actorUserId,
    ...(event.payload?.color ? { color: event.payload.color } : {}),
    ...(event.payload?.ply ? { ply: event.payload.ply } : {}),
    ...(event.payload?.usi ? { usi: event.payload.usi } : {}),
  };
}

class FakeGameRoomNamespace {
  private readonly rooms = new Map<string, GameRoom>();

  constructor(private readonly db: FakeD1) {}

  idFromName(name: string): DurableObjectId {
    return { name } as DurableObjectId;
  }

  get(id: DurableObjectId): DurableObjectStub {
    const name = String((id as { name?: string }).name);
    return {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        this.room(name).fetch(new Request(input, init)),
    } as DurableObjectStub;
  }

  room(name: string): GameRoom {
    let room = this.rooms.get(name);
    if (!room) {
      const state = {
        id: { name },
        storage: new FakeStorage(),
        acceptWebSocket: () => undefined,
        getWebSockets: () => [],
      } as unknown as DurableObjectState;
      room = new GameRoom(state, {
        DB: this.db as unknown as D1Database,
        GAME_ROOM: this as unknown as DurableObjectNamespace,
        SESSION_COOKIE_NAME: "sid",
      } satisfies Env);
      this.rooms.set(name, room);
    }
    return room;
  }
}

class FakeStorage {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.values.get(key) as T | undefined);
  }

  put(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }

  setAlarm(): Promise<void> {
    return Promise.resolve();
  }
}

function storedGame(overrides: Partial<StoredGame> = {}): StoredGame {
  return {
    id: "game-1",
    mode: "cpu",
    status: "active",
    blackUserId: "black-user",
    whiteUserId: "cpu-basic",
    sfen: "4k4/9/9/9/9/9/9/9/4K4 w - 1",
    moves: [],
    currentTurn: "white",
    winnerUserId: null,
    endReason: null,
    version: 0,
    lastEventSeq: 1,
    createdAt: "2026-06-07T00:00:00.000Z",
    updatedAt: "2026-06-07T00:00:00.000Z",
    ...overrides,
  };
}

class FakeD1 {
  updatedGame: Record<string, unknown> | null = null;
  insertedEvents: Record<string, unknown>[] = [];
  termsAgreements: Record<string, unknown>[] = [];
  batchStatementTypes: string[][] = [];
  private currentGame: StoredGame | null;
  private readonly games = new Map<string, StoredGame>();
  private readonly users = new Map<string, { id: string; handle: string; display_name: string }>();
  private readonly sessions = new Map<string, { user_id: string; expires_at: string }>();
  private credentials = 0;
  private readonly duplicateRequests: Set<string>;

  constructor(
    game: StoredGame | null = storedGame(),
    duplicateRequests: { requestId: string; actorUserId: string }[] = [],
  ) {
    this.currentGame = game;
    if (game) {
      this.games.set(game.id, game);
    }
    this.seedUser("black-user", "sente", "先手");
    this.seedUser("white-user", "gote", "後手");
    this.seedUser("cpu-basic", "cpu", "CPU");
    this.duplicateRequests = new Set(
      duplicateRequests.map((request) => `${request.requestId}:${request.actorUserId}`),
    );
  }

  prepare(sql: string): FakeStatement {
    return new FakeStatement(sql, this);
  }

  async batch(statements: FakeStatement[]): Promise<unknown[]> {
    this.batchStatementTypes.push(statements.map((statement) => statement.kind()));
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  rowForGame(id = this.currentGame?.id): Record<string, unknown> | null {
    if (!id) {
      return null;
    }
    const game = this.games.get(id);
    if (!game) {
      return null;
    }
    const lastEventSeq = Math.max(
      game.lastEventSeq,
      ...this.eventsForGame(id).map((event) => Number(event.seq)),
    );
    return {
      id: game.id,
      mode: game.mode,
      black_user_id: game.blackUserId,
      white_user_id: game.whiteUserId,
      status: game.status,
      sfen: game.sfen,
      moves_json: JSON.stringify(game.moves),
      current_turn: game.currentTurn,
      winner_user_id: game.winnerUserId,
      end_reason: game.endReason,
      version: game.version,
      created_at: game.createdAt,
      updated_at: game.updatedAt,
      last_event_seq: lastEventSeq,
    };
  }

  hasDuplicateRequestId(requestId: unknown, actorUserId: unknown): boolean {
    return (
      typeof requestId === "string" &&
      typeof actorUserId === "string" &&
      this.duplicateRequests.has(`${requestId}:${actorUserId}`)
    );
  }

  applyUpdatedGame(row: Record<string, unknown>): void {
    const id = String(row.id);
    const current = this.games.get(id);
    if (!current) {
      throw new Error(`game ${id} was not found`);
    }
    const next: StoredGame = {
      ...current,
      whiteUserId: row.white_user_id as string | null,
      status: row.status as StoredGame["status"],
      sfen: String(row.sfen),
      moves: JSON.parse(String(row.moves_json)) as string[],
      currentTurn: row.current_turn as StoredGame["currentTurn"],
      winnerUserId: row.winner_user_id as string | null,
      endReason: row.end_reason as StoredGame["endReason"],
      version: Number(row.version),
      lastEventSeq: Number(row.version) + 1,
      updatedAt: String(row.updated_at),
    };
    this.currentGame = next;
    this.games.set(id, next);
  }

  insertGame(row: Record<string, unknown>): void {
    const game: StoredGame = {
      id: String(row.id),
      mode: row.mode as StoredGame["mode"],
      status: row.status as StoredGame["status"],
      blackUserId: String(row.black_user_id),
      whiteUserId: row.white_user_id as string | null,
      sfen: String(row.sfen),
      moves: JSON.parse(String(row.moves_json)) as string[],
      currentTurn: row.current_turn as StoredGame["currentTurn"],
      winnerUserId: row.winner_user_id as string | null,
      endReason: row.end_reason as StoredGame["endReason"],
      version: Number(row.version),
      lastEventSeq: 0,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    this.currentGame = game;
    this.games.set(game.id, game);
  }

  eventsForGame(gameId: string): Record<string, unknown>[] {
    return this.insertedEvents.filter((event) => event.game_id === gameId);
  }

  insertUser(row: { id: unknown; handle: unknown; display_name: unknown }): void {
    this.seedUser(String(row.id), String(row.handle), String(row.display_name));
  }

  insertSession(row: { token_hash: unknown; user_id: unknown; expires_at: unknown }): void {
    this.sessions.set(String(row.token_hash), {
      user_id: String(row.user_id),
      expires_at: String(row.expires_at),
    });
  }

  insertTermsAgreement(row: Record<string, unknown>): void {
    this.termsAgreements.push(row);
  }

  hasTermsAgreement(userId: unknown, termsHash: unknown): boolean {
    return this.termsAgreements.some(
      (agreement) =>
        agreement.user_id === String(userId) &&
        agreement.terms_hash === String(termsHash),
    );
  }

  replaceTermsHashForUser(userId: string, termsHash: string): void {
    for (const agreement of this.termsAgreements) {
      if (agreement.user_id === userId) {
        agreement.terms_hash = termsHash;
      }
    }
  }

  userCount(): number {
    return this.users.size;
  }

  credentialCount(): number {
    return this.credentials;
  }

  insertCredential(): void {
    this.credentials += 1;
  }

  userForSession(tokenHash: unknown, now: unknown): Record<string, unknown> | null {
    const session = this.sessions.get(String(tokenHash));
    if (!session || session.expires_at <= String(now)) {
      return null;
    }
    return this.users.get(session.user_id) ?? null;
  }

  usersByIds(ids: unknown[]): Record<string, unknown>[] {
    return ids
      .map((id) => this.users.get(String(id)))
      .filter((user): user is { id: string; handle: string; display_name: string } => Boolean(user));
  }

  canViewGame(gameId: unknown, userId: unknown): boolean {
    const game = this.games.get(String(gameId));
    return Boolean(
      game && (game.blackUserId === String(userId) || game.whiteUserId === String(userId)),
    );
  }

  private seedUser(id: string, handle: string, displayName: string): void {
    this.users.set(id, { id, handle, display_name: displayName });
  }
}

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeD1,
  ) {}

  kind(): string {
    if (this.sql.includes("UPDATE games")) {
      return "UPDATE games";
    }
    if (this.sql.includes("INSERT INTO game_events")) {
      return String(this.values[3]);
    }
    if (this.sql.includes("INSERT INTO user_terms_agreements")) {
      return "INSERT INTO user_terms_agreements";
    }
    return "other";
  }

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM user_terms_agreements")) {
      return Promise.resolve(
        this.db.hasTermsAgreement(this.values[0], this.values[1])
          ? ({ accepted: 1 } as T)
          : null,
      );
    }
    if (this.sql.includes("FROM sessions")) {
      return Promise.resolve(this.db.userForSession(this.values[0], this.values[1]) as T | null);
    }
    if (this.sql.includes("FROM game_events")) {
      if (!this.sql.includes("actor_user_id = ?3")) {
        return Promise.resolve(null);
      }
      return Promise.resolve(
        this.db.hasDuplicateRequestId(this.values[1], this.values[2])
          ? ({ id: "event-1" } as T)
          : null,
      );
    }
    if (this.sql.includes("SELECT 1 AS allowed")) {
      return Promise.resolve(
        this.db.canViewGame(this.values[0], this.values[1]) ? ({ allowed: 1 } as T) : null,
      );
    }
    if (this.sql.includes("FROM games")) {
      return Promise.resolve(this.db.rowForGame(String(this.values[0])) as T | null);
    }
    return Promise.resolve(null);
  }

  all(): Promise<{ results: Record<string, unknown>[] }> {
    if (this.sql.includes("FROM game_events")) {
      const gameId = String(this.values[0]);
      const afterSeq = Number(this.values[1]);
      return Promise.resolve({
        results: this.db
          .eventsForGame(gameId)
          .filter((event) => Number(event.seq) > afterSeq)
          .sort((left, right) => Number(left.seq) - Number(right.seq)),
      });
    }
    if (this.sql.includes("FROM users")) {
      return Promise.resolve({
        results: this.db.usersByIds(this.values),
      });
    }
    return Promise.resolve({ results: [] });
  }

  run(): Promise<unknown> {
    if (this.sql.includes("INSERT INTO users")) {
      this.db.insertUser({
        id: this.values[0],
        handle: this.values[1],
        display_name: this.values[2],
      });
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("INSERT INTO sessions")) {
      this.db.insertSession({
        token_hash: this.values[0],
        user_id: this.values[1],
        expires_at: this.values[2],
      });
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("UPDATE sessions")) {
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("INSERT INTO user_credentials")) {
      this.db.insertCredential();
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("INSERT INTO user_terms_agreements")) {
      this.db.insertTermsAgreement({
        id: this.values[0],
        user_id: this.values[1],
        terms_hash: this.values[2],
        agreed_at: this.values[3],
      });
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("INSERT INTO games")) {
      this.db.insertGame({
        id: this.values[0],
        black_user_id: this.values[1],
        white_user_id: this.values[2],
        status: this.values[3],
        sfen: this.values[4],
        moves_json: this.values[5],
        current_turn: this.values[6],
        winner_user_id: this.values[7],
        end_reason: this.values[8],
        version: this.values[9],
        created_at: this.values[10],
        updated_at: this.values[11],
        mode: this.values[12],
      });
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("UPDATE games")) {
      const current = this.db.rowForGame(String(this.values[0]));
      if (!current || Number(this.values[10]) !== Number(current.version)) {
        return Promise.resolve({ meta: { changes: 0 }, success: true });
      }
      this.db.updatedGame = {
        id: this.values[0],
        white_user_id: this.values[1],
        status: this.values[2],
        sfen: this.values[3],
        moves_json: this.values[4],
        current_turn: this.values[5],
        winner_user_id: this.values[6],
        end_reason: this.values[7],
        version: this.values[8],
        updated_at: this.values[9],
      };
      this.db.applyUpdatedGame(this.db.updatedGame);
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    if (this.sql.includes("INSERT INTO game_events")) {
      const current = this.db.rowForGame(String(this.values[8]));
      if (!current || Number(this.values[9]) !== Number(current.version)) {
        return Promise.resolve({ meta: { changes: 0 }, success: true });
      }
      this.db.insertedEvents.push({
        id: this.values[0],
        game_id: this.values[1],
        seq: this.values[2],
        type: this.values[3],
        actor_user_id: this.values[4],
        payload_json: this.values[5],
        client_request_id: this.values[6],
        created_at: this.values[7],
      });
      return Promise.resolve({ meta: { changes: 1 }, success: true });
    }
    return Promise.resolve({ success: true });
  }
}
