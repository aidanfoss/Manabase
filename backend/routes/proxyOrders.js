// backend/routes/proxyOrders.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { recordFeatureUsage } from "../services/analyticsService.js";

const router = express.Router();

// GET /api/proxy-orders/friends-queue - Fetch combined proxy queue of user + authorized friends
router.get("/friends-queue", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;

    // Blocked users
    const blockedRows = await db("blocked_users")
      .where("user_id", me)
      .orWhere("blocked_id", me)
      .select("user_id", "blocked_id");
    const blockedIds = new Set();
    blockedRows.forEach(r => {
      blockedIds.add(r.user_id === me ? r.blocked_id : r.user_id);
    });

    // Friends who granted allow_proxy_orders = true to me
    // friends table: user_id is the granter (friend), friend_id is the grantee (me)
    const allowedFriends = await db("friends as f")
      .join("users as u", "f.user_id", "u.id")
      .where("f.friend_id", me)
      .where("f.allow_proxy_orders", true)
      .select("u.id", "u.username", "u.avatar_url");

    const validFriends = allowedFriends.filter(f => !blockedIds.has(f.id));
    const allowedUserIds = [me, ...validFriends.map(f => f.id)];

    const cards = await db("user_cards")
      .join("users", "user_cards.user_id", "users.id")
      .whereIn("user_cards.user_id", allowedUserIds)
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

    const proxyArts = await db("user_proxy_arts").whereIn("user_id", allowedUserIds);
    const artsMap = new Map();
    proxyArts.forEach((a) => {
      artsMap.set(`${a.user_id}:${a.card_name.toLowerCase()}`, a);
    });

    const enrichedCards = cards.map((c) => {
      const art = artsMap.get(`${c.user_id}:${c.card_name.toLowerCase()}`);
      return {
        ...c,
        mpcfill_id: art?.mpcfill_id || null,
        mpcfill_name: art?.mpcfill_name || null,
        mpcfill_query: art?.mpcfill_query || null,
      };
    });

    res.json({
      friends: validFriends,
      cards: enrichedCards,
    });
  } catch (err) {
    console.error("Error fetching friends proxy queue:", err);
    res.status(500).json({ error: "Failed to fetch proxy queue." });
  }
});

// POST /api/proxy-orders/confirm - Confirm a proxy order
router.post("/confirm", requireAuth, async (req, res) => {
  const { cards: clientCards, unit_cost = 0.25, title: customTitle, include_friends = true } = req.body;
  const me = req.user.id;

  try {
    let orderItems = [];

    if (Array.isArray(clientCards) && clientCards.length > 0) {
      // Validate that any card for another user is authorized
      const otherUserIds = [...new Set(clientCards.map(c => c.user_id).filter(id => id && id !== me))];
      if (otherUserIds.length > 0) {
        // Verify allow_proxy_orders = true
        const authorizations = await db("friends")
          .whereIn("user_id", otherUserIds)
          .where("friend_id", me)
          .where("allow_proxy_orders", true);
        const authorizedSet = new Set(authorizations.map(a => a.user_id));

        const unauthorized = otherUserIds.filter(id => !authorizedSet.has(id));
        if (unauthorized.length > 0) {
          return res.status(403).json({ error: "One or more users have not authorized proxy orders." });
        }
      }
      orderItems = clientCards;
    } else {
      let allowedUserIds = [me];
      if (include_friends) {
        const allowedFriends = await db("friends as f")
          .where("f.friend_id", me)
          .where("f.allow_proxy_orders", true)
          .select("f.user_id");
        allowedUserIds = [me, ...allowedFriends.map(f => f.user_id)];
      }

      const items = await db("user_cards")
        .join("users", "user_cards.user_id", "users.id")
        .whereIn("user_cards.user_id", allowedUserIds)
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
        for (let i = 0; i < (item.quantity || 1); i++) {
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

      // Active manifest cap of 612 cards (MPC standard sheet max)
      orderItems = flatQueue.slice(0, 612);
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ error: "No proxy cards found to confirm." });
    }

    // Calculate aggregated stats
    const totalCards = orderItems.reduce((s, c) => s + (c.quantity || 1), 0);
    const totalCost = Number((totalCards * (parseFloat(unit_cost) || 0.25)).toFixed(2));
    const nowStr = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const orderTitle = customTitle || `Proxy Order - ${nowStr}`;

    // Begin database transaction to create order record and clear confirmed items
    const createdOrder = await db.transaction(async (trx) => {
      const [inserted] = await trx("proxy_orders")
        .insert({
          user_id: me,
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
            user_id: item.user_id || me,
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
        user_id: me,
        title: orderTitle,
        status: "confirmed",
        total_cards: totalCards,
        total_cost: totalCost,
        cards: orderItems,
        created_at: new Date().toISOString(),
      };
    });

    recordFeatureUsage(req.user.id, "proxy_orders", "confirm_order", {
      orderId: createdOrder.id,
      totalCards: createdOrder.total_cards,
      totalCost: createdOrder.total_cost
    }).catch(() => {});

    res.json({ success: true, order: createdOrder });
  } catch (err) {
    console.error("Error confirming order:", err);
    res.status(500).json({ error: "Failed to confirm order." });
  }
});

// GET /api/proxy-orders/history - Fetch order history for user
router.get("/history", requireAuth, async (req, res) => {
  try {
    const orders = await db("proxy_orders")
      .leftJoin("users", "proxy_orders.user_id", "users.id")
      .where("proxy_orders.user_id", req.user.id)
      .select(
        "proxy_orders.*",
        "users.username as creator_username"
      )
      .orderBy("proxy_orders.created_at", "desc");

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
