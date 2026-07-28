// backend/routes/trade.js
import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";
import { fetchBatchPricesFromScryfall } from "../services/scryfall.js";

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
    console.error(" Failed to fetch playgroup users:", err);
    res.status(500).json({ error: "Failed to fetch playgroup users" });
  }
});

// GET /api/trade/pending-count - Get active trade requests count
router.get("/pending-count", requireAuth, async (req, res) => {
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
    console.error(" Failed to fetch trade alerts:", err);
    res.status(500).json({ error: "Failed to fetch trade alerts" });
  }
});

// GET /api/trade/active - Get all active trades for user
router.get("/active", requireAuth, async (req, res) => {
  try {
    const trades = await db("trades")
      .where(function() {
        this.where("sender_id", req.user.id).orWhere("receiver_id", req.user.id);
      })
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

    const userCards = await db("user_cards").select("card_name", "market_price");
    const priceMap = {};
    userCards.forEach(uc => {
      if (uc.market_price && uc.market_price > 0) {
        priceMap[uc.card_name.toLowerCase()] = uc.market_price;
      }
    });

    const result = trades.map(t => {
      const tItems = items.filter(i => i.trade_id === t.id);
      const isSender = t.sender_id === req.user.id;
      const partnerId = isSender ? t.receiver_id : t.sender_id;
      const partnerUsername = userMap[partnerId] || "Unknown";

      const decoratedItems = tItems.map(item => ({
        ...item,
        market_price: (item.price && parseFloat(item.price) > 0)
          ? parseFloat(item.price)
          : (priceMap[item.card_name.toLowerCase()] || 0)
      }));

      const offer = decoratedItems.filter(i => i.user_id === req.user.id);
      const demand = decoratedItems.filter(i => i.user_id !== req.user.id);

      let isOutbound = false;
      if (t.status === "proposed") {
        isOutbound = isSender;
      } else if (t.status === "countered") {
        isOutbound = !isSender;
      }

      return {
        ...t,
        is_sender: isSender,
        is_outbound: isOutbound,
        partner_id: partnerId,
        partner_username: partnerUsername,
        sender_username: userMap[t.sender_id] || "Unknown",
        receiver_username: userMap[t.receiver_id] || "Unknown",
        items: decoratedItems,
        offer,
        demand
      };
    });

    res.json(result);
  } catch (err) {
    console.error(" Failed to fetch active trades:", err);
    res.status(500).json({ error: "Failed to fetch active trades" });
  }
});

// GET /api/trade/history - Get all trade history for user
router.get("/history", requireAuth, async (req, res) => {
  try {
    const trades = await db("trades")
      .where("sender_id", req.user.id)
      .orWhere("receiver_id", req.user.id)
      .orderBy("updated_at", "desc");

    const tradeIds = trades.map(t => t.id);
    let items = [];
    if (tradeIds.length > 0) {
      items = await db("trade_items").whereIn("trade_id", tradeIds);
    }

    const users = await db("users").select("id", "username", "email");
    const userMap = {};
    users.forEach(u => userMap[u.id] = u.username);

    const result = trades.map(t => {
      const tItems = items.filter(i => i.trade_id === t.id);
      const isSender = t.sender_id === req.user.id;
      const partnerId = isSender ? t.receiver_id : t.sender_id;
      const partnerUsername = userMap[partnerId] || "Unknown";

      const senderItems = tItems.filter(i => i.user_id === t.sender_id);
      const receiverItems = tItems.filter(i => i.user_id === t.receiver_id);

      const offer = isSender ? senderItems : receiverItems;
      const demand = isSender ? receiverItems : senderItems;

      return {
        ...t,
        is_sender: isSender,
        partner_id: partnerId,
        partner_username: partnerUsername,
        sender_username: userMap[t.sender_id] || "Unknown",
        receiver_username: userMap[t.receiver_id] || "Unknown",
        items: tItems,
        offer,
        demand
      };
    });

    res.json(result);
  } catch (err) {
    console.error(" Failed to fetch trade history:", err);
    res.status(500).json({ error: "Failed to fetch trade history" });
  }
});

