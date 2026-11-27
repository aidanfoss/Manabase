// backend/tests/friends.test.js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../server.js";
import { db } from "../db/connection.js";

describe("Friends & Social API", () => {
  let userAToken, userAId;
  let userBToken, userBId;
  let userCToken, userCId;

  beforeEach(async () => {
    // Clear relevant tables
    await db("direct_messages").del();
    await db("blocked_users").del();
    await db("friend_requests").del();
    await db("friends").del();

    const timestamp = Date.now();
    // Register User A
    const resA = await request(app).post("/api/auth/register").send({
      email: `user_a_${timestamp}@example.com`,
      username: `UserA_${timestamp}`,
      password: "password123",
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app).post("/api/auth/register").send({
      email: `user_b_${timestamp}@example.com`,
      username: `UserB_${timestamp}`,
      password: "password123",
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    // Register User C
    const resC = await request(app).post("/api/auth/register").send({
      email: `user_c_${timestamp}@example.com`,
      username: `UserC_${timestamp}`,
      password: "password123",
    });
    userCToken = resC.body.token;
    userCId = resC.body.user.id;
  });

  it("should send a friend request and list pending requests", async () => {
    // User A sends request to User B
    const sendRes = await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.request.status).toBe("pending");

    // User A should see outgoing request
    const reqsA = await request(app)
      .get("/api/friends/requests")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(reqsA.status).toBe(200);
    expect(reqsA.body.outgoing.length).toBe(1);
    expect(reqsA.body.outgoing[0].receiver_id).toBe(userBId);

    // User B should see incoming request
    const reqsB = await request(app)
      .get("/api/friends/requests")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(reqsB.status).toBe(200);
    expect(reqsB.body.incoming.length).toBe(1);
    expect(reqsB.body.incoming[0].sender_id).toBe(userAId);
  });

  it("should accept a friend request and create reciprocal friend rows", async () => {
    // A requests B
    await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });

    const reqsB = await request(app)
      .get("/api/friends/requests")
      .set("Authorization", `Bearer ${userBToken}`);
    const requestId = reqsB.body.incoming[0].request_id;

    // B accepts request
    const acceptRes = await request(app)
      .post(`/api/friends/requests/${requestId}/accept`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({});
    expect(acceptRes.status).toBe(200);

    // Both should now see each other in /api/friends
    const friendsA = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(friendsA.status).toBe(200);
    expect(friendsA.body.length).toBe(1);
    expect(friendsA.body[0].id).toBe(userBId);
    expect(friendsA.body[0].allow_trading).toBe(true);
    expect(friendsA.body[0].allow_proxy_orders).toBe(false);

    const friendsB = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(friendsB.status).toBe(200);
    expect(friendsB.body.length).toBe(1);
    expect(friendsB.body[0].id).toBe(userAId);
  });

  it("should allow independent permission settings per friend", async () => {
    // Establish friendship between A and B
    await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });

    const reqsB = await request(app)
      .get("/api/friends/requests")
      .set("Authorization", `Bearer ${userBToken}`);
    const requestId = reqsB.body.incoming[0].request_id;

    await request(app)
      .post(`/api/friends/requests/${requestId}/accept`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({});

    // User A enables proxy orders for User B, and disables trading
    const updateRes = await request(app)
      .put(`/api/friends/${userBId}/settings`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ allow_trading: false, allow_proxy_orders: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.settings.allow_trading).toBe(false);
    expect(updateRes.body.settings.allow_proxy_orders).toBe(true);

    // User A's view
    const friendsA = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(friendsA.body[0].allow_trading).toBe(false);
    expect(friendsA.body[0].allow_proxy_orders).toBe(true);
    // User B hasn't modified settings, so user B allows trading to A
    expect(friendsA.body[0].friend_allows_trading).toBe(true);
    expect(friendsA.body[0].friend_allows_proxy_orders).toBe(false);

    // User B's view: user B's settings are unchanged
    const friendsB = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(friendsB.body[0].allow_trading).toBe(true);
    expect(friendsB.body[0].allow_proxy_orders).toBe(false);
    expect(friendsB.body[0].friend_allows_trading).toBe(false);
    expect(friendsB.body[0].friend_allows_proxy_orders).toBe(true);
  });

  it("should decline and cancel friend requests", async () => {
    // A requests B
    const sendRes = await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });
    const requestId = sendRes.body.request.id;

    // B declines
    const declineRes = await request(app)
      .post(`/api/friends/requests/${requestId}/decline`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({});
    expect(declineRes.status).toBe(200);

    // A requests C
    const sendResC = await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userCId });
    const requestIdC = sendResC.body.request.id;

    // A cancels request to C
    const cancelRes = await request(app)
      .delete(`/api/friends/requests/${requestIdC}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(cancelRes.status).toBe(200);

    const reqsA = await request(app)
      .get("/api/friends/requests")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(reqsA.body.outgoing.length).toBe(0);
  });

  it("should remove an established friendship", async () => {
    // Establish friendship
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

    // User A removes User B
    const removeRes = await request(app)
      .delete(`/api/friends/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(removeRes.status).toBe(200);

    // Both friends lists should now be empty
    const friendsA = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(friendsA.body.length).toBe(0);

    const friendsB = await request(app)
      .get("/api/friends")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(friendsB.body.length).toBe(0);
  });

  it("should search users and correctly reflect relationship statuses", async () => {
    // Search for User B from User A
    const searchRes = await request(app)
      .get("/api/friends/search?q=UserB")
      .set("Authorization", `Bearer ${userAToken}`);
    expect(searchRes.status).toBe(200);
    const foundB = searchRes.body.find((u) => u.id === userBId);
    expect(foundB).toBeDefined();
    expect(foundB.relationship).toBe("none");

    // Send request to B
    await request(app)
      .post("/api/friends/request")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ target: userBId });

    const searchAfterReq = await request(app)
      .get("/api/friends/search?q=UserB")
      .set("Authorization", `Bearer ${userAToken}`);
    const foundBAfter = searchAfterReq.body.find((u) => u.id === userBId);
    expect(foundBAfter.relationship).toBe("pending_outgoing");
  });
});
