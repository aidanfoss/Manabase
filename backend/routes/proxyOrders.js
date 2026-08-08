// backend/routes/proxyOrders.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// POST /api/proxy-orders/confirm - Confirm an order (playgroup or personal)
router.post("/confirm", requireAuth, async (req, res) => {
  const { playgroup_id, cards: clientCards, unit_cost = 0.25, title: customTitle } = req.body;

  try {
    let orderItems = [];
    let playgroupName = null;
    let pgId = playgroup_id ? parseInt(playgroup_id) : null;

    if (pgId) {
      // Verify membership
      const membership = await db("playgroup_members")
        .where({ playgroup_id: pgId, user_id: req.user.id })
        .first();
      if (!membership) return res.status(403).json({ error: "Not a member of this playgroup" });

      const group = await db("playgroups").where({ id: pgId }).first();
      if (group) playgroupName = group.name;
    }

    if (Array.isArray(clientCards) && clientCards.length > 0) {
      orderItems = clientCards;
    } else if (pgId) {
      // Fetch active playgroup queue (first 612 cards) excluding opted-out members
      const items = await db("user_cards")
        .join("users", "user_cards.user_id", "users.id")
        .whereIn("user_cards.user_id", function () {
          this.select("user_id")
            .from("playgroup_members")
            .where("playgroup_id", pgId)
            .where("opted_out_of_manifest", false);
        })
        .whereIn("user_cards.list_type", ["wishlist", "optional_proxies"])
        .select(
          "user_cards.id",
          "user_cards.user_id",
          "user_cards.list_type",
          "user_cards.card_name",
          "user_cards.set_code",
          "user_cards.collector_number",
          "user_cards.is_foil",
          "user_cards.quantity",
          "user_cards.market_price",
          "users.username"
        )
        .orderBy("user_cards.list_type", "desc")
        .orderBy("user_cards.created_at", "asc");

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
            is_foil: !!item.is_foil,
            list_type: item.list_type,
            quantity: 1,
          });
        }
      });

      // Active manifest cap of 612 cards (overflow is excluded)
      orderItems = flatQueue.slice(0, 612);
    } else {
      // Fetch personal wishlist / optional proxies
      const items = await db("user_cards")
        .where({ user_id: req.user.id })
        .whereIn("list_type", ["wishlist", "optional_proxies"])
        .select("*");

      orderItems = items.map((i) => ({
        id: i.id,
        user_id: i.user_id,
        username: req.user.username,
        card_name: i.card_name,
        set_code: i.set_code,
        collector_number: i.collector_number,
        is_foil: !!i.is_foil,
        list_type: i.list_type,
        quantity: i.quantity || 1,
      }));
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ error: "No proxy cards found to confirm." });
    }

    // Calculate aggregated stats
    const totalCards = orderItems.reduce((s, c) => s + (c.quantity || 1), 0);
    const totalCost = Number((totalCards * (parseFloat(unit_cost) || 0.25)).toFixed(2));
    const nowStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const orderTitle = customTitle || (playgroupName ? `${playgroupName} Order - ${nowStr}` : `Personal Order - ${nowStr}`);

    // Begin database transaction to create order record and clear confirmed items
    const createdOrder = await db.transaction(async (trx) => {
      const [inserted] = await trx("proxy_orders")
        .insert({
          user_id: req.user.id,
          playgroup_id: pgId,
          title: orderTitle,
          status: "confirmed",
          total_cards: totalCards,
          total_cost: totalCost,
          cards: JSON.stringify(orderItems),
        })
        .returning("*");

      const orderId = typeof inserted === "object" ? inserted.id : inserted;

      // Group items by user_card id or criteria to safely decrement/remove
      const itemsById = {};
      const fallbackDeletions = [];

      orderItems.forEach((item) => {
        if (item.id) {
          itemsById[item.id] = (itemsById[item.id] || 0) + (item.quantity || 1);
        } else {
          fallbackDeletions.push(item);
        }
      });

      // Clear by user_cards table IDs
      for (const [cardId, countToRemove] of Object.entries(itemsById)) {
        const existing = await trx("user_cards").where({ id: cardId }).first();
        if (existing) {
          if (existing.quantity <= countToRemove) {
            await trx("user_cards").where({ id: cardId }).delete();
          } else {
            await trx("user_cards")
              .where({ id: cardId })
              .update({ quantity: existing.quantity - countToRemove, updated_at: trx.fn.now() });
          }
        }
      }

      // Clear fallback items if no direct ID
      for (const item of fallbackDeletions) {
        const existing = await trx("user_cards")
          .where({
            user_id: item.user_id || req.user.id,
            card_name: item.card_name,
          })
          .whereIn("list_type", ["wishlist", "optional_proxies"])
          .first();

        if (existing) {
          const qty = item.quantity || 1;
          if (existing.quantity <= qty) {
            await trx("user_cards").where({ id: existing.id }).delete();
          } else {
            await trx("user_cards")
              .where({ id: existing.id })
              .update({ quantity: existing.quantity - qty, updated_at: trx.fn.now() });
          }
        }
      }

      return {
        id: orderId,
        user_id: req.user.id,
        playgroup_id: pgId,
        title: orderTitle,
        status: "confirmed",
        total_cards: totalCards,
        total_cost: totalCost,
        cards: orderItems,
        created_at: new Date().toISOString(),
      };
    });

    res.json({ success: true, order: createdOrder });
  } catch (err) {
    console.error("Error confirming order:", err);
    res.status(500).json({ error: "Failed to confirm order." });
  }
});

