import express from "express";
import { db } from "../db/connection.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

import { getLocalCardsBatch } from "./scryfallLocal.js";

const CONDITION_MULTIPLIERS = {
  "NM": 1.0,
  "LP": 0.85,
  "MP": 0.70,
  "HP": 0.50,
  "PO": 0.30
};

const getRowPrice = (card, cachedPrints) => {
  if (card.is_proxy) return 0;
  if (!cachedPrints || cachedPrints.missing || !cachedPrints.prints || cachedPrints.prints.length === 0) return 0;

  const setPrints = cachedPrints.prints.filter(p => p.set?.toUpperCase() === (card.set_code || "").toUpperCase());
  const activePrint = setPrints.length > 0 ? (
    setPrints.find(p => card.collector_number ? p.collector_number === card.collector_number : true) || setPrints[0]
  ) : cachedPrints.prints[0];

  if (!activePrint || !activePrint.prices) return 0;

  const basePriceStr = card.is_foil ? activePrint.prices.usd_foil : activePrint.prices.usd;
  const basePrice = parseFloat(basePriceStr) || 0;
  const mult = CONDITION_MULTIPLIERS[card.card_condition || "NM"] || 1.0;

  return basePrice * mult;
};

const isCardUnresolved = (card, cachedPrints) => {
  if (!cachedPrints) return false;
  return cachedPrints.missing === true || !cachedPrints.prints || cachedPrints.prints.length === 0;
};

