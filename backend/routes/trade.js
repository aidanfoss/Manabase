// backend/routes/trade.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/trade/users - Get all other users in the playgroup
router.get("/users", requireAuth, async (req, res) => {
  try {
    const users = await db("users")
      .select("id", "username", "email")
      .whereNot({ id: req.user.id })
      .orderBy("username", "asc");
    res.json(users);
  } catch (err) {
    console.error("❌ Failed to fetch playgroup users:", err);
    res.status(500).json({ error: "Failed to fetch playgroup users" });
  }
});

// GET /api/trade/alerts - Get active trade requests count
router.get("/alerts", requireAuth, async (req, res) => {
  try {
    const countRes = await db("trades")
      .where(function() {
        this.where("receiver_id", req.user.id)
            .whereIn("status", ["proposed", "countered"]); // Pending their action
      })
      .orWhere(function() {
        this.where("sender_id", req.user.id)
            .where("status", "countered"); // Pending their action (if receiver countered, wait, if receiver countered, receiver is now the one waiting? Let's assume the last actor flips, but simpler: if status is proposed, receiver needs to act. If countered, the original sender needs to act)
      })
      .count("id as count")
      .first();
      
    // Actually, to make it simpler, let's track "last_actor_id". Since we don't have that, 
    // we'll say if status=proposed, receiver has alert. If status=countered, sender has alert.
    // Also if status=accepted, maybe both have alerts to "complete" it, but let's just count pending requests.
    const proposedToMe = await db("trades").where({ receiver_id: req.user.id, status: "proposed" }).count("id as count").first();
    const counteredToMe = await db("trades").where({ sender_id: req.user.id, status: "countered" }).count("id as count").first();
    
    const count = (parseInt(proposedToMe?.count) || 0) + (parseInt(counteredToMe?.count) || 0);

    res.json({ count });
  } catch (err) {
    console.error("❌ Failed to fetch trade alerts:", err);
    res.status(500).json({ error: "Failed to fetch trade alerts" });
  }
});

// GET /api/trade/active - Get all active trades for user
router.get("/active", requireAuth, async (req, res) => {
  try {
    const trades = await db("trades")
      .where("sender_id", req.user.id)
      .orWhere("receiver_id", req.user.id)
      .whereIn("status", ["proposed", "countered", "accepted"])
      .orderBy("updated_at", "desc");

    // Fetch items for each trade
    const tradeIds = trades.map(t => t.id);
    let items = [];
    if (tradeIds.length > 0) {
      items = await db("trade_items").whereIn("trade_id", tradeIds);
    }
    
    const users = await db("users").select("id", "username");
    const userMap = {};
    users.forEach(u => userMap[u.id] = u.username);

    const result = trades.map(t => {
      const tItems = items.filter(i => i.trade_id === t.id);
      return {
        ...t,
        partner_id: t.sender_id === req.user.id ? t.receiver_id : t.sender_id,
        partner_username: t.sender_id === req.user.id ? userMap[t.receiver_id] : userMap[t.sender_id],
        offer: tItems.filter(i => i.user_id === req.user.id),
        demand: tItems.filter(i => i.user_id !== req.user.id)
      };
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Failed to fetch active trades:", err);
    res.status(500).json({ error: "Failed to fetch active trades" });
  }
});


// GET /api/trade/matches - Get current user's wishlist cards owned by others
router.get("/matches", requireAuth, async (req, res) => {
  try {
    // 1. Get current user's wishlist
    const myWishlist = await db("user_cards")
      .where({ user_id: req.user.id, list_type: "wishlist" });

    if (myWishlist.length === 0) {
      return res.json([]);
    }

    // Adjust for accepted trades (pause cards)
    const acceptedTrades = await db("trades")
      .where("status", "accepted")
      .where(function() {
        this.where("sender_id", req.user.id).orWhere("receiver_id", req.user.id);
      });
    const acceptedTradeIds = acceptedTrades.map(t => t.id);

    let incomingQuantities = {};
    if (acceptedTradeIds.length > 0) {
      const items = await db("trade_items").whereIn("trade_id", acceptedTradeIds).whereNot("user_id", req.user.id);
      for (const item of items) {
        incomingQuantities[item.card_name] = (incomingQuantities[item.card_name] || 0) + item.quantity;
      }
    }

    const adjustedWishlist = [];
    for (const item of myWishlist) {
      const incoming = incomingQuantities[item.card_name] || 0;
      const newQty = item.quantity - incoming;
      if (newQty > 0) {
        adjustedWishlist.push({ ...item, quantity: newQty });
      }
    }

    if (adjustedWishlist.length === 0) {
      return res.json([]);
    }

    const wishlistNames = adjustedWishlist.map(c => c.card_name);

    // 2. Find other users who have these cards in their tradelist or owned collection
    const matches = await db("user_cards")
      .join("users", "user_cards.user_id", "users.id")
      .whereIn("user_cards.card_name", wishlistNames)
      .whereNot("user_cards.user_id", req.user.id)
      .whereIn("user_cards.list_type", ["tradelist", "owned"])
      .select(
        "user_cards.id",
        "user_cards.user_id",
        "user_cards.card_name",
        "user_cards.list_type",
        "user_cards.quantity",
        "user_cards.set_code",
        "user_cards.collector_number",
        "user_cards.is_foil",
        "users.username"
      )
      .orderBy("user_cards.card_name", "asc");

    // Exclude cards the peers are already giving away in accepted trades
    let outgoingQuantities = {};
    if (acceptedTradeIds.length > 0) {
       const outgoingItems = await db("trade_items").whereIn("trade_id", acceptedTradeIds);
       for (const item of outgoingItems) {
         if (!outgoingQuantities[item.user_id]) outgoingQuantities[item.user_id] = {};
         outgoingQuantities[item.user_id][item.card_name] = (outgoingQuantities[item.user_id][item.card_name] || 0) + item.quantity;
       }
    }

    // Group matches by card name for easy UI rendering
    const groupedMatches = {};
    for (const match of matches) {
      const peerOutgoing = outgoingQuantities[match.user_id]?.[match.card_name] || 0;
      const availableQty = match.quantity - peerOutgoing;
      
      if (availableQty <= 0) continue; // Peer has committed all these cards

      const name = match.card_name;
      if (!groupedMatches[name]) {
        groupedMatches[name] = [];
      }
      groupedMatches[name].push({
        user_id: match.user_id,
        username: match.username,
        list_type: match.list_type,
        quantity: availableQty,
        set_code: match.set_code,
        collector_number: match.collector_number,
        is_foil: !!match.is_foil,
      });
    }

    // Convert to a nice format
    const result = adjustedWishlist.map(c => ({
      wishlist_item: c,
      owners: groupedMatches[c.card_name] || []
    }));

    res.json(result);
  } catch (err) {
    console.error("❌ Failed to fetch trade matches:", err);
    res.status(500).json({ error: "Failed to fetch trade matches" });
  }
});

// GET /api/trade/inventory/:userId - Get trade-partner's tradelist and wishlist
router.get("/inventory/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const cards = await db("user_cards")
      .where({ user_id: userId })
      .whereIn("list_type", ["tradelist", "wishlist"])
      .orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error("❌ Failed to fetch user inventory:", err);
    res.status(500).json({ error: "Failed to fetch user inventory" });
  }
});

