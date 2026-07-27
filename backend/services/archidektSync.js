import axios from "axios";
import { db } from "../db/connection.js";

/**
 * Perform a differential sync of an Archidekt deck.
 * @param {string} deckId The Archidekt Deck ID
 * @param {string} userId The owner's user ID
 * @param {object} customMappings Optional override for mappings (default uses owner's saved config)
 * @returns {object} { stats: { added, removed, ignored } }
 */
export async function syncDeckInternal(deckId, userId, customMappings = null) {
  // 1. Get user config
  const user = await db("users").where({ id: userId }).first();
  if (!user) throw new Error("User not found");
  
  const dbMappings = user.archidekt_tag_mappings ? 
    (typeof user.archidekt_tag_mappings === 'string' ? JSON.parse(user.archidekt_tag_mappings) : user.archidekt_tag_mappings) 
    : {};
    
  const tagMappings = customMappings || dbMappings;

  // 2. Fetch deck from Archidekt
  const response = await axios.get(`https://archidekt.com/api/decks/${deckId}/`);
  const deck = response.data;

  let syncStats = { added: 0, removed: 0, ignored: 0 };

  // 3. Process cards
  await db.transaction(async (trx) => {
    // Step A: Calculate the New State (what cards the deck currently provides based on mappings)
    const newState = {}; // Map of "cardName|listType|setCode|isFoil" -> quantity
    
    for (const item of deck.cards) {
      if (!item.card || !item.card.oracleCard) continue;

      const cardName = item.card.oracleCard.name;
      const setCode = item.card.edition?.editioncode?.toUpperCase() || "";
      const quantity = item.quantity || 1;
      const isFoil = item.modifier === "Foil";
      
      let labelName = (item.label || "").split(',')[0].trim();
      if (!labelName) labelName = "Default color tag";
      const tags = [labelName];

      // Determine destination list based on tags
      let destination = "ignore";
      for (const tag of tags) {
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
      .where({ user_id: userId, deck_id: String(deckId) });
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
    await trx("user_archidekt_deck_items").where({ user_id: userId, deck_id: String(deckId) }).delete();
    
    const newRowsToInsert = [];
    for (const [key, qty] of Object.entries(newState)) {
      if (qty <= 0) continue;
      const [cardName, listType, setCode, isFoilStr] = key.split("|");
      newRowsToInsert.push({
        user_id: userId,
        deck_id: String(deckId),
        card_name: cardName,
        list_type: listType,
        quantity: qty,
        set_code: setCode,
        is_foil: isFoilStr === "true"
      });
    }
    
    if (newRowsToInsert.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < newRowsToInsert.length; i += chunkSize) {
        await trx("user_archidekt_deck_items").insert(newRowsToInsert.slice(i, i + chunkSize));
      }
    }
  });

  // Save the deck to user_archidekt_decks (insert/merge just in case it doesn't exist)
  const deckName = deck.name || `Deck ${deckId}`;
  await db("user_archidekt_decks")
    .insert({
      user_id: userId,
      deck_id: String(deckId),
      deck_name: deckName,
      updated_at: db.fn.now()
    })
    .onConflict(["user_id", "deck_id"])
    .merge({
      deck_name: deckName,
      updated_at: db.fn.now()
    });

  return { stats: syncStats, deckName };
}
