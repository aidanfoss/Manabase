// backend/routes/friends.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { isUserOnline } from "../services/websocket.js";

const router = express.Router();

// GET /api/friends - List all accepted friends with mutual permissions & online status
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    const friends = await db("friends as f1")
      .join("users as u", "f1.friend_id", "u.id")
      .leftJoin("friends as f2", function () {
        this.on("f1.user_id", "=", "f2.friend_id")
          .andOn("f1.friend_id", "=", "f2.user_id");
      })
      .where("f1.user_id", me)
      .select(
        "u.id",
        "u.username",
        "u.email",
        "u.avatar_url",
        "f1.allow_trading",
        "f1.allow_proxy_orders",
        "f2.allow_trading as friend_allows_trading",
        "f2.allow_proxy_orders as friend_allows_proxy_orders",
        "f1.created_at as friendship_date"
      )
      .orderBy("u.username", "asc");

    const enriched = friends.map((f) => ({
      ...f,
      allow_trading: !!f.allow_trading,
      allow_proxy_orders: !!f.allow_proxy_orders,
      friend_allows_trading: f.friend_allows_trading !== null ? !!f.friend_allows_trading : true,
      friend_allows_proxy_orders: !!f.friend_allows_proxy_orders,
      is_online: isUserOnline(f.id),
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Error fetching friends:", err);
    res.status(500).json({ error: "Failed to fetch friends." });
  }
});

// GET /api/friends/requests - List pending incoming and outgoing friend requests
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    const incoming = await db("friend_requests as fr")
      .join("users as u", "fr.sender_id", "u.id")
      .where("fr.receiver_id", me)
      .where("fr.status", "pending")
      .select(
        "fr.id as request_id",
        "fr.sender_id",
        "fr.receiver_id",
        "u.id as user_id",
        "u.username",
        "u.email",
        "u.avatar_url",
        "fr.created_at"
      )
      .orderBy("fr.created_at", "desc");

    const outgoing = await db("friend_requests as fr")
      .join("users as u", "fr.receiver_id", "u.id")
      .where("fr.sender_id", me)
      .where("fr.status", "pending")
      .select(
        "fr.id as request_id",
        "fr.sender_id",
        "fr.receiver_id",
        "u.id as user_id",
        "u.username",
        "u.email",
        "u.avatar_url",
        "fr.created_at"
      )
      .orderBy("fr.created_at", "desc");

    res.json({ incoming, outgoing });
  } catch (err) {
    console.error("Error fetching friend requests:", err);
    res.status(500).json({ error: "Failed to fetch friend requests." });
  }
});

// POST /api/friends/request - Send friend request (by target user ID, username, or email)
router.post("/request", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { target } = req.body;

    if (!target || typeof target !== "string") {
      return res.status(400).json({ error: "Target user ID, username, or email is required." });
    }

    const trimmed = target.trim();

    // Look up target user
    const targetUser = await db("users")
      .where(function () {
        this.where("id", trimmed)
          .orWhere("username", trimmed)
          .orWhere("email", trimmed.toLowerCase());
      })
      .first();

    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    if (targetUser.id === me) {
      return res.status(400).json({ error: "You cannot send a friend request to yourself." });
    }

    // Check if either user has blocked the other
    const iBlocked = await db("blocked_users")
      .where({ user_id: me, blocked_id: targetUser.id })
      .first();

    if (iBlocked) {
      return res.status(400).json({ error: "You have blocked this user. Unblock them first to send a friend request." });
    }

    const theyBlocked = await db("blocked_users")
      .where({ user_id: targetUser.id, blocked_id: me })
      .first();

    if (theyBlocked) {
      return res.status(403).json({ error: "Unable to send friend request; you are blocked by this user." });
    }

    // Check if already friends
    const alreadyFriends = await db("friends")
      .where({ user_id: me, friend_id: targetUser.id })
      .first();

    if (alreadyFriends) {
      return res.status(400).json({ error: "You are already friends with this user." });
    }

    // Check if request already pending from me to target
    const existingOut = await db("friend_requests")
      .where({ sender_id: me, receiver_id: targetUser.id, status: "pending" })
      .first();

    if (existingOut) {
      return res.status(400).json({ error: "Friend request already sent." });
    }

    // Check if there is already an incoming request from target to me -> auto accept!
    const existingIn = await db("friend_requests")
      .where({ sender_id: targetUser.id, receiver_id: me, status: "pending" })
      .first();

    if (existingIn) {
      await db.transaction(async (trx) => {
        await trx("friends").insert([
          { user_id: me, friend_id: targetUser.id, allow_trading: true, allow_proxy_orders: false },
          { user_id: targetUser.id, friend_id: me, allow_trading: true, allow_proxy_orders: false },
        ]);
        await trx("friend_requests").where({ id: existingIn.id }).del();
      });

      return res.json({
        success: true,
        accepted: true,
        message: `Accepted friend request from ${targetUser.username}!`,
      });
    }

    // Otherwise, create pending request
    const [inserted] = await db("friend_requests")
      .insert({
        sender_id: me,
        receiver_id: targetUser.id,
        status: "pending",
      })
      .returning("*");

    const newReq = typeof inserted === "object" && inserted !== null
      ? inserted
      : await db("friend_requests").where({ sender_id: me, receiver_id: targetUser.id, status: "pending" }).orderBy("created_at", "desc").first();

    res.status(201).json({
      success: true,
      request: newReq,
      message: `Friend request sent to ${targetUser.username}.`,
    });
  } catch (err) {
    console.error("Error sending friend request:", err);
    res.status(500).json({ error: "Failed to send friend request." });
  }
});