// GET /api/trade/ledger - Get per-user debt/credit ledger
router.get("/ledger", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const users = await db("users").whereNot("id", me).select("id", "username", "email");

    const trades = await db("trades")
      .where(function() {
        this.where("sender_id", me).orWhere("receiver_id", me);
      })
      .whereIn("status", ["completed", "accepted"])
      .orderBy("updated_at", "desc");

    const tradeIds = trades.map(t => t.id);
    let items = [];
    if (tradeIds.length > 0) {
      items = await db("trade_items").whereIn("trade_id", tradeIds);
    }

    const ledgerMap = {};
    users.forEach(u => {
      ledgerMap[u.id] = {
        partner_id: u.id,
        partner_username: u.username,
        partner_email: u.email,
        total_given_value: 0,
        total_received_value: 0,
        net_balance: 0,
        completed_trades_count: 0,
        accepted_trades_count: 0,
        trades: []
      };
    });

    const userCards = await db("user_cards").select("card_name", "market_price");
    const priceMap = {};
    userCards.forEach(uc => {
      if (uc.market_price && uc.market_price > 0) {
        priceMap[uc.card_name.toLowerCase()] = uc.market_price;
      }
    });

    trades.forEach(t => {
      const isSender = t.sender_id === me;
      const partnerId = isSender ? t.receiver_id : t.sender_id;

      if (!ledgerMap[partnerId]) {
        ledgerMap[partnerId] = {
          partner_id: partnerId,
          partner_username: "User",
          partner_email: "",
          total_given_value: 0,
          total_received_value: 0,
          net_balance: 0,
          completed_trades_count: 0,
          accepted_trades_count: 0,
          trades: []
        };
      }

      if (t.status === "completed") ledgerMap[partnerId].completed_trades_count++;
      if (t.status === "accepted") ledgerMap[partnerId].accepted_trades_count++;

      const tItems = items.filter(i => i.trade_id === t.id);

      let tradeGivenVal = 0;
      let tradeReceivedVal = 0;

      tItems.forEach(item => {
        const itemPrice = (item.price && parseFloat(item.price) > 0) ? parseFloat(item.price) : (priceMap[item.card_name.toLowerCase()] || 0);
        const itemTotal = itemPrice * (item.quantity || 1);
        if (item.user_id === me) {
          tradeGivenVal += itemTotal;
        } else {
          tradeReceivedVal += itemTotal;
        }
      });

      ledgerMap[partnerId].total_given_value += tradeGivenVal;
      ledgerMap[partnerId].total_received_value += tradeReceivedVal;
      ledgerMap[partnerId].trades.push({
        id: t.id,
        status: t.status,
        updated_at: t.updated_at,
        given_value: tradeGivenVal,
        received_value: tradeReceivedVal,
        net_delta: tradeGivenVal - tradeReceivedVal
      });
    });

    const ledger = Object.values(ledgerMap).map(l => {
      const net = l.total_given_value - l.total_received_value;
      return {
        ...l,
        net_balance: net,
        status_text: net > 0 
          ? `${l.partner_username} owes you in cards` 
          : net < 0 
            ? `You owe ${l.partner_username} in cards` 
            : `Even ($0.00)`
      };
    });

    res.json(ledger);
  } catch (err) {
    console.error(" Failed to fetch trade ledger:", err);
    res.status(500).json({ error: "Failed to fetch trade ledger" });
  }
});

