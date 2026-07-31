import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server.js';
import { db } from '../db/connection.js';

// Helper to parse CSV lines for test
function parseCSVLine(line) {
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

function normalizeCondition(condStr) {
  if (!condStr) return "NM";
  const s = condStr.toLowerCase().trim().replace(/[\s_-]+/g, "");
  if (s.includes("nearmint") || s === "nm") return "NM";
  if (s.includes("lightly") || s.includes("light") || s === "lp") return "LP";
  if (s.includes("moderately") || s.includes("moderate") || s === "mp") return "MP";
  if (s.includes("heavily") || s.includes("heavy") || s === "hp") return "HP";
  if (s.includes("damaged") || s.includes("poor") || s === "po" || s === "dmg") return "PO";
  return "NM";
}

function parseGigaBoxesCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const headerMap = {};
  headers.forEach((h, idx) => {
    const key = h.toLowerCase().replace(/[\s_-]+/g, "");
    if (key === "name") headerMap.card_name = idx;
    else if (key === "setcode") headerMap.set_code = idx;
    else if (key === "collectornumber") headerMap.collector_number = idx;
    else if (key === "foil") headerMap.is_foil = idx;
    else if (key === "quantity") headerMap.quantity = idx;
    else if (key === "condition") headerMap.card_condition = idx;
    else if (key === "language") headerMap.card_language = idx;
  });

  const cards = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === 0) continue;

    const rawName = headerMap.card_name !== undefined ? row[headerMap.card_name] : "";
    if (!rawName) continue;

    const cardName = rawName.replace(/^["']|["']$/g, "").trim();
    if (!cardName) continue;

    const foilVal = headerMap.is_foil !== undefined ? row[headerMap.is_foil] : "normal";
    const isFoil = String(foilVal).toLowerCase().trim() === "foil" || String(foilVal).toLowerCase().trim() === "true";

    cards.push({
      card_name: cardName,
      set_code: headerMap.set_code !== undefined ? (row[headerMap.set_code] || "").toUpperCase() : "",
      collector_number: headerMap.collector_number !== undefined ? (row[headerMap.collector_number] || "") : "",
      is_foil: isFoil,
      quantity: headerMap.quantity !== undefined ? parseInt(row[headerMap.quantity], 10) || 1 : 1,
      card_condition: headerMap.card_condition !== undefined ? normalizeCondition(row[headerMap.card_condition]) : "NM",
      card_language: headerMap.card_language !== undefined ? (row[headerMap.card_language] || "EN").toUpperCase() : "EN"
    });
  }
  return cards;
}

describe('Owned Collection & Bulk Import API', () => {
  it('should import Giga Boxes.csv to DevUser via bulk endpoint', async () => {
    // 1. Register DevUser
    const user = { email: 'devuser@example.com', username: 'DevUser', password: 'password123' };
    const regRes = await request(app).post('/api/auth/register').send(user);
    expect(regRes.status).toBe(200);
    const token = regRes.body.token;

    // 2. Read Giga Boxes.csv
    const gigaBoxesPath = path.resolve(process.cwd(), '../Giga Boxes.csv');
    expect(fs.existsSync(gigaBoxesPath)).toBe(true);

    const csvContent = fs.readFileSync(gigaBoxesPath, 'utf8');
    const parsedCards = parseGigaBoxesCSV(csvContent);

    expect(parsedCards.length).toBeGreaterThan(2000);

    // 3. Bulk import to DevUser
    const importRes = await request(app)
      .post('/api/collection/owned/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ cards: parsedCards });

    expect(importRes.status).toBe(200);
    expect(importRes.body.count).toBeGreaterThan(2000);

    // 4. Fetch owned collection for DevUser to verify persistence
    const collectionRes = await request(app)
      .get('/api/collection/owned?limit=-1')
      .set('Authorization', `Bearer ${token}`);

    expect(collectionRes.status).toBe(200);
    const cards = collectionRes.body.cards || collectionRes.body;
    expect(cards.length).toBeGreaterThan(1000);

    // Check specific card from Giga Boxes.csv, e.g. "Suki, Kyoshi Captain"
    const suki = cards.find(c => c.card_name === 'Suki, Kyoshi Captain');
    expect(suki).toBeDefined();
    expect(suki.set_code).toBe('TLE');
    expect(suki.collector_number).toBe('85');
    expect(suki.is_foil).toBe(1); // SQLite stores boolean as 1/0
  });
});