// GET /api/proxy-orders/history - Fetch order history for user / active playgroup
router.get("/history", requireAuth, async (req, res) => {
  const { playgroup_id } = req.query;

  try {
    // Get all playgroups user is a member of
    const userGroups = await db("playgroup_members")
      .where({ user_id: req.user.id })
      .select("playgroup_id");

    const groupIds = userGroups.map((g) => g.playgroup_id);

    let query = db("proxy_orders")
      .leftJoin("users", "proxy_orders.user_id", "users.id")
      .leftJoin("playgroups", "proxy_orders.playgroup_id", "playgroups.id")
      .select(
        "proxy_orders.*",
        "users.username as creator_username",
        "playgroups.name as playgroup_name"
      );

    if (playgroup_id) {
      query = query.where("proxy_orders.playgroup_id", playgroup_id);
    } else {
      query = query.where(function () {
        this.where("proxy_orders.user_id", req.user.id);
        if (groupIds.length > 0) {
          this.orWhereIn("proxy_orders.playgroup_id", groupIds);
        }
      });
    }

    const orders = await query.orderBy("proxy_orders.created_at", "desc");

    const formatted = orders.map((o) => {
      let cardList = [];
      if (typeof o.cards === "string") {
        try {
          cardList = JSON.parse(o.cards);
        } catch (e) {
          cardList = [];
        }
      } else if (Array.isArray(o.cards)) {
        cardList = o.cards;
      }

      return {
        ...o,
        cards: cardList,
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching order history:", err);
    res.status(500).json({ error: "Failed to fetch order history." });
  }
});

// POST /api/proxy-orders/:id/restore - Re-add cards from order back to wishlist
router.post("/:id/restore", requireAuth, async (req, res) => {
  const orderId = req.params.id;

  try {
    const order = await db("proxy_orders").where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: "Order not found." });

    let cardList = [];
    if (typeof order.cards === "string") {
      try {
        cardList = JSON.parse(order.cards);
      } catch (e) {}
    } else if (Array.isArray(order.cards)) {
      cardList = order.cards;
    }

    if (cardList.length === 0) {
      return res.status(400).json({ error: "No card items found in this order to restore." });
    }

    await db.transaction(async (trx) => {
      for (const item of cardList) {
        const targetUserId = item.user_id || req.user.id;
        const qtyToAdd = item.quantity || 1;
        const setCode = item.set_code || "";
        const isFoil = !!item.is_foil;

        const existing = await trx("user_cards")
          .where({
            user_id: targetUserId,
            card_name: item.card_name,
            list_type: "wishlist",
            set_code: setCode,
            is_foil: isFoil,
          })
          .first();

        if (existing) {
          await trx("user_cards")
            .where({ id: existing.id })
            .update({
              quantity: existing.quantity + qtyToAdd,
              updated_at: trx.fn.now(),
            });
        } else {
          await trx("user_cards").insert({
            user_id: targetUserId,
            card_name: item.card_name,
            list_type: "wishlist",
            quantity: qtyToAdd,
            set_code: setCode,
            collector_number: item.collector_number || "",
            is_foil: isFoil,
            any_printing: item.any_printing !== undefined ? item.any_printing : true,
            market_price: item.market_price || 0.25,
          });
        }
      }
    });

    res.json({ success: true, message: `Successfully restored ${cardList.length} unique card entries to wishlist!` });
  } catch (err) {
    console.error("Error restoring order:", err);
    res.status(500).json({ error: "Failed to restore order." });
  }
});

// POST /api/proxy-orders/:id/move-to-tradelist - Move/add cards from order to tradelist
router.post("/:id/move-to-tradelist", requireAuth, async (req, res) => {
  const orderId = req.params.id;

  try {
    const order = await db("proxy_orders").where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: "Order not found." });

    let cardList = [];
    if (typeof order.cards === "string") {
      try {
        cardList = JSON.parse(order.cards);
      } catch (e) {}
    } else if (Array.isArray(order.cards)) {
      cardList = order.cards;
    }

    if (cardList.length === 0) {
      return res.status(400).json({ error: "No card items found in this order to move to tradelist." });
    }

    await db.transaction(async (trx) => {
      for (const item of cardList) {
        // Add to current logged-in user's tradelist
        const targetUserId = item.user_id || req.user.id;
        const qtyToAdd = item.quantity || 1;
        const setCode = item.set_code || "";
        const isFoil = !!item.is_foil;

        const existing = await trx("user_cards")
          .where({
            user_id: targetUserId,
            card_name: item.card_name,
            list_type: "tradelist",
            set_code: setCode,
            is_foil: isFoil,
          })
          .first();

        if (existing) {
          await trx("user_cards")
            .where({ id: existing.id })
            .update({
              quantity: existing.quantity + qtyToAdd,
              updated_at: trx.fn.now(),
            });
        } else {
          await trx("user_cards").insert({
            user_id: targetUserId,
            card_name: item.card_name,
            list_type: "tradelist",
            quantity: qtyToAdd,
            set_code: setCode,
            collector_number: item.collector_number || "",
            is_foil: isFoil,
            any_printing: true,
            market_price: item.market_price || 0.25,
          });
        }
      }
    });

    res.json({ success: true, message: `Successfully added ${cardList.length} card entries from order to tradelist!` });
  } catch (err) {
    console.error("Error moving order cards to tradelist:", err);
    res.status(500).json({ error: "Failed to move cards to tradelist." });
  }
});

export default router;
