import axios from "axios";
import { db } from "../db/connection.js";

/**
 * Check if a category name represents a cut, sideboard, or otherwise excluded board.
 * @param {string} categoryName The category name
 * @param {Set|Array} excludedCategoryNames Optional set of category names explicitly marked includedInDeck: false by Archidekt
 */
export function isCutOrExcludedCategory(categoryName, excludedCategoryNames = null) {
  if (!categoryName || typeof categoryName !== "string") return false;
  const lower = categoryName.trim().toLowerCase();

  // If Archidekt explicitly flagged this category as includedInDeck === false
  if (excludedCategoryNames) {
    if (excludedCategoryNames instanceof Set && excludedCategoryNames.has(lower)) {
      return true;
    }
    if (Array.isArray(excludedCategoryNames) && excludedCategoryNames.some(c => String(c).toLowerCase() === lower)) {
      return true;
    }
  }

  // Common cut, sideboard, maybeboard, considering patterns
  if (
    lower === "cut cards" ||
    lower === "cut" ||
    lower === "cuts" ||
    lower.startsWith("cut ") ||
    lower.endsWith(" cut") ||
    lower.includes("cut cards") ||
    lower.includes("cuts") ||
    lower === "sideboard" ||
    lower === "maybeboard" ||
    lower === "considering"
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a card item from an Archidekt deck is cut or belongs to an excluded category.
 * @param {object} item The card item from Archidekt deck.cards
 * @param {Set|Array} excludedCategoryNames Optional set of category names marked includedInDeck: false
 */
export function isCardCutOrExcluded(item, excludedCategoryNames = null) {
  if (!item) return false;

  const categories = Array.isArray(item.categories)
    ? item.categories.map(c => typeof c === 'string' ? c : c?.name).filter(Boolean)
    : [];

  for (const cat of categories) {
    if (isCutOrExcludedCategory(cat, excludedCategoryNames)) {
      return true;
    }
  }

  // Check if the label itself is a cut tag
  let labelName = (item.label || "").split(',')[0].trim();
  if (labelName && isCutOrExcludedCategory(labelName, excludedCategoryNames)) {
    return true;
  }

  return false;
}

/**
 * Perform a differential sync of an Archidekt deck.
 * @param {string} deckId The Archidekt Deck ID
 * @param {string} userId The owner's user ID
 * @param {object} customMappings Optional override for mappings (default uses owner's saved config)
 * @param {object} options Optional sync options (e.g. excludeSideAndMaybeboards)
 * @returns {object} { stats: { added, removed, ignored } }
 */
export async function syncDeckInternal(deckId, userId, customMappings = null, options = {}) {
  // 1. Get user config
  const user = await db("users").where({ id: userId }).first();
  if (!user) throw new Error("User not found");

  const dbMappings = user.archidekt_tag_mappings ?
    (typeof user.archidekt_tag_mappings === 'string' ? JSON.parse(user.archidekt_tag_mappings) : user.archidekt_tag_mappings)
    : {};

  const tagMappings = customMappings || dbMappings;

  // Determine exclude_side_and_maybeboards preference
  const existingDeckRow = await db("user_archidekt_decks")
    .where({ user_id: userId, deck_id: String(deckId) })
    .first();

  let excludeSideAndMaybeboards = true;
  if (options && options.excludeSideAndMaybeboards !== undefined) {
    excludeSideAndMaybeboards = !!options.excludeSideAndMaybeboards;
  } else if (existingDeckRow && existingDeckRow.exclude_side_and_maybeboards !== null && existingDeckRow.exclude_side_and_maybeboards !== undefined) {
    excludeSideAndMaybeboards = !!existingDeckRow.exclude_side_and_maybeboards;
  }

  // 2. Fetch deck from Archidekt
  const response = await axios.get(`https://archidekt.com/api/decks/${deckId}/`);
  const deck = response.data;

  // Build set of categories marked includedInDeck: false by Archidekt
  const excludedCategoryNames = new Set();
  if (Array.isArray(deck.categories)) {
    for (const cat of deck.categories) {
      if (cat && cat.name && cat.includedInDeck === false) {
        excludedCategoryNames.add(cat.name.toLowerCase());
      }
    }
  }

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

      const itemCategories = Array.isArray(item.categories)
        ? item.categories.map(c => typeof c === 'string' ? c : c?.name).filter(Boolean)
        : [];

      // Check categories first, then color tag
      const cardTags = [...itemCategories, labelName];
      const isCutCard = excludeSideAndMaybeboards && isCardCutOrExcluded(item, excludedCategoryNames);

      // Determine destination list based on tags
      let destination = "ignore";

      // 1. If any tag on this card is explicitly mapped to "ignore", honor that immediately
      const explicitlyIgnored = cardTags.some(tag => tagMappings[tag] === "ignore" || tagMappings[tag] === "Ignore");

      if (explicitlyIgnored) {
        destination = "ignore";
      } else {
        // 2. Look for an explicit tag mapping (category mappings take priority over color tag)
        let foundTag = null;
        for (const tag of cardTags) {
          if (tagMappings[tag]) {
            foundTag = tag;
            break;
          }
        }

        if (foundTag) {
          // If the card is in a Cut/Excluded category, only use the mapping if the cut category itself was explicitly mapped
          // (i.e. do not accidentally import a cut card into owned/wishlist just because the color tag is mapped)
          if (isCutCard) {
            const cutCategoryMapped = itemCategories.some(cat =>
              isCutOrExcludedCategory(cat, excludedCategoryNames) &&
              tagMappings[cat] &&
              tagMappings[cat] !== "ignore" &&
              tagMappings[cat] !== "Ignore"
            );
            if (cutCategoryMapped) {
              destination = tagMappings[foundTag];
            } else {
              destination = "ignore";
            }
          } else {
            destination = tagMappings[foundTag];
          }
        } else {
          destination = "ignore";
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

  // Find commander and all cards
  let commanderName = null;
  const allCardNames = [];
  if (deck.cards && Array.isArray(deck.cards)) {
    for (const item of deck.cards) {
      if (item.card && item.card.oracleCard) {
        const cardOracleName = item.card.oracleCard.name;
        if (!commanderName) {
          const itemCategories = Array.isArray(item.categories)
            ? item.categories.map(c => typeof c === 'string' ? c : c?.name).filter(Boolean)
            : [];
          if (itemCategories.some(cat => cat.toLowerCase().includes("commander") || cat.toLowerCase().includes("general"))) {
            commanderName = cardOracleName;
          }
        }

        // If excludeSideAndMaybeboards is enabled, skip cut, sideboard, and excluded cards
        if (excludeSideAndMaybeboards && isCardCutOrExcluded(item, excludedCategoryNames)) {
          continue;
        }

        allCardNames.push(cardOracleName);
      }
    }
  }

  // Save the deck to user_archidekt_decks (insert/merge just in case it doesn't exist)
  // Always restore status to "active" on successful resync (in case it was disabled after a proxy list clear)
  const deckName = deck.name || `Deck ${deckId}`;
  await db("user_archidekt_decks")
    .insert({
      user_id: userId,
      deck_id: String(deckId),
      deck_name: deckName,
      commander: commanderName,
      cards: JSON.stringify(allCardNames),
      status: "active",
      exclude_side_and_maybeboards: excludeSideAndMaybeboards,
      updated_at: db.fn.now()
    })
    .onConflict(["user_id", "deck_id"])
    .merge({
      deck_name: deckName,
      commander: commanderName,
      cards: JSON.stringify(allCardNames),
      status: "active",
      exclude_side_and_maybeboards: excludeSideAndMaybeboards,
      updated_at: db.fn.now()
    });

  return { stats: syncStats, deckName };
}

/**
 * Disable all of a user's synced decks and remove the cards they contributed to user_cards.
 * This is called when a user clears their proxy list so deck-imported cards are removed
 * until the user resyncs.
 * @param {string} userId The user's ID
 */
export async function disableUserDecksAndClearItems(userId) {
  await db.transaction(async (trx) => {
    // 1. Fetch all deck item rows for this user (these represent what was imported)
    const deckItems = await trx("user_archidekt_deck_items")
      .where({ user_id: userId });

    // 2. For each deck item, reduce the quantity in user_cards accordingly
    for (const item of deckItems) {
      const [cardName, listType, setCode, isFoilStr] = [
        item.card_name,
        item.list_type,
        item.set_code,
        item.is_foil
      ];
      const isFoil = isFoilStr === true || isFoilStr === 1;

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

    // 3. Clear deck item tracking rows (so next resync treats it as a fresh import)
    await trx("user_archidekt_deck_items")
      .where({ user_id: userId })
      .delete();

    // 4. Mark all user decks as disabled
    await trx("user_archidekt_decks")
      .where({ user_id: userId })
      .update({ status: "disabled", updated_at: trx.fn.now() });
  });
}
