// backend/routes/playgroups.js
import express from "express";
import crypto from "crypto";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { getLocalCardsBatch } from "./scryfallLocal.js";
import { isDoubleFacedCard } from "../utils/cardHelpers.js";
import { syncDeckInternal } from "../services/archidektSync.js";

const router = express.Router();

// GET /api/playgroups - List user's playgroups
router.get("/", requireAuth, async (req, res) => {
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
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Playgroup name is required" });

    const newGroup = await db.transaction(async (trx) => {
      const [inserted] = await trx("playgroups").insert({ name }).returning("*");
      // Knex returns array of inserted objects or IDs
      const playgroupId = typeof inserted === "object" && inserted !== null ? (inserted.id || inserted) : inserted;
      
      await trx("playgroup_members").insert({
        playgroup_id: playgroupId,
        user_id: req.user.id
      });

      // Auto-create an invite link for the creator
      const token = crypto.randomBytes(16).toString("hex");
      await trx("playgroup_invites").insert({
        playgroup_id: playgroupId,
        token,
        created_by: req.user.id
      });
      
      return { id: playgroupId, name };
    });
    
    res.json(newGroup);
  } catch (err) {
    console.error("Error creating playgroup:", err);
    res.status(500).json({ error: "Failed to create playgroup." });
  }
});

// GET /api/playgroups/invites/:token - Fetch details about an invite link
router.get("/invites/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const invite = await db("playgroup_invites")
      .join("playgroups", "playgroup_invites.playgroup_id", "playgroups.id")
      .join("users", "playgroup_invites.created_by", "users.id")
      .where("playgroup_invites.token", token)
      .select(
        "playgroup_invites.token",
        "playgroup_invites.playgroup_id",
        "playgroups.name as playgroup_name",
        "users.username as inviter_username"
      )
      .first();

    if (!invite) {
      return res.status(404).json({ error: "Invalid or expired invite link." });
    }

    res.json(invite);
  } catch (err) {
    console.error("Error fetching invite info:", err);
    res.status(500).json({ error: "Failed to fetch invite details." });
  }
});

// POST /api/playgroups/:id/invite - Generate or retrieve invite link for a playgroup
router.post("/:id/invite", requireAuth, async (req, res) => {
  try {
    const playgroupId = parseInt(req.params.id);
    if (isNaN(playgroupId)) {
      return res.status(400).json({ error: "Invalid playgroup ID" });
    }

    // Verify membership
    const isMember = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!isMember) return res.status(403).json({ error: "Only playgroup members can generate invite links" });

    // Check if an invite token already exists for this group
    let invite = await db("playgroup_invites")
      .where({ playgroup_id: playgroupId })
      .first();

    if (!invite) {
      const token = crypto.randomBytes(16).toString("hex");
      const [inserted] = await db("playgroup_invites")
        .insert({
          playgroup_id: playgroupId,
          token,
          created_by: req.user.id
        })
        .returning("*");
      invite = typeof inserted === "object" ? inserted : { token, playgroup_id: playgroupId };
    }

    res.json({
      success: true,
      token: invite.token,
      playgroup_id: playgroupId
    });
  } catch (err) {
    console.error("Error generating playgroup invite:", err);
    res.status(500).json({ error: "Failed to generate invite link." });
  }
});

// POST /api/playgroups/join - Join a playgroup via invite token
router.post("/join", requireAuth, async (req, res) => {
  try {
    const { invite_token } = req.body;
    if (!invite_token) {
      return res.status(400).json({ error: "Playgroups are private. An invite link/token is required to join." });
    }

    const invite = await db("playgroup_invites")
      .where({ token: invite_token })
      .first();

    if (!invite) {
      return res.status(404).json({ error: "Invalid or expired invite token." });
    }

    const group = await db("playgroups").where({ id: invite.playgroup_id }).first();
    if (!group) {
      return res.status(404).json({ error: "Playgroup no longer exists." });
    }

    // Insert user into playgroup
    await db("playgroup_members")
      .insert({
        playgroup_id: invite.playgroup_id,
        user_id: req.user.id
      })
      .onConflict(["playgroup_id", "user_id"])
      .ignore();

    res.json({ success: true, message: "Joined playgroup successfully", id: group.id, name: group.name });
  } catch (err) {
    console.error("Error joining playgroup:", err);
    res.status(500).json({ error: "Failed to join playgroup." });
  }
});