// POST /api/friends/requests/:id/accept - Accept friend request
router.post("/requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;

    const request = await db("friend_requests")
      .where({ id, receiver_id: me, status: "pending" })
      .first();

    if (!request) {
      return res.status(404).json({ error: "Friend request not found or already processed." });
    }

    await db.transaction(async (trx) => {
      // Create dual rows
      await trx("friends").insert([
        { user_id: me, friend_id: request.sender_id, allow_trading: true, allow_proxy_orders: false },
        { user_id: request.sender_id, friend_id: me, allow_trading: true, allow_proxy_orders: false },
      ]);

      await trx("friend_requests").where({ id }).del();
    });

    res.json({ success: true, message: "Friend request accepted." });
  } catch (err) {
    console.error("Error accepting friend request:", err);
    res.status(500).json({ error: "Failed to accept friend request." });
  }
});

// POST /api/friends/requests/:id/decline - Decline friend request
router.post("/requests/:id/decline", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;

    const deleted = await db("friend_requests")
      .where({ id, receiver_id: me })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: "Friend request not found." });
    }

    res.json({ success: true, message: "Friend request declined." });
  } catch (err) {
    console.error("Error declining friend request:", err);
    res.status(500).json({ error: "Failed to decline friend request." });
  }
});

// DELETE /api/friends/requests/:id - Cancel outgoing friend request
router.delete("/requests/:id", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;

    const deleted = await db("friend_requests")
      .where({ id, sender_id: me })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: "Friend request not found." });
    }

    res.json({ success: true, message: "Friend request cancelled." });
  } catch (err) {
    console.error("Error cancelling friend request:", err);
    res.status(500).json({ error: "Failed to cancel friend request." });
  }
});

// DELETE /api/friends/:friendId - Remove a friend
router.delete("/:friendId", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;

    await db("friends")
      .where(function () {
        this.where({ user_id: me, friend_id: friendId })
          .orWhere({ user_id: friendId, friend_id: me });
      })
      .del();

    res.json({ success: true, message: "Friend removed." });
  } catch (err) {
    console.error("Error removing friend:", err);
    res.status(500).json({ error: "Failed to remove friend." });
  }
});

// PUT /api/friends/:friendId/settings - Update permission settings for a friend
router.put("/:friendId/settings", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;
    const { allow_trading, allow_proxy_orders } = req.body;

    const friendship = await db("friends")
      .where({ user_id: me, friend_id: friendId })
      .first();

    if (!friendship) {
      return res.status(404).json({ error: "Friendship not found." });
    }

    const updates = {};
    if (typeof allow_trading === "boolean") {
      updates.allow_trading = allow_trading;
    }
    if (typeof allow_proxy_orders === "boolean") {
      updates.allow_proxy_orders = allow_proxy_orders;
    }
    updates.updated_at = db.fn.now();

    await db("friends")
      .where({ user_id: me, friend_id: friendId })
      .update(updates);

    res.json({
      success: true,
      settings: {
        allow_trading: updates.allow_trading !== undefined ? updates.allow_trading : !!friendship.allow_trading,
        allow_proxy_orders: updates.allow_proxy_orders !== undefined ? updates.allow_proxy_orders : !!friendship.allow_proxy_orders,
      },
    });
  } catch (err) {
    console.error("Error updating friend settings:", err);
    res.status(500).json({ error: "Failed to update friend settings." });
  }
});

// GET /api/friends/search - Search users to add as friends
router.get("/search", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const q = (req.query.q || "").trim();

    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Get blocked users in both directions
    const blockedRows = await db("blocked_users")
      .where("user_id", me)
      .orWhere("blocked_id", me)
      .select("user_id", "blocked_id");

    const blockedIds = new Set();
    blockedRows.forEach((r) => {
      blockedIds.add(r.user_id === me ? r.blocked_id : r.user_id);
    });

    const users = await db("users")
      .whereNot("id", me)
      .where(function () {
        this.where("username", "like", `%${q}%`)
          .orWhere("email", "like", `%${q}%`);
      })
      .select("id", "username", "email", "avatar_url")
      .limit(10);

    const filteredUsers = users.filter((u) => !blockedIds.has(u.id));

    // Determine relationship status with each user
    const friendRows = await db("friends")
      .where("user_id", me)
      .whereIn("friend_id", filteredUsers.map((u) => u.id));
    const friendIds = new Set(friendRows.map((f) => f.friend_id));

    const outRequests = await db("friend_requests")
      .where({ sender_id: me, status: "pending" })
      .whereIn("receiver_id", filteredUsers.map((u) => u.id));
    const outRequestIds = new Set(outRequests.map((r) => r.receiver_id));

    const inRequests = await db("friend_requests")
      .where({ receiver_id: me, status: "pending" })
      .whereIn("sender_id", filteredUsers.map((u) => u.id));
    const inRequestMap = {};
    inRequests.forEach((r) => { inRequestMap[r.sender_id] = r.id; });

    const results = filteredUsers.map((u) => {
      let status = "none";
      let requestId = null;
      if (friendIds.has(u.id)) {
        status = "friend";
      } else if (outRequestIds.has(u.id)) {
        status = "pending_outgoing";
      } else if (inRequestMap[u.id]) {
        status = "pending_incoming";
        requestId = inRequestMap[u.id];
      }
      return { ...u, relationship: status, request_id: requestId };
    });

    res.json(results);
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ error: "Failed to search users." });
  }
});

