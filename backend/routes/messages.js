// backend/routes/messages.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { sendToUser, isUserOnline } from "../services/websocket.js";

const router = express.Router();

// GET /api/messages/unread-count - Total unread direct messages count
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    const countRes = await db("direct_messages")
      .where({ recipient_id: me })
      .whereNull("read_at")
      .count("id as count")
      .first();

    const count = parseInt(countRes?.count || 0, 10);
    res.json({ count });
  } catch (err) {
    console.error("Error fetching unread messages count:", err);
    res.status(500).json({ error: "Failed to fetch unread messages count." });
  }
});

// GET /api/messages/conversations - List conversations with friends, last message snippet, unread count
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    // Get all friends
    const friends = await db("friends as f")
      .join("users as u", "f.friend_id", "u.id")
      .where("f.user_id", me)
      .select("u.id", "u.username", "u.email", "u.avatar_url", "f.allow_trading");

    if (friends.length === 0) {
      return res.json([]);
    }

    const friendIds = friends.map((f) => f.id);

    // Fetch all messages involving me and any friend
    const messages = await db("direct_messages")
      .where(function () {
        this.where("sender_id", me).whereIn("recipient_id", friendIds);
      })
      .orWhere(function () {
        this.where("recipient_id", me).whereIn("sender_id", friendIds);
      })
      .orderBy("created_at", "desc");

    // Group by friend ID
    const convMap = {};
    friends.forEach((f) => {
      convMap[f.id] = {
        friend: {
          id: f.id,
          username: f.username,
          email: f.email,
          avatar_url: f.avatar_url,
          is_online: isUserOnline(f.id),
          allow_trading: !!f.allow_trading,
        },
        last_message: null,
        unread_count: 0,
      };
    });

    messages.forEach((m) => {
      const partnerId = m.sender_id === me ? m.recipient_id : m.sender_id;
      if (!convMap[partnerId]) return;

      if (!convMap[partnerId].last_message) {
        convMap[partnerId].last_message = {
          id: m.id,
          sender_id: m.sender_id,
          recipient_id: m.recipient_id,
          content: m.content,
          created_at: m.created_at,
          read_at: m.read_at,
        };
      }

      if (m.recipient_id === me && !m.read_at) {
        convMap[partnerId].unread_count += 1;
      }
    });

    const conversations = Object.values(convMap)
      .sort((a, b) => {
        const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
        const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
        return timeB - timeA;
      });

    res.json(conversations);
  } catch (err) {
    console.error("Error fetching conversations:", err);
    res.status(500).json({ error: "Failed to fetch conversations." });
  }
});

// GET /api/messages/:friendId - Get message history between user and friend
router.get("/:friendId", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
    const before = req.query.before;

    // Check friendship & block
    const isBlocked = await db("blocked_users")
      .where(function () {
        this.where({ user_id: me, blocked_id: friendId })
          .orWhere({ user_id: friendId, blocked_id: me });
      })
      .first();

    if (isBlocked) {
      return res.status(403).json({ error: "Communication blocked." });
    }

    const friend = await db("users").where({ id: friendId }).select("id", "username", "email", "avatar_url").first();
    if (!friend) {
      return res.status(404).json({ error: "User not found." });
    }

    let query = db("direct_messages")
      .where(function () {
        this.where({ sender_id: me, recipient_id: friendId })
          .orWhere({ sender_id: friendId, recipient_id: me });
      })
      .orderBy("created_at", "desc")
      .limit(limit);

    if (before) {
      query = query.where("created_at", "<", before);
    }

    const rows = await query;
    const messages = rows.reverse(); // chronological order

    // Mark unread messages as read
    await db("direct_messages")
      .where({ sender_id: friendId, recipient_id: me })
      .whereNull("read_at")
      .update({ read_at: db.fn.now() });

    sendToUser(friendId, {
      type: "messages_read",
      read_by: me,
    });

    res.json({
      friend: {
        ...friend,
        is_online: isUserOnline(friend.id),
      },
      messages,
    });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
});

// POST /api/messages/:friendId - Send a direct message (REST fallback)
router.post("/:friendId", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "Message content is required." });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: "Message cannot exceed 2000 characters." });
    }

    if (friendId === me) {
      return res.status(400).json({ error: "Cannot message yourself." });
    }

    // Verify block
    const isBlocked = await db("blocked_users")
      .where(function () {
        this.where({ user_id: me, blocked_id: friendId })
          .orWhere({ user_id: friendId, blocked_id: me });
      })
      .first();

    if (isBlocked) {
      return res.status(403).json({ error: "Communication blocked." });
    }

    // Verify friendship
    const friendship = await db("friends")
      .where({ user_id: me, friend_id: friendId })
      .first();

    if (!friendship) {
      return res.status(403).json({ error: "You can only message friends." });
    }

    const [inserted] = await db("direct_messages")
      .insert({
        sender_id: me,
        recipient_id: friendId,
        content: content.trim(),
      })
      .returning("*");

    const saved = typeof inserted === "object" && inserted !== null
      ? inserted
      : await db("direct_messages").where({ id: inserted }).first();

    // Broadcast in real-time
    sendToUser(me, { type: "message_sent", message: saved });
    sendToUser(friendId, { type: "new_message", message: saved });

    res.status(201).json({
      success: true,
      message: saved,
      ...saved,
    });
  } catch (err) {
    console.error("Error sending message:", err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// POST /api/messages/:friendId/read - Mark messages from friend as read
router.post("/:friendId/read", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;

    await db("direct_messages")
      .where({ sender_id: friendId, recipient_id: me })
      .whereNull("read_at")
      .update({ read_at: db.fn.now() });

    sendToUser(friendId, {
      type: "messages_read",
      read_by: me,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking messages as read:", err);
    res.status(500).json({ error: "Failed to mark messages as read." });
  }
});

export default router;