// POST /api/playgroups/:id/leave - Leave a playgroup
router.post("/:id/leave", requireAuth, async (req, res) => {
  try {
    const playgroupId = parseInt(req.params.id);
    if (isNaN(playgroupId)) {
      return res.status(400).json({ error: "Invalid playgroup ID" });
    }

    const group = await db("playgroups").where({ id: playgroupId }).first();
    if (!group) {
      return res.status(404).json({ error: "Playgroup not found" });
    }

    // Delete membership
    const deletedCount = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .del();

    if (!deletedCount) {
      return res.status(400).json({ error: "You are not a member of this playgroup" });
    }

    // Check remaining member count; if 0, delete group and invites
    const remainingMembers = await db("playgroup_members")
      .where({ playgroup_id: playgroupId })
      .count("* as count")
      .first();

    if (!remainingMembers || parseInt(remainingMembers.count) === 0) {
      await db("playgroup_invites").where({ playgroup_id: playgroupId }).del();
      await db("proxy_orders").where({ playgroup_id: playgroupId }).del();
      await db("playgroups").where({ id: playgroupId }).del();
    }

    res.json({ success: true, message: `Successfully left playgroup "${group.name}"` });
  } catch (err) {
    console.error("Error leaving playgroup:", err);
    res.status(500).json({ error: "Failed to leave playgroup." });
  }
});

// GET /api/playgroups/:id/members - List members
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const members = await db("users")
      .join("playgroup_members", "users.id", "playgroup_members.user_id")
      .where("playgroup_members.playgroup_id", req.params.id)
      .select(
        "users.id",
        "users.username",
        "users.email",
        "playgroup_members.opted_out_of_manifest"
      );
      
    res.json(members);
  } catch (err) {
    console.error("Error fetching playgroup members:", err);
    res.status(500).json({ error: "Failed to fetch members." });
  }
});

// PATCH /api/playgroups/:id/manifest-opt-out - Toggle the current user's opt-out flag
router.patch("/:id/manifest-opt-out", requireAuth, async (req, res) => {
  const playgroupId = req.params.id;
  try {
    const membership = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!membership) return res.status(403).json({ error: "Not a member of this playgroup" });

    const { opted_out } = req.body;
    if (typeof opted_out !== "boolean") {
      return res.status(400).json({ error: "opted_out must be a boolean" });
    }

    await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .update({ opted_out_of_manifest: opted_out });

    res.json({ success: true, opted_out_of_manifest: opted_out });
  } catch (err) {
    console.error("Error toggling manifest opt-out:", err);
    res.status(500).json({ error: "Failed to update opt-out status." });
  }
});

// GET /api/playgroups/:id/inventory - Get combined owned inventories
router.get("/:id/inventory", requireAuth, async (req, res) => {
  try {
    const playgroupId = req.params.id;

    // Verify membership
    const isMember = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!isMember) return res.status(403).json({ error: "Not a member of this playgroup" });

    const inventory = await db("user_cards")
      .join("users", "user_cards.user_id", "users.id")
      .whereIn("user_cards.user_id", function() {
        this.select("user_id").from("playgroup_members").where("playgroup_id", playgroupId);
      })
      .where("user_cards.list_type", "owned")
      .select(
        "user_cards.id",
        "user_cards.user_id",
        "user_cards.card_name",
        "user_cards.set_code",
        "user_cards.collector_number",
        "user_cards.is_foil",
        "user_cards.quantity",
        "user_cards.market_price",
        "user_cards.max_price_threshold",
        "users.username as owner_username"
      );

    res.json(inventory);
  } catch (err) {
    console.error("Error fetching group inventory:", err);
    res.status(500).json({ error: "Failed to fetch playgroup inventory." });
  }
});

