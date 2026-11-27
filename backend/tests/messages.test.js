// backend/tests/messages.test.js
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../server.js";
import { db } from "../db/connection.js";

describe("Direct Messages & Permissions Gating API", () => {
  let userAToken, userAId;
  let userBToken, userBId;
  let userCToken, userCId;

  beforeEach(async () => {
    await db("direct_messages").del();
    await db("blocked_users").del();
    await db("friend_requests").del();
    await db("friends").del();

    const timestamp = Date.now();
    const resA = await request(app).post("/api/auth/register").send({
      email: `msg_a_${timestamp}@example.com`,
      username: `MsgA_${timestamp}`,
      password: "password123",
    });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    const resB = await request(app).post("/api/auth/register").send({
      email: `msg_b_${timestamp}@example.com`,
      username: `MsgB_${timestamp}`,
      password: "password123",
    });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;

    const resC = await request(app).post("/api/auth/register").send({
      email: `msg_c_${timestamp}@example.com`,
      username: `MsgC_${timestamp}`,
      password: "password123",
    });
    userCToken = resC.body.token;
    userCId = resC.body.user.id;
  });

  it("should prevent non-friends from sending direct messages", async () => {
    const sendRes = await request(app)
      .post(`/api/messages/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ content: "Hello without friendship!" });

    expect(sendRes.status).toBe(403);
    expect(sendRes.body.error).toMatch(/friends/i);
  });

  it("should allow friends to send messages, retrieve conversation, and mark as read", async () => {
    // 1. Establish friendship between A and B
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

    // 2. User A sends message to User B
    const msgRes = await request(app)
      .post(`/api/messages/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ content: "Hey! Want to trade for your Mana Vault?" });
    expect(msgRes.status).toBe(201);
    expect(msgRes.body.message.content).toBe("Hey! Want to trade for your Mana Vault?");

    // 3. User B checks unread count
    const unreadRes = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBe(1);

    // 4. User B checks conversations list
    const convsRes = await request(app)
      .get("/api/messages/conversations")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(convsRes.status).toBe(200);
    expect(convsRes.body.length).toBe(1);
    expect(convsRes.body[0].friend.id).toBe(userAId);
    expect(convsRes.body[0].unread_count).toBe(1);

    // 5. User B fetches message history
    const histRes = await request(app)
      .get(`/api/messages/${userAId}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(histRes.status).toBe(200);
    expect(histRes.body.messages.length).toBe(1);
    expect(histRes.body.messages[0].content).toBe("Hey! Want to trade for your Mana Vault?");

    // 6. User B marks messages as read
    const readRes = await request(app)
      .post(`/api/messages/${userAId}/read`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({});
    expect(readRes.status).toBe(200);

    const unreadAfter = await request(app)
      .get("/api/messages/unread-count")
      .set("Authorization", `Bearer ${userBToken}`);
    expect(unreadAfter.body.count).toBe(0);
  });

  it("should prevent blocked users from sending messages", async () => {
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

    // User A blocks User B
    await request(app)
      .post(`/api/blocks/${userBId}`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({});

    // User B tries to send message to User A
    const msgRes = await request(app)
      .post(`/api/messages/${userAId}`)
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ content: "Are we still friends?" });

    expect(msgRes.status).toBe(403);
    expect(msgRes.body.error).toMatch(/blocked|friends/i);
  });
});
