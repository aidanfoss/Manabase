import express from "express";
import { db } from "../db/connection.js";
import { authenticate } from "../middleware/auth.js"; 

const router = express.Router();

// GET /api/playgroups - List user's playgroups
router.get("/", authenticate, async (req, res) => {
  try {
    const playgroups = await db("playgroups")
      .join("playgroup_members", "playgroups.id", "playgroup_members.playgroup_id")
      .where("playgroup_members.user_id", req.user.id)
      .select("playgroups.id", "playgroups.name", "playgroups.created_at");
    res.json(playgroups);
  } catch (err) {
    console.error("Error fetching playgroups:", err);
    res.status(500).json({ error: "Failed to fetch playgroups." });
  }
});

// POST /api/playgroups - Create a playgroup
router.post("/", authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    await db.transaction(async (trx) => {
      const [id] = await trx("playgroups").insert({ name }).returning("id");
      const playgroupId = typeof id === "object" ? id.id : id; 
      
      await trx("playgroup_members").insert({
        playgroup_id: playgroupId,
        user_id: req.user.id
      });
      
      res.json({ id: playgroupId, name });
    });
  } catch (err) {
    console.error("Error creating playgroup:", err);
    res.status(500).json({ error: "Failed to create playgroup." });
  }
});

// POST /api/playgroups/:id/join - Join a playgroup
router.post("/:id/join", authenticate, async (req, res) => {
  try {
    const playgroupId = req.params.id;
    const group = await db("playgroups").where({ id: playgroupId }).first();
    if (!group) return res.status(404).json({ error: "Playgroup not found" });

    await db("playgroup_members").insert({
      playgroup_id: playgroupId,
      user_id: req.user.id
    }).onConflict(['playgroup_id', 'user_id']).ignore(); 

    res.json({ success: true, message: "Joined playgroup" });
  } catch (err) {
    console.error("Error joining playgroup:", err);
    res.status(500).json({ error: "Failed to join playgroup." });
  }
});

// GET /api/playgroups/:id/members - List members
router.get("/:id/members", authenticate, async (req, res) => {
  try {
    const playgroupId = req.params.id;
    const members = await db("users")
      .join("playgroup_members", "users.id", "playgroup_members.user_id")
      .where("playgroup_members.playgroup_id", playgroupId)
      .select("users.id", "users.username");
      
    res.json(members);
  } catch (err) {
    console.error("Error fetching members:", err);
    res.status(500).json({ error: "Failed to fetch members." });
  }
});

// GET /api/playgroups/:id/inventory - List all cards owned by members of this playgroup
router.get("/:id/inventory", authenticate, async (req, res) => {
  try {
    const playgroupId = req.params.id;
    
    // verify user is in playgroup
    const isMember = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!isMember) return res.status(403).json({ error: "Not a member" });

    // Get all user_cards belonging to users in this playgroup
    const inventory = await db("user_cards")
      .join("playgroup_members", "user_cards.user_id", "playgroup_members.user_id")
      .join("users", "user_cards.user_id", "users.id")
      .where("playgroup_members.playgroup_id", playgroupId)
      .select(
        "user_cards.id",
        "user_cards.card_name",
        "user_cards.market_price",
        "user_cards.max_price_threshold",
        "users.username as owner_username",
        "users.id as owner_id"
      );

    res.json(inventory);
  } catch (err) {
    console.error("Error fetching group inventory:", err);
    res.status(500).json({ error: "Failed to fetch group inventory." });
  }
});

export default router;
