// src/utils/csvImporter.js

/**
 * Parses raw CSV line handling quoted values and escaped quotes.
 */
export function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Normalizes condition string to standard condition codes (NM, LP, MP, HP, PO).
 */
export function normalizeCondition(condStr) {
  if (!condStr) return "NM";
  const s = condStr.toLowerCase().trim().replace(/[\s_-]+/g, "");
  if (s.includes("nearmint") || s === "nm") return "NM";
  if (s.includes("lightly") || s.includes("light") || s === "lp") return "LP";
  if (s.includes("moderately") || s.includes("moderate") || s === "mp") return "MP";
  if (s.includes("heavily") || s.includes("heavy") || s === "hp") return "HP";
  if (s.includes("damaged") || s.includes("poor") || s === "po" || s === "dmg") return "PO";
  return "NM";
}

/**
 * Normalizes foil status from string or boolean.
 */
export function normalizeFoil(foilVal) {
  if (typeof foilVal === "boolean") return foilVal;
  if (!foilVal) return false;
  const s = String(foilVal).toLowerCase().trim();
  return s === "foil" || s === "etched" || s === "true" || s === "yes" || s === "1";
}

/**
 * Parses raw text input which could be CSV format (e.g. ManaBox export, Scryfall CSV)
 * or plain decklist format ("4 Brainstorm").
 * Returns an array of normalized card objects ready for API import.
 */
export function parseImportInput(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const firstLineTokens = parseCSVLine(lines[0]);
  
  // Check if first line is a CSV header row containing "name" or "card"
  const isCSVHeader = firstLineTokens.some(tok => {
    const t = tok.toLowerCase().replace(/[\s_-]+/g, "");
    return t === "name" || t === "cardname" || t === "card" || t === "manaboxid" || t === "scryfallid";
  });

  if (isCSVHeader) {
    // Map headers to column indices
    const headerMap = {};
    firstLineTokens.forEach((tok, idx) => {
      const t = tok.toLowerCase().replace(/[\s_-]+/g, "");
      if (t === "name" || t === "cardname" || t === "cardtitle") headerMap.card_name = idx;
      else if (t === "setcode" || t === "set") headerMap.set_code = idx;
      else if (t === "collectornumber" || t === "cardnumber" || t === "number" || t === "cn") headerMap.collector_number = idx;
      else if (t === "foil" || t === "isfoil" || t === "finish") headerMap.is_foil = idx;
      else if (t === "quantity" || t === "qty" || t === "count") headerMap.quantity = idx;
      else if (t === "condition" || t === "cardcondition") headerMap.card_condition = idx;
      else if (t === "language" || t === "cardlanguage" || t === "lang") headerMap.card_language = idx;
    });

    const parsedCards = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length === 0) continue;

      const rawName = headerMap.card_name !== undefined ? row[headerMap.card_name] : "";
      if (!rawName) continue;

      const cardName = rawName.replace(/^["']|["']$/g, "").trim();
      if (!cardName) continue;

      const setCode = headerMap.set_code !== undefined ? (row[headerMap.set_code] || "").trim().toUpperCase() : "";
      const collectorNumber = headerMap.collector_number !== undefined ? (row[headerMap.collector_number] || "").trim() : "";
      const foilVal = headerMap.is_foil !== undefined ? row[headerMap.is_foil] : "normal";
      const qtyVal = headerMap.quantity !== undefined ? parseInt(row[headerMap.quantity], 10) : 1;
      const condVal = headerMap.card_condition !== undefined ? row[headerMap.card_condition] : "NM";
      const langVal = headerMap.card_language !== undefined ? (row[headerMap.card_language] || "EN").trim().toUpperCase() : "EN";

      parsedCards.push({
        card_name: cardName,
        quantity: Math.max(1, isNaN(qtyVal) ? 1 : qtyVal),
        set_code: setCode,
        collector_number: collectorNumber,
        is_foil: normalizeFoil(foilVal),
        card_condition: normalizeCondition(condVal),
        card_language: langVal || "EN"
      });
    }
    return parsedCards;
  }

  // Fallback: Parse decklist text lines (e.g. "4 Hallowed Fountain", "1 Watery Grave (GRN) 259")
  const parsedCards = [];
  for (const line of lines) {
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;

    // Check CSV row without header
    if (line.includes(",")) {
      const row = parseCSVLine(line);
      if (row.length >= 2) {
        const cardName = row[0].replace(/^["']|["']$/g, "").trim();
        if (cardName) {
          const qty = parseInt(row[1], 10) || 1;
          parsedCards.push({
            card_name: cardName,
            quantity: Math.max(1, qty),
            set_code: (row[2] || "").trim().toUpperCase(),
            collector_number: (row[3] || "").trim(),
            is_foil: normalizeFoil(row[4]),
            card_condition: normalizeCondition(row[5]),
            card_language: (row[6] || "EN").trim().toUpperCase()
          });
          continue;
        }
      }
    }

    // Standard decklist pattern: "4 Card Name" or "1 Card Name (SET) 123 *F*"
    let qty = 1;
    let nameStr = line;

    const qtyMatch = nameStr.match(/^(\d+)\s*x?\s+(.+)$/i);
    if (qtyMatch) {
      qty = parseInt(qtyMatch[1], 10) || 1;
      nameStr = qtyMatch[2].trim();
    }

    let setCode = "";
    let collectorNumber = "";
    let isFoil = false;

    const setMatch = nameStr.match(/^(.+?)\s+[\(\[]([A-Z0-9]{3,4})[\)\]]\s*(\d+)?(.*)$/i);
    if (setMatch) {
      nameStr = setMatch[1].trim();
      setCode = setMatch[2].trim().toUpperCase();
      if (setMatch[3]) collectorNumber = setMatch[3].trim();
      if (setMatch[4] && setMatch[4].toLowerCase().includes("*f*")) isFoil = true;
    }

    nameStr = nameStr.replace(/^["']|["']$/g, "").trim();
    if (nameStr) {
      parsedCards.push({
        card_name: nameStr,
        quantity: Math.max(1, qty),
        set_code: setCode,
        collector_number: collectorNumber,
        is_foil: isFoil,
        card_condition: "NM",
        card_language: "EN"
      });
    }
  }

  return parsedCards;
}