// GET /api/trade/matches - Get user-centric trade matches for matchmaker
router.get("/matches", requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    
    // 1. Fetch my wishlist, tradelist (cards I want to trade for), and owned collection cards
    const myCards = await db("user_cards")
      .where("user_id", me)
      .whereIn("list_type", ["wishlist", "tradelist", "owned", "proxy"]);
      
    const myWants = myCards.filter(c => c.list_type === "wishlist" || c.list_type === "tradelist");
    const myCollection = myCards.filter(c => c.list_type === "owned" || c.list_type === "proxy");

    // 2. Fetch peers
    const peers = await db("users").whereNot("id", me).select("id", "username", "email");

    // 3. Fetch peer cards (wishlist, tradelist, and owned collection)
    const peerCards = await db("user_cards")
      .whereNot("user_id", me)
      .whereIn("list_type", ["wishlist", "tradelist", "owned", "proxy"]);

    // 4. Adjust quantities for accepted trades
    const committedItems = await db("trade_items")
      .join("trades", "trade_items.trade_id", "trades.id")
      .where("trades.status", "accepted")
      .select("trade_items.user_id", "trade_items.card_name", "trade_items.quantity");

    const committed = {};
    for (const item of committedItems) {
      if (!committed[item.user_id]) committed[item.user_id] = {};
      committed[item.user_id][item.card_name] = (committed[item.user_id][item.card_name] || 0) + item.quantity;
    }

    const getAvailableQty = (userId, cardName, totalQty) => {
      const used = committed[userId]?.[cardName] || 0;
      return Math.max(0, totalQty - used);
    };

    const myWantsAdjusted = myWants.map(c => ({...c, quantity: getAvailableQty(me, c.card_name, c.quantity)}));
    const myCollectionAdjusted = myCollection.map(c => ({...c, quantity: getAvailableQty(me, c.card_name, c.quantity)}));
    
    const result = [];

    for (const peer of peers) {
      const pCards = peerCards.filter(c => c.user_id === peer.id);
      const youWant = [];
      const theyWant = [];
      
      const seenYouWantKeys = new Set();
      // Peer's collection cards (owned, proxy) that match my wants (wishlist or tradelist)
      for (const pCard of pCards) {
        if (pCard.list_type !== "owned" && pCard.list_type !== "tradelist" && pCard.list_type !== "proxy") continue;

        const availQty = getAvailableQty(peer.id, pCard.card_name, pCard.quantity);
        if (availQty <= 0) continue;
        
        const myMatches = myWantsAdjusted.filter(c => c.card_name.toLowerCase() === pCard.card_name.toLowerCase() && c.quantity > 0);
        const validMatches = myMatches.filter(w => {
          if (pCard.list_type === "proxy" && w.list_type === "tradelist") return false;
          if (pCard.list_type === "proxy" && w.list_type !== "wishlist") return false;
          return true;
        });
        const hasMatch = validMatches.some(w => w.any_printing || (w.set_code && pCard.set_code && w.set_code.toUpperCase() === pCard.set_code.toUpperCase()));
        if (hasMatch) {
          const key = `${pCard.card_name.toLowerCase()}_${(pCard.set_code || "").toUpperCase()}_${!!pCard.is_foil}`;
          if (!seenYouWantKeys.has(key)) {
            seenYouWantKeys.add(key);
            youWant.push({...pCard, quantity: availQty});
          }
        }
      }
      
      const seenTheyWantKeys = new Set();
      // My collection cards (owned, proxy) that match peer's wants (wishlist, tradelist)
      for (const mCard of myCollectionAdjusted) {
        if (mCard.quantity <= 0) continue;
        const key = `${mCard.card_name.toLowerCase()}_${(mCard.set_code || "").toUpperCase()}_${!!mCard.is_foil}`;
        if (seenTheyWantKeys.has(key)) continue;

        const peerWants = pCards.find(c => {
          if (c.list_type !== "wishlist" && c.list_type !== "tradelist") return false;
          if (c.card_name.toLowerCase() !== mCard.card_name.toLowerCase()) return false;
          if (mCard.list_type === "proxy" && c.list_type === "tradelist") return false;
          if (mCard.list_type === "proxy" && c.list_type !== "wishlist") return false;
          if (c.any_printing === false && c.set_code && mCard.set_code && c.set_code.toUpperCase() !== mCard.set_code.toUpperCase()) return false;
          return true;
        });
        if (peerWants) {
          const peerAvail = getAvailableQty(peer.id, peerWants.card_name, peerWants.quantity);
          if (peerAvail > 0) {
            seenTheyWantKeys.add(key);
            theyWant.push(mCard);
          }
        }
      }
      
      if (youWant.length > 0 || theyWant.length > 0) {
        result.push({
          user: peer,
          youWant,
          theyWant
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error(" Failed to fetch trade matches:", err);
    res.status(500).json({ error: "Failed to fetch trade matches" });
  }
});

// GET /api/trade/inventory/:userId - Get trade-partner's collection (owned & tradelist) and wishlist
router.get("/inventory/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const cards = await db("user_cards")
      .where({ user_id: userId })
      .whereIn("list_type", ["owned", "tradelist", "wishlist"])
      .orderBy("card_name", "asc");
    res.json(cards);
  } catch (err) {
    console.error(" Failed to fetch user inventory:", err);
    res.status(500).json({ error: "Failed to fetch user inventory" });
  }
});