// POST /api/trade/propose - Propose a new trade
router.post("/propose", requireAuth, async (req, res) => {
  const { partnerId, offer, demand } = req.body;

  if (!partnerId) return res.status(400).json({ error: "Partner ID is required" });
  if (!offer && !demand) return res.status(400).json({ error: "Offer or demand is required" });

  try {
    await db.transaction(async (trx) => {
      const [tradeId] = await trx("trades").insert({
        sender_id: req.user.id,
        receiver_id: partnerId,
        status: "proposed"
      }).returning("id");

      const tid = tradeId.id || tradeId;

      const itemsToInsert = [];
      if (offer) {
        offer.forEach(item => {
          itemsToInsert.push({
            trade_id: tid,
            user_id: req.user.id, // I am giving this
            card_name: item.card_name,
            quantity: item.quantity || 1,
            set_code: item.set_code || "",
            is_foil: !!item.is_foil
          });
        });
      }

      if (demand) {
        demand.forEach(item => {
          itemsToInsert.push({
            trade_id: tid,
            user_id: partnerId, // Partner is giving this
            card_name: item.card_name,
            quantity: item.quantity || 1,
            set_code: item.set_code || "",
            is_foil: !!item.is_foil
          });
        });
      }

      if (itemsToInsert.length > 0) {
        await trx("trade_items").insert(itemsToInsert);
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Failed to propose trade:", err);
    res.status(500).json({ error: "Failed to propose trade" });
  }
});


// POST /api/trade/:id/action - Perform action on a trade
router.post("/:id/action", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { action, offer, demand } = req.body; // action: 'accept', 'decline', 'counter', 'complete'

  try {
    const trade = await db("trades").where({ id }).first();
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    // Validate authorization
    if (trade.sender_id !== req.user.id && trade.receiver_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    if (action === "decline") {
      await db("trades").where({ id }).update({ status: "declined", updated_at: db.fn.now() });
      return res.json({ success: true });
    }

    if (action === "accept") {
      await db("trades").where({ id }).update({ status: "accepted", updated_at: db.fn.now() });
      return res.json({ success: true });
    }

    if (action === "counter") {
      await db.transaction(async (trx) => {
        // Switch sender/receiver roles effectively by status tracking.
        // Actually, let's keep sender_id/receiver_id the same, but status='countered'
        // If current user is receiver, and they counter, status -> countered.
        // If current user is sender, and they counter a counter, status -> proposed.
        const newStatus = trade.sender_id === req.user.id ? "proposed" : "countered";
        
        await trx("trades").where({ id }).update({ status: newStatus, updated_at: trx.fn.now() });
        await trx("trade_items").where({ trade_id: id }).delete();

        const partnerId = trade.sender_id === req.user.id ? trade.receiver_id : trade.sender_id;

        const itemsToInsert = [];
        if (offer) {
          offer.forEach(item => {
            itemsToInsert.push({
              trade_id: id,
              user_id: req.user.id,
              card_name: item.card_name,
              quantity: item.quantity || 1,
              set_code: item.set_code || "",
              is_foil: !!item.is_foil
            });
          });
        }
        if (demand) {
          demand.forEach(item => {
            itemsToInsert.push({
              trade_id: id,
              user_id: partnerId,
              card_name: item.card_name,
              quantity: item.quantity || 1,
              set_code: item.set_code || "",
              is_foil: !!item.is_foil
            });
          });
        }

        if (itemsToInsert.length > 0) {
          await trx("trade_items").insert(itemsToInsert);
        }
      });
      return res.json({ success: true });
    }

    if (action === "complete") {
      if (trade.status !== "accepted") {
        return res.status(400).json({ error: "Trade must be accepted before completion" });
      }

      await db.transaction(async (trx) => {
        const items = await trx("trade_items").where({ trade_id: id });
        
        for (const item of items) {
          const giverId = item.user_id;
          const receiverId = giverId === trade.sender_id ? trade.receiver_id : trade.sender_id;
          const qty = item.quantity;

          // Decrement giver's tradelist
          const giverTrade = await trx("user_cards")
            .where({ user_id: giverId, card_name: item.card_name, list_type: "tradelist" })
            .first();
          if (giverTrade) {
            const newQty = Math.max(0, giverTrade.quantity - qty);
            if (newQty <= 0) await trx("user_cards").where({ id: giverTrade.id }).delete();
            else await trx("user_cards").where({ id: giverTrade.id }).update({ quantity: newQty, updated_at: trx.fn.now() });
          }

          // Decrement giver's owned list
          const giverOwned = await trx("user_cards")
            .where({ user_id: giverId, card_name: item.card_name, list_type: "owned" })
            .first();
          if (giverOwned) {
            const newQty = Math.max(0, giverOwned.quantity - qty);
            if (newQty <= 0) await trx("user_cards").where({ id: giverOwned.id }).delete();
            else await trx("user_cards").where({ id: giverOwned.id }).update({ quantity: newQty, updated_at: trx.fn.now() });
          }

          // Add/Increment receiver's owned collection
          const receiverOwned = await trx("user_cards")
            .where({ user_id: receiverId, card_name: item.card_name, list_type: "owned" })
            .first();
          if (receiverOwned) {
            await trx("user_cards").where({ id: receiverOwned.id }).update({ quantity: receiverOwned.quantity + qty, updated_at: trx.fn.now() });
          } else {
            await trx("user_cards").insert({
              user_id: receiverId,
              card_name: item.card_name,
              list_type: "owned",
              quantity: qty,
              set_code: item.set_code || "",
              is_foil: !!item.is_foil
            });
          }

          // If receiver had it in wishlist, decrement/remove it
          const receiverWish = await trx("user_cards")
            .where({ user_id: receiverId, card_name: item.card_name, list_type: "wishlist" })
            .first();
          if (receiverWish) {
            const newQty = Math.max(0, receiverWish.quantity - qty);
            if (newQty <= 0) await trx("user_cards").where({ id: receiverWish.id }).delete();
            else await trx("user_cards").where({ id: receiverWish.id }).update({ quantity: newQty, updated_at: trx.fn.now() });
          }
        }

        await trx("trades").where({ id }).update({ status: "completed", updated_at: trx.fn.now() });
      });

      return res.json({ success: true, message: "Trade completed!" });
    }

    res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error("❌ Failed to process trade action:", err);
    res.status(500).json({ error: "Failed to process trade action" });
  }
});

// (Deprecated) POST /api/trade/execute - Execute a card swap transaction (kept for backwards compatibility for now)
router.post("/execute", requireAuth, async (req, res) => {
  return res.status(400).json({ error: "Please use the new propose/accept trade flow." });
});

export default router;