// GET /api/playgroups/:id/wishlist - Get combined playgroup wishlists
router.get("/:id/wishlist", requireAuth, async (req, res) => {
  try {
    const playgroupId = req.params.id;

    // Verify membership
    const isMember = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!isMember) return res.status(403).json({ error: "Not a member of this playgroup" });

    // Fetch wishlist items — exclude members who have opted out of the manifest
    const items = await db("user_cards")
      .join("users", "user_cards.user_id", "users.id")
      .whereIn("user_cards.user_id", function() {
        this.select("user_id").from("playgroup_members")
          .where("playgroup_id", playgroupId)
          .where("opted_out_of_manifest", false);
      })
      .where("user_cards.list_type", "wishlist")
      .select(
        "user_cards.id",
        "user_cards.user_id",
        "user_cards.card_name",
        "user_cards.set_code",
        "user_cards.collector_number",
        "user_cards.is_foil",
        "user_cards.quantity",
        "user_cards.created_at",
        "users.username",
        "users.default_card_back as user_card_back"
      )
      .orderBy("user_cards.created_at", "asc");

    const userIds = Array.from(new Set(items.map(item => item.user_id)));
    const proxyArts = await db("user_proxy_arts").whereIn("user_id", userIds);
    
    // Fetch Scryfall metadata to determine true double-faced cards
    const uniqueNames = Array.from(new Set(items.map(item => item.card_name)));
    const scryfallData = await getLocalCardsBatch(uniqueNames);

    // Flatten lists by quantity (to enforce chronological cutoff of individual copies)
    const flatQueue = [];
    items.forEach((item) => {
      const meta = scryfallData[item.card_name];
      const isDfc = isDoubleFacedCard(meta);

      let frontName = item.card_name;
      let backName = null;

      if (isDfc && item.card_name.includes(" // ")) {
        const faces = item.card_name.split(" // ");
        frontName = faces[0];
        backName = faces.length > 1 ? faces[1] : null;
      }

      const frontArt = proxyArts.find(a => a.user_id === item.user_id && a.card_name === frontName);
      const backArt = backName ? proxyArts.find(a => a.user_id === item.user_id && a.card_name === backName) : null;

      for (let i = 0; i < item.quantity; i++) {
        flatQueue.push({
          id: item.id,
          user_id: item.user_id,
          username: item.username,
          card_name: item.card_name,
          set_code: item.set_code,
          collector_number: item.collector_number,
          is_foil: item.is_foil,
          user_card_back: item.user_card_back || "b:black lotus",
          mpcfill_id: frontArt?.mpcfill_id || null,
          mpcfill_name: frontArt?.mpcfill_name || null,
          mpcfill_query: frontArt?.mpcfill_query || null,
          mpcfill_back_id: backArt?.mpcfill_id || null,
          mpcfill_back_name: backArt?.mpcfill_name || null,
          mpcfill_back_query: backArt?.mpcfill_query || null,
          created_at: item.created_at,
          index: i + 1
        });
      }
    });

    res.json(flatQueue);
  } catch (err) {
    console.error("Error fetching group wishlist:", err);
    res.status(500).json({ error: "Failed to fetch playgroup wishlists." });
  }
});

// POST /api/playgroups/:id/resync-decks - Resync all active decks for playgroup members
router.post("/:id/resync-decks", requireAuth, async (req, res) => {
  const playgroupId = req.params.id;
  try {
    // Verify membership
    const isMember = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!isMember) return res.status(403).json({ error: "Not a member of this playgroup" });

    // Fetch all members
    const members = await db("playgroup_members").where({ playgroup_id: playgroupId });
    const userIds = members.map(m => m.user_id);

    // Fetch all active decks for these members
    const activeDecks = await db("user_archidekt_decks")
      .whereIn("user_id", userIds)
      .andWhere("status", "active");

    let totalAdded = 0;
    let totalRemoved = 0;
    let totalIgnored = 0;
    let successCount = 0;

    for (const deck of activeDecks) {
      try {
        const result = await syncDeckInternal(deck.deck_id, deck.user_id, null);
        totalAdded += result.stats.added || 0;
        totalRemoved += result.stats.removed || 0;
        totalIgnored += result.stats.ignored || 0;
        successCount++;
      } catch (err) {
        console.error(`Failed to bulk sync deck ${deck.deck_id} for user ${deck.user_id}:`, err.message);
        // Continue with other decks
      }
    }

    res.json({
      success: true,
      message: `Successfully resynced ${successCount} out of ${activeDecks.length} active decks.`,
      stats: { added: totalAdded, removed: totalRemoved, ignored: totalIgnored }
    });

  } catch (err) {
    console.error("Error bulk resyncing playgroup decks:", err);
    res.status(500).json({ error: "Failed to resync playgroup decks." });
  }
});

// GET /api/playgroups/:id/orders - List proxy orders
router.get("/:id/orders", requireAuth, async (req, res) => {
  try {
    const orders = await db("proxy_orders")
      .where({ playgroup_id: req.params.id })
      .orderBy("created_at", "desc");
    res.json(orders);
  } catch (err) {
    console.error("Error fetching group orders:", err);
    res.status(500).json({ error: "Failed to fetch playgroup orders." });
  }
});

