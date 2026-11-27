// backend/tests/blocks.test.js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../server.js";
import { db } from "../db/connection.js";

describe("User Blocking API", () => {
  let userAToken, userAId;
  let userBToken, userBId;

  beforeEach(async () => {
    await db("direct_messages").del();
    await db("blocked_users").del();
    await db("friend_requests").del();
    await db("friends").del();

    const timestamp = Date.now();
    const resA = await request(app).post("/api/auth/register").send({
      email: `blocker_${timestamp}@example.com`,
      username: `Blocker_${timestamp}`,
      password: "password123",
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    const resB = await request(app).post("/api/auth/register").send({
      email: `blockee_${timestamp}@example.com`,
      username: `Blockee_${timestamp}`,
      password: "password123",
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
  });

  it("should block a user, severs friendships, and clears pending requests", async () => {
    // 1. Establish friendship
    await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });

    const reqsB = await request(app)
      .get("/api/friends/requests")
      .set("Authorization", `Bearer ${userBToken}`);
    await request(app)
      .post(`/api/friends/requests/${reqsB.body.incoming[0].request_id}/accept`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({});

    // Verify friendship exists
    const friendsBefore = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(friendsBefore.body.length).toBe(1);

    // 2. User A blocks User B
    const blockRes = await request(app)
      .post(`/api/blocks/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({});
    expect(blockRes.status).toBe(201);

    // 3. Friendship should be severed in both directions
    const friendsA = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(friendsA.body.length).toBe(0);

    const friendsB = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(friendsB.body.length).toBe(0);

    // 4. Blocked list should contain User B
    const blockedList = await request(app)
      .get("/api/blocks")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(blockedList.status).toBe(200);
    expect(blockedList.body.length).toBe(1);
    expect(blockedList.body[0].id).toBe(userBId);
  });

  it("should prevent blocked users from sending friend requests to blocker", async () => {
    // User A blocks User B
    await request(app)
      .post(`/api/blocks/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({});

    // User B attempts to send request to User A
    const reqRes = await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ target: userAId });

    expect(reqRes.status).toBe(403);
    expect(reqRes.body.error).toMatch(/blocked/i);
  });

  it("should prevent blocker from sending requests to blocked user without unblocking", async () => {
    await request(app)
      .post(`/api/blocks/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({});

    const reqRes = await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });

    expect(reqRes.status).toBe(400);
    expect(reqRes.body.error).toMatch(/unblock/i);
  });

  it("should unblock a user successfully", async () => {
    await request(app)
      .post(`/api/blocks/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({});

    const unblockRes = await request(app)
      .delete(`/api/blocks/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(unblockRes.status).toBe(200);

    const blockedList = await request(app)
      .get("/api/blocks")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(blockedList.body.length).toBe(0);
  });
});