// GET /api/friends/code - Retrieve current user's friend code (generate if missing)
router.get("/code", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    // Ensure user has a friend_code
    let user = await db("users").where({ id: me }).first();
    if (!user.friend_code) {
      let newCode;
      do {
        newCode = Math.random().toString(36).substr(2, 8).toUpperCase();
        const exists = await db("users").where({ friend_code: newCode }).first();
        if (!exists) break;
      } while (true);
      await db("users").where({ id: me }).update({ friend_code: newCode });
      user.friend_code = newCode;
    }
    res.json({ friend_code: user.friend_code });
  } catch (err) {
    console.error("Error fetching friend code:", err);
    res.status(500).json({ error: "Failed to fetch friend code." });
  }
});

// POST /api/friends/code - Regenerate the user's friend code
router.post("/code", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    let newCode;
    do {
      newCode = Math.random().toString(36).substr(2, 8).toUpperCase();
      const exists = await db("users").where({ friend_code: newCode }).first();
      if (!exists) break;
    } while (true);
    await db("users").where({ id: me }).update({ friend_code: newCode });
    res.json({ friend_code: newCode });
  } catch (err) {
    console.error("Error regenerating friend code:", err);
    res.status(500).json({ error: "Failed to regenerate friend code." });
  }
});

// POST /api/friends/code/:code - Send a friend request using a friend code
router.post("/code/:code", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { code } = req.params;

    // Look up target user by friend_code
    const targetUser = await db("users").where({ friend_code: code }).first();

    if (!targetUser) {
      return res.status(404).json({ error: "User with that friend code not found." });
    }
    if (targetUser.id === me) {
      return res.status(400).json({ error: "You cannot send a friend request to yourself." });
    }

    // Check blocks
    const iBlocked = await db("blocked_users").where({ user_id: me, blocked_id: targetUser.id }).first();
    if (iBlocked) {
      return res.status(400).json({ error: "You have blocked this user. Unblock them first to send a friend request." });
    }
    const theyBlocked = await db("blocked_users").where({ user_id: targetUser.id, blocked_id: me }).first();
    if (theyBlocked) {
      return res.status(403).json({ error: "Unable to send friend request; you are blocked by this user." });
    }

    // Already friends?
    const alreadyFriends = await db("friends").where({ user_id: me, friend_id: targetUser.id }).first();
    if (alreadyFriends) {
      return res.status(400).json({ error: "You are already friends with this user." });
    }

    // Existing outgoing request?
    const existingOut = await db("friend_requests").where({ sender_id: me, receiver_id: targetUser.id, status: "pending" }).first();
    if (existingOut) {
      return res.status(400).json({ error: "Friend request already sent." });
    }

    // Auto-accept if there is an incoming request
    const existingIn = await db("friend_requests").where({ sender_id: targetUser.id, receiver_id: me, status: "pending" }).first();
    if (existingIn) {
      await db.transaction(async (trx) => {
        await trx("friends").insert([
          { user_id: me, friend_id: targetUser.id, allow_trading: true, allow_proxy_orders: false },
          { user_id: targetUser.id, friend_id: me, allow_trading: true, allow_proxy_orders: false },
        ]);
        await trx("friend_requests").where({ id: existingIn.id }).del();
      });
      return res.json({
        success: true,
        accepted: true,
        message: `Accepted friend request from ${targetUser.username}!`,
      });
    }

    // Create pending request
    const [inserted] = await db("friend_requests").insert({ sender_id: me, receiver_id: targetUser.id, status: "pending" }).returning("*");
    const newReq = typeof inserted === "object" && inserted !== null
      ? inserted
      : await db("friend_requests").where({ sender_id: me, receiver_id: targetUser.id, status: "pending" }).orderBy("created_at", "desc").first();
    res.status(201).json({ success: true, request: newReq, message: `Friend request sent to ${targetUser.username}.` });
  } catch (err) {
    console.error("Error sending friend request by code:", err);
    res.status(500).json({ error: "Failed to send friend request." });
  }
});

export default router;