// POST /api/trade/propose - Propose a new trade
router.post("/propose", requireAuth, async (req, res) => {
  const { partnerId, offer, demand } = req.body;

  if (!partnerId) return res.status(400).json({ error: "Partner ID is required" });
  if ((!offer || offer.length === 0) && (!demand || demand.length === 0)) {
    return res.status(400).json({ error: "Offer or demand is required" });
  }

  try {
    const rawOffer = (offer || []).map(i => ({ ...i, user_id: req.user.id }));
    const rawDemand = (demand || []).map(i => ({ ...i, user_id: partnerId }));
    const allRawItems = [...rawOffer, ...rawDemand];

    // Batch price check to Scryfall API for each card involved
    const pricedItems = await fetchBatchPricesFromScryfall(allRawItems);

    await db.transaction(async (trx) => {
      const [tradeId] = await trx("trades").insert({
        sender_id: req.user.id,
        receiver_id: partnerId,
        status: "proposed"
      }).returning("id");

      const tid = tradeId.id || tradeId;

      const itemsToInsert = pricedItems.map(item => ({
        trade_id: tid,
        user_id: item.user_id,
        card_name: item.card_name || item.name,
        quantity: item.quantity || 1,
        set_code: item.set_code || "",
        collector_number: item.collector_number || "",
        is_foil: !!item.is_foil,
        price: item.price || 0
      }));

      if (itemsToInsert.length > 0) {
        await trx("trade_items").insert(itemsToInsert);

        // Update user_cards table with fresh Scryfall prices
        for (const item of itemsToInsert) {
          if (item.price > 0) {
            await trx("user_cards")
              .where({ card_name: item.card_name })
              .update({ market_price: item.price, updated_at: trx.fn.now() });
          }
        }
      }
    });
    res.json({ success: true });
  } catch (err) {
    console.error(" Failed to propose trade:", err);
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
        const newStatus = trade.sender_id === req.user.id ? "proposed" : "countered";
        const partnerId = trade.sender_id === req.user.id ? trade.receiver_id : trade.sender_id;

        const rawOffer = (offer || []).map(i => ({ ...i, user_id: req.user.id }));
        const rawDemand = (demand || []).map(i => ({ ...i, user_id: partnerId }));
        const allRawItems = [...rawOffer, ...rawDemand];

        // Batch price check to Scryfall API for each card involved
        const pricedItems = await fetchBatchPricesFromScryfall(allRawItems);

        await trx("trades").where({ id }).update({ status: newStatus, updated_at: trx.fn.now() });
        await trx("trade_items").where({ trade_id: id }).delete();

        const itemsToInsert = pricedItems.map(item => ({
          trade_id: id,
          user_id: item.user_id,
          card_name: item.card_name || item.name,
          quantity: item.quantity || 1,
          set_code: item.set_code || "",
          collector_number: item.collector_number || "",
          is_foil: !!item.is_foil,
          price: item.price || 0
        }));

        if (itemsToInsert.length > 0) {
          await trx("trade_items").insert(itemsToInsert);

          // Update user_cards table with fresh Scryfall prices
          for (const item of itemsToInsert) {
            if (item.price > 0) {
              await trx("user_cards")
                .where({ card_name: item.card_name })
                .update({ market_price: item.price, updated_at: trx.fn.now() });
            }
          }
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

          // If receiver had it in wishlist or tradelist (cards wanted), decrement/remove it
          const receiverWish = await trx("user_cards")
            .where({ user_id: receiverId, card_name: item.card_name })
            .whereIn("list_type", ["wishlist", "tradelist"])
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
    console.error(" Failed to process trade action:", err);
    res.status(500).json({ error: "Failed to process trade action" });
  }
});

// (Deprecated) POST /api/trade/execute - Execute a card swap transaction (kept for backwards compatibility for now)
router.post("/execute", requireAuth, async (req, res) => {
  return res.status(400).json({ error: "Please use the new propose/accept trade flow." });
});

export default router;