// GET /api/collection/owned
router.get("/", requireAuth, async (req, res) => {
  try {
    const listType = req.query.list_type || "owned";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const sortField = req.query.sortField || "card_name";
    const sortOrder = req.query.sortOrder || "asc";
    
    const filterName = (req.query.filterName || "").trim().toLowerCase();
    const filterSet = (req.query.filterSet || "").trim().toLowerCase();
    const filterCondition = req.query.filterCondition || "all";
    const filterLanguage = req.query.filterLanguage || "all";
    const filterFinish = req.query.filterFinish || "all";

    // 1. Fetch ALL DB rows for this list type
    const dbCards = await db("user_cards")
      .where({ user_id: req.user.id, list_type: listType });

    // 2. Load necessary Scryfall data to calculate prices & unresolved status
    const uniqueNames = [...new Set(dbCards.map(c => c.card_name))];
    let batchResult = {};
    if (uniqueNames.length > 0) {
      batchResult = await getLocalCardsBatch(uniqueNames);
    }
    
    // Fill missing keys for unresolved
    const printsCache = {};
    for (const name of uniqueNames) {
      if (batchResult[name]) {
        printsCache[name] = batchResult[name];
      } else {
        printsCache[name] = { missing: true, prints: [] };
      }
    }

    // 3. Filter
    let filtered = dbCards;
    if (filterName) {
      filtered = filtered.filter(c => c.card_name.toLowerCase().includes(filterName));
    }
    if (filterSet) {
      filtered = filtered.filter(c => (c.set_code || "").toLowerCase().includes(filterSet));
    }
    if (filterCondition !== "all") {
      filtered = filtered.filter(c => (c.card_condition || "NM") === filterCondition);
    }
    if (filterLanguage !== "all") {
      filtered = filtered.filter(c => (c.card_language || "EN") === filterLanguage);
    }
    if (filterFinish !== "all") {
      const isFoilFilter = filterFinish === "foil";
      filtered = filtered.filter(c => !!c.is_foil === isFoilFilter);
    }

    // 4. Calculate Stats (on the FULL filtered list, like it used to on frontend)
    let totalCollectionValue = 0;
    let totalItems = 0;
    const uniqueCardsSet = new Set();
    
    for (const card of filtered) {
      totalItems += card.quantity;
      uniqueCardsSet.add(card.card_name);
      totalCollectionValue += getRowPrice(card, printsCache[card.card_name]) * card.quantity;
    }
    
    const unresolvedCount = filtered.filter(c => isCardUnresolved(c, printsCache[c.card_name])).length;

    // 5. Sort
    filtered.sort((a, b) => {
      const unresA = isCardUnresolved(a, printsCache[a.card_name]);
      const unresB = isCardUnresolved(b, printsCache[b.card_name]);

      if (unresA !== unresB) return unresA ? -1 : 1;

      let valA, valB;
      if (sortField === "price") {
        valA = getRowPrice(a, printsCache[a.card_name]) * a.quantity;
        valB = getRowPrice(b, printsCache[b.card_name]) * b.quantity;
      } else if (sortField === "quantity") {
        valA = a.quantity;
        valB = b.quantity;
      } else if (sortField === "set_code") {
        valA = a.set_code || "";
        valB = b.set_code || "";
      } else if (sortField === "card_condition") {
        valA = a.card_condition || "NM";
        valB = b.card_condition || "NM";
      } else if (sortField === "card_language") {
        valA = a.card_language || "EN";
        valB = b.card_language || "EN";
      } else {
        valA = a.card_name || "";
        valB = b.card_name || "";
      }

      if (typeof valA === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
    });

    // 6. Slice
    const totalFilteredCount = filtered.length;
    let paginatedCards = filtered;
    if (limit > 0) { // Limit -1 could mean all, but we removed "all". Let's assume limit is strict.
      const startIndex = (page - 1) * limit;
      paginatedCards = filtered.slice(startIndex, startIndex + limit);
    }

    res.json({
      cards: paginatedCards,
      stats: {
        totalCollectionValue,
        totalItems,
        uniqueCardsCount: uniqueCardsSet.size,
        totalFilteredCount,
        unresolvedCount
      }
    });
  } catch (err) {
    console.error(" Failed to fetch owned cards:", err);
    res.status(500).json({ error: "Failed to fetch owned cards" });
  }
});

// POST /api/collection/owned
router.post("/", requireAuth, async (req, res) => {
  const { id, card_name, quantity, set_code, collector_number, is_foil, card_condition, card_language, list_type, is_proxy } = req.body;

  if (!card_name) {
    return res.status(400).json({ error: "card_name is required" });
  }

  const normSetCode = (set_code || "").trim().toUpperCase();
  const normCollectorNum = (collector_number || "").trim();
  const normFoil = !!is_foil;
  const normProxy = !!is_proxy;
  const normCondition = card_condition || "NM";
  const normLanguage = card_language || "EN";
  const normListType = list_type || "owned";

  try {
    if (id) {
      // Direct row update by ID
      const existing = await db("user_cards")
        .where({ id, user_id: req.user.id })
        .first();

      if (!existing) {
        return res.status(404).json({ error: "Card row not found" });
      }

      const newQty = quantity !== undefined ? Math.max(0, quantity) : existing.quantity;

      if (newQty <= 0) {
        await db("user_cards").where({ id }).delete();
        return res.json({ message: "Card removed due to zero quantity", deleted: true });
      }

      const [updated] = await db("user_cards")
        .where({ id })
        .update({
          quantity: newQty,
          set_code: normSetCode,
          collector_number: normCollectorNum,
          is_foil: normFoil,
          is_proxy: normProxy,
          card_condition: normCondition,
          card_language: normLanguage,
          updated_at: db.fn.now()
        })
        .returning("*");

      return res.json(updated);
    } else {
      // Adding/Incrementing card from Search autocomplete or Import
      const existing = await db("user_cards")
        .where({
          user_id: req.user.id,
          card_name,
          list_type: normListType,
          set_code: normSetCode,
          is_foil: normFoil,
          is_proxy: normProxy,
          card_condition: normCondition,
          card_language: normLanguage
        })
        .first();

      if (existing) {
        const addQty = quantity !== undefined ? Math.max(1, quantity) : 1;
        const [updated] = await db("user_cards")
          .where({ id: existing.id })
          .update({
            quantity: existing.quantity + addQty,
            collector_number: normCollectorNum || existing.collector_number,
            updated_at: db.fn.now()
          })
          .returning("*");
        return res.json(updated);
      } else {
        const [inserted] = await db("user_cards")
          .insert({
            user_id: req.user.id,
            card_name,
            list_type: normListType,
            quantity: quantity !== undefined ? Math.max(1, quantity) : 1,
            set_code: normSetCode,
            collector_number: normCollectorNum,
            is_foil: normFoil,
            is_proxy: normProxy,
            card_condition: normCondition,
            card_language: normLanguage
          })
          .returning("*");
        return res.json(inserted);
      }
    }
  } catch (err) {
    console.error(" Failed to add/update owned card:", err);
    res.status(500).json({ error: "Failed to save card details" });
  }
});

// POST /api/collection/owned/bulk
router.post("/bulk", requireAuth, async (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: "cards array is required" });
  }

  try {
    let addedCount = 0;
    await db.transaction(async (trx) => {
      for (const card of cards) {
        if (!card.card_name) continue;

        const card_name = card.card_name.trim();
        const normSetCode = (card.set_code || "").trim().toUpperCase();
        const normCollectorNum = (card.collector_number || "").trim();
        const normFoil = !!card.is_foil;
        const normProxy = !!card.is_proxy;
        const normCondition = card.card_condition || "NM";
        const normLanguage = (card.card_language || "EN").toUpperCase();
        const quantity = Math.max(1, parseInt(card.quantity) || 1);

        const listType = card.list_type || "owned";

        const existing = await trx("user_cards")
          .where({
            user_id: req.user.id,
            card_name,
            list_type: listType,
            set_code: normSetCode,
            is_foil: normFoil,
            is_proxy: normProxy,
            card_condition: normCondition,
            card_language: normLanguage
          })
          .first();

        if (existing) {
          await trx("user_cards")
            .where({ id: existing.id })
            .update({
              quantity: existing.quantity + quantity,
              collector_number: normCollectorNum || existing.collector_number,
              updated_at: trx.fn.now()
            });
        } else {
          await trx("user_cards")
            .insert({
              user_id: req.user.id,
              card_name,
              list_type: listType,
              quantity,
              set_code: normSetCode,
              collector_number: normCollectorNum,
              is_foil: normFoil,
              is_proxy: normProxy,
              card_condition: normCondition,
              card_language: normLanguage
            });
        }
        addedCount += quantity;
      }
    });

    res.json({ message: "Bulk import completed successfully", count: addedCount });
  } catch (err) {
    console.error(" Bulk import failed:", err);
    res.status(500).json({ error: "Failed to perform bulk import" });
  }
});

// DELETE /api/collection/owned
router.delete("/", requireAuth, async (req, res) => {
  const { id, card_name, clear_all, list_type } = req.body;
  
  const targetListType = list_type || "owned";

  if (!id && !card_name && !clear_all) {
    return res.status(400).json({ error: "id, card_name, or clear_all is required" });
  }

  try {
    let deletedCount = 0;
    if (clear_all) {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id })
        .delete();
    } else if (id) {
      deletedCount = await db("user_cards")
        .where({ id, user_id: req.user.id })
        .delete();
    } else {
      deletedCount = await db("user_cards")
        .where({ user_id: req.user.id, card_name, list_type: targetListType })
        .delete();
    }

    if (deletedCount === 0 && !clear_all) {
      return res.status(404).json({ error: "Card not found in owned collection" });
    }

    res.json({ message: "Card(s) deleted successfully", deleted: true, count: deletedCount });
  } catch (err) {
    console.error(" Failed to delete owned card:", err);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;
