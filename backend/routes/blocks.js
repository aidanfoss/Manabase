// backend/routes/blocks.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/blocks - List all blocked users for the current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    const blocked = await db("blocked_users as b")
      .join("users as u", "b.blocked_id", "u.id")
      .where("b.user_id", me)
      .select("u.id", "u.username", "u.email", "u.avatar_url", "b.created_at")
      .orderBy("b.created_at", "desc");

    res.json(blocked);
  } catch (err) {
    console.error("Error fetching blocked users:", err);
    res.status(500).json({ error: "Failed to fetch blocked users." });
  }
});

// POST /api/blocks/:userId - Block a user
router.post("/:userId", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { userId } = req.params;

    if (userId === me) {
      return res.status(400).json({ error: "You cannot block yourself." });
    }

    const targetUser = await db("users").where({ id: userId }).first();
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    await db.transaction(async (trx) => {
      // 1. Insert into blocked_users if not exists
      const existing = await trx("blocked_users")
        .where({ user_id: me, blocked_id: userId })
        .first();

      if (!existing) {
        await trx("blocked_users").insert({
          user_id: me,
          blocked_id: userId,
        });
      }

      // 2. Sever any friendships
      await trx("friends")
        .where(function () {
          this.where({ user_id: me, friend_id: userId })
            .orWhere({ user_id: userId, friend_id: me });
        })
        .del();

      // 3. Delete any pending friend requests
      await trx("friend_requests")
        .where(function () {
          this.where({ sender_id: me, receiver_id: userId })
            .orWhere({ sender_id: userId, receiver_id: me });
        })
        .del();
    });

    res.status(201).json({ success: true, message: `Blocked ${targetUser.username}.` });
  } catch (err) {
    console.error("Error blocking user:", err);
    res.status(500).json({ error: "Failed to block user." });
  }
});

// DELETE /api/blocks/:userId - Unblock a user
router.delete("/:userId", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const { userId } = req.params;

    const deleted = await db("blocked_users")
      .where({ user_id: me, blocked_id: userId })
      .del();

    if (!deleted) {
      return res.status(404).json({ error: "User is not blocked." });
    }

    res.json({ success: true, message: "User unblocked." });
  } catch (err) {
    console.error("Error unblocking user:", err);
    res.status(500).json({ error: "Failed to unblock user." });
  }
});

export default router;