// POST /api/playgroups/:id/orders/mpcfill - Lock order and generate JSON
router.post("/:id/orders/mpcfill", requireAuth, async (req, res) => {
  const playgroupId = req.params.id;
  try {
    // Verify membership
    const isMember = await db("playgroup_members")
      .where({ playgroup_id: playgroupId, user_id: req.user.id })
      .first();
    if (!isMember) return res.status(403).json({ error: "Not a member of this playgroup" });

    // Fetch wishlist items — exclude opted-out members
    const items = await db("user_cards")
      .join("users", "user_cards.user_id", "users.id")
      .whereIn("user_cards.user_id", function() {
        this.select("user_id").from("playgroup_members")
          .where("playgroup_id", playgroupId)
          .where("opted_out_of_manifest", false);
      })
      .where("user_cards.list_type", "wishlist")
      .select(
        "user_cards.id",
        "user_cards.user_id",
        "user_cards.card_name",
        "user_cards.set_code",
        "user_cards.collector_number",
        "user_cards.is_foil",
        "user_cards.quantity",
        "user_cards.created_at",
        "users.username"
      )
      .orderBy("user_cards.created_at", "asc");


    // Flatten lists by quantity
    const flatQueue = [];
    items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        flatQueue.push({
          id: item.id,
          user_id: item.user_id,
          username: item.username,
          card_name: item.card_name,
          set_code: item.set_code,
          collector_number: item.collector_number,
          is_foil: item.is_foil,
          created_at: item.created_at
        });
      }
    });

    const targetCards = flatQueue.slice(0, 612);

    // Build standard MPCfill card layout
    const mpcCards = targetCards.map((card, index) => ({
      id: index + 1,
      name: card.card_name,
      set: card.set_code || "",
      collector_number: card.collector_number || "",
      foil: !!card.is_foil,
      owner: card.username,
      owner_id: card.user_id
    }));

    // Record order in db
    const [inserted] = await db("proxy_orders")
      .insert({
        playgroup_id: playgroupId,
        status: "locked"
      })
      .returning("*");

    const orderId = typeof inserted === "object" ? inserted.id : inserted;

    res.json({
      success: true,
      order_id: orderId,
      total_cards: targetCards.length,
      overflow_cards: flatQueue.length > 612 ? flatQueue.length - 612 : 0,
      cards: mpcCards
    });
  } catch (err) {
    console.error("Error creating MPCfill order:", err);
    res.status(500).json({ error: "Failed to create MPCfill order." });
  }
});

// POST /api/playgroups/:id/trade-fulfill - One-click trade fulfillment
router.post("/:id/trade-fulfill", requireAuth, async (req, res) => {
  const { card_name, owner_id, buyer_id } = req.body;
  if (!card_name || !owner_id || !buyer_id) {
    return res.status(400).json({ error: "Missing required trade details." });
  }

  try {
    await db.transaction(async (trx) => {
      // 1. Shift ownership of physical card from owner to buyer
      const ownerCard = await trx("user_cards")
        .where({ user_id: owner_id, card_name, list_type: "owned" })
        .first();

      if (!ownerCard || ownerCard.quantity <= 0) {
        throw new Error("Owner does not own this card in physical inventory.");
      }

      // Deduct from owner
      if (ownerCard.quantity === 1) {
        await trx("user_cards").where({ id: ownerCard.id }).delete();
      } else {
        await trx("user_cards")
          .where({ id: ownerCard.id })
          .update({ quantity: ownerCard.quantity - 1, updated_at: trx.fn.now() });
      }

      // Add/credit to buyer
      const buyerCard = await trx("user_cards")
        .where({ user_id: buyer_id, card_name, list_type: "owned" })
        .first();

      if (buyerCard) {
        await trx("user_cards")
          .where({ id: buyerCard.id })
          .update({ quantity: buyerCard.quantity + 1, updated_at: trx.fn.now() });
      } else {
        await trx("user_cards").insert({
          user_id: buyer_id,
          card_name,
          list_type: "owned",
          quantity: 1,
          set_code: ownerCard.set_code,
          collector_number: ownerCard.collector_number,
          is_foil: ownerCard.is_foil,
          market_price: ownerCard.market_price
        });
      }

      // 2. Strip it from buyer's wishlist
      const buyerWishlist = await trx("user_cards")
        .where({ user_id: buyer_id, card_name, list_type: "wishlist" })
        .first();

      if (buyerWishlist) {
        if (buyerWishlist.quantity <= 1) {
          await trx("user_cards").where({ id: buyerWishlist.id }).delete();
        } else {
          await trx("user_cards")
            .where({ id: buyerWishlist.id })
            .update({ quantity: buyerWishlist.quantity - 1, updated_at: trx.fn.now() });
        }
      }

      // 3. Strip from buyer's trade sandbox staged items
      await trx("user_cards")
        .where({ user_id: buyer_id, card_name, list_type: "trade_sandbox", target_owner_id: owner_id })
        .delete();
    });

    res.json({ success: true, message: "Physical trade completed, ownership shifted, and buyer wishlist updated!" });
  } catch (err) {
    console.error("Trade fulfillment error:", err);
    res.status(500).json({ error: err.message || "Failed to fulfill trade." });
  }
});

export default router;
