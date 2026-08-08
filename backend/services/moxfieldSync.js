import fetch from "node-fetch";
import { db } from "../db/connection.js";

/**
 * Clean up a Moxfield Deck ID or URL to get the pure ID
 */
export function parseMoxfieldDeckId(deckIdOrUrl) {
  if (!deckIdOrUrl) return "";
  let clean = deckIdOrUrl.trim();
  if (clean.includes("moxfield.com/decks/")) {
    const parts = clean.split("moxfield.com/decks/");
    clean = parts[1].split("/")[0].split("?")[0];
  }
  return clean;
}

/**
 * Fetch raw deck data from Moxfield API
 */
export async function fetchMoxfieldDeckRaw(deckIdOrUrl) {
  const deckId = parseMoxfieldDeckId(deckIdOrUrl);
  if (!deckId) throw new Error("Invalid Moxfield Deck ID or URL");

  const response = await fetch(`https://api2.moxfield.com/v2/decks/all/${deckId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Moxfield deck not found");
    }
    throw new Error(`Failed to fetch deck from Moxfield (HTTP ${response.status})`);
  }

  return response.json();
}

/**
 * Normalize a raw Moxfield deck into standard structure
 */
export async function fetchMoxfieldDeck(deckIdOrUrl) {
  const deckData = await fetchMoxfieldDeckRaw(deckIdOrUrl);

  const deckId = deckData.publicId || deckData.id || parseMoxfieldDeckId(deckIdOrUrl);
  const deckName = deckData.name || `Moxfield Deck ${deckId}`;

  const boards = ["commanders", "mainboard", "sideboard", "maybeboard", "companions", "attractions", "stickers"];
  const uniqueTags = new Set();
  const normalizedCards = [];
  let commanderName = null;

  for (const boardName of boards) {
    const boardObj = deckData[boardName];
    if (!boardObj || typeof boardObj !== "object") continue;

    for (const item of Object.values(boardObj)) {
      if (!item || !item.card || !item.card.name) continue;

      const cardName = item.card.name;
      const setCode = item.card.set ? item.card.set.toUpperCase() : "";
      const quantity = item.quantity || 1;
      const isFoil = item.isFoil === true || item.finish === "foil" || item.card.foil === true;

      // Extract categories/tags assigned in Moxfield
      const categories = (item.categories && Array.isArray(item.categories) && item.categories.length > 0)
        ? item.categories
        : [boardName.charAt(0).toUpperCase() + boardName.slice(1)];

      categories.forEach(c => uniqueTags.add(c));

      // Record commander if in commanders board or has Commander tag
      if ((boardName === "commanders" || categories.includes("Commander")) && !commanderName) {
        commanderName = cardName;
      }

      normalizedCards.push({
        cardName,
        setCode,
        quantity,
        isFoil,
        categories,
        boardName
      });
    }
  }

  return {
    id: String(deckId),
    name: deckName,
    commander: commanderName,
    cards: normalizedCards,
    uniqueTags: Array.from(uniqueTags).sort()
  };
}

/**
 * Perform a differential sync of a Moxfield deck.
 * @param {string} deckId The Moxfield Deck ID or URL
 * @param {string} userId The owner's user ID
 * @param {object} customMappings Optional override for mappings (default uses owner's saved config)
 * @returns {object} { stats: { added, removed, ignored }, deckName }
 */
export async function syncMoxfieldDeckInternal(deckId, userId, customMappings = null) {
  const cleanId = parseMoxfieldDeckId(deckId);

  // 1. Get user config
  const user = await db("users").where({ id: userId }).first();
  if (!user) throw new Error("User not found");

  const dbMappings = user.moxfield_tag_mappings ?
    (typeof user.moxfield_tag_mappings === "string" ? JSON.parse(user.moxfield_tag_mappings) : user.moxfield_tag_mappings)
    : {};

  const tagMappings = customMappings || dbMappings;

  // 2. Fetch deck from Moxfield
  const deck = await fetchMoxfieldDeck(cleanId);

  let syncStats = { added: 0, removed: 0, ignored: 0 };

  // 3. Process cards
  await db.transaction(async (trx) => {
    // Step A: Calculate the New State (what cards the deck currently provides based on mappings)
    const newState = {}; // Map of "cardName|listType|setCode|isFoil" -> quantity

    for (const item of deck.cards) {
      const cardName = item.cardName;
      const setCode = item.setCode;
      const quantity = item.quantity;
      const isFoil = item.isFoil;

      // Determine destination list based on tags
      let destination = "ignore";
      for (const tag of item.categories) {
        if (tagMappings[tag]) {
          destination = tagMappings[tag];
          break;
        }
      }

      if (destination === "ignore" || destination === "Ignore") {
        syncStats.ignored += quantity;
        continue;
      }

      // Add to owned, wishlist, or tradelist
      let targetListType = "";
      if (destination === "owned" || destination === "Add to Collection (Others can trade for)") {
        targetListType = "owned";
      } else if (destination === "wishlist" || destination === "Add to Wishlist (need proxy OR real)") {
        targetListType = "wishlist";
      } else if (destination === "tradelist" || destination === "Add to Tradelist (need real)") {
        targetListType = "tradelist";
      }

      if (!targetListType) {
        syncStats.ignored += quantity;
        continue;
      }

      const key = `${cardName}|${targetListType}|${setCode}|${isFoil ? "true" : "false"}`;
      newState[key] = (newState[key] || 0) + quantity;
    }

    // Step B: Fetch the Previous State
    const oldStateRows = await trx("user_archidekt_deck_items")
      .where({ user_id: userId, deck_id: String(deck.id), source: "moxfield" });
    const oldState = {};
    for (const row of oldStateRows) {
      const key = `${row.card_name}|${row.list_type}|${row.set_code}|${row.is_foil ? "true" : "false"}`;
      oldState[key] = row.quantity;
    }

    // Step C: Calculate Deltas
    const deltas = {};
    for (const key of Object.keys(oldState)) {
      const oldQ = oldState[key];
      const newQ = newState[key] || 0;
      if (newQ !== oldQ) {
        deltas[key] = newQ - oldQ;
      }
    }
    for (const key of Object.keys(newState)) {
      if (!oldState[key]) {
        deltas[key] = newState[key];
      }
    }

    // Step D: Apply Deltas to user_cards
    for (const [key, diffQty] of Object.entries(deltas)) {
      if (diffQty === 0) continue;

      const [cardName, listType, setCode, isFoilStr] = key.split("|");
      const isFoil = isFoilStr === "true";

      if (diffQty > 0) syncStats.added += diffQty;
      else syncStats.removed += Math.abs(diffQty);

      const existing = await trx("user_cards")
        .where({
          user_id: userId,
          card_name: cardName,
          list_type: listType,
          set_code: setCode,
          is_foil: isFoil,
          card_condition: "NM",
          card_language: "EN"
        })
        .first();

      if (existing) {
        const newTotal = existing.quantity + diffQty;
        if (newTotal <= 0) {
          await trx("user_cards").where({ id: existing.id }).delete();
        } else {
          await trx("user_cards").where({ id: existing.id }).update({ quantity: newTotal, updated_at: trx.fn.now() });
        }
      } else if (diffQty > 0) {
        await trx("user_cards").insert({
          user_id: userId,
          card_name: cardName,
          list_type: listType,
          quantity: diffQty,
          set_code: setCode,
          is_foil: isFoil,
          card_condition: "NM",
          card_language: "EN"
        });
      }
    }

    // Step E: Save New State to user_archidekt_deck_items
    await trx("user_archidekt_deck_items")
      .where({ user_id: userId, deck_id: String(deck.id), source: "moxfield" })
      .delete();

    const newRowsToInsert = [];
    for (const [key, qty] of Object.entries(newState)) {
      if (qty <= 0) continue;
      const [cardName, listType, setCode, isFoilStr] = key.split("|");
      newRowsToInsert.push({
        user_id: userId,
        deck_id: String(deck.id),
        card_name: cardName,
        list_type: listType,
        quantity: qty,
        set_code: setCode,
        is_foil: isFoilStr === "true",
        source: "moxfield"
      });
    }

    if (newRowsToInsert.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < newRowsToInsert.length; i += chunkSize) {
        await trx("user_archidekt_deck_items").insert(newRowsToInsert.slice(i, i + chunkSize));
      }
    }
  });

  const allCardNames = deck.cards.map(c => c.cardName);

  // Save/merge into user_archidekt_decks
  await db("user_archidekt_decks")
    .insert({
      user_id: userId,
      deck_id: String(deck.id),
      deck_name: deck.name,
      commander: deck.commander,
      cards: JSON.stringify(allCardNames),
      status: "active",
      source: "moxfield",
      updated_at: db.fn.now()
    })
    .onConflict(["user_id", "deck_id"])
    .merge({
      deck_name: deck.name,
      commander: deck.commander,
      cards: JSON.stringify(allCardNames),
      status: "active",
      source: "moxfield",
      updated_at: db.fn.now()
    });

  return { stats: syncStats, deckName: deck.name };
}

/**
 * Disable all of a user's synced Moxfield decks and clear items.
 */
export async function disableUserMoxfieldDecksAndClearItems(userId) {
  await db.transaction(async (trx) => {
    const deckItems = await trx("user_archidekt_deck_items")
      .where({ user_id: userId, source: "moxfield" });

    for (const item of deckItems) {
      const isFoil = item.is_foil === true || item.is_foil === 1;
      const existing = await trx("user_cards")
        .where({
          user_id: userId,
          card_name: item.card_name,
          list_type: item.list_type,
          set_code: item.set_code,
          is_foil: isFoil,
          card_condition: "NM",
          card_language: "EN"
        })
        .first();

      if (existing) {
        const newTotal = existing.quantity - item.quantity;
        if (newTotal <= 0) {
          await trx("user_cards").where({ id: existing.id }).delete();
        } else {
          await trx("user_cards")
            .where({ id: existing.id })
            .update({ quantity: newTotal, updated_at: trx.fn.now() });
        }
      }
    }

    await trx("user_archidekt_deck_items")
      .where({ user_id: userId, source: "moxfield" })
      .delete();

    await trx("user_archidekt_decks")
      .where({ user_id: userId, source: "moxfield" })
      .update({ status: "disabled", updated_at: trx.fn.now() });
  });
}
