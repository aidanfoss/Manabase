// backend/db/connection.js
import knex from "knex";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /data when running in production (e.g. inside container)
const isProd = process.env.NODE_ENV === "production";

// Determine correct DB path
const dbPath = isProd
  ? "/data/manabase.db"
  : path.join(__dirname, "manabase.db");

// Ensure folder exists (avoids "no such file or directory" on first run)
try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (err) {
  console.warn("⚠️ Could not ensure DB directory:", err.message);
}

console.log(`📦 Using database at: ${dbPath}`);

export const db = knex({
  client: "sqlite3",
  connection: {
    filename: dbPath,
  },
  useNullAsDefault: true,
});

// Auto-create tables if missing
export async function initDB() {
  const hasUsers = await db.schema.hasTable("users");
  if (!hasUsers) {
    await db.schema.createTable("users", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
      t.string("email").unique().notNullable();
      t.string("username").notNullable();
      t.string("password_hash").notNullable();
      t.timestamps(true, true);
    });
  }

  const hasPackages = await db.schema.hasTable("packages");
  if (!hasPackages) {
    await db.schema.createTable("packages", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
      t.uuid("user_id").notNullable().references("id").inTable("users");
      t.string("name").notNullable();
      t.json("cards");
      t.boolean("is_public").defaultTo(false);
      t.timestamps(true, true);
    });
  }

  const hasUserPresets = await db.schema.hasTable("user_presets");
  if (!hasUserPresets) {
    await db.schema.createTable("user_presets", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
      t.uuid("user_id").notNullable().references("id").inTable("users");
      t.string("name").notNullable();
      t.string("description");
      t.json("landCycles");
      t.json("packages");
      t.json("cards");
      t.timestamps(true, true);
      t.unique(["user_id", "name"]); // Prevent duplicate names per user
    });
  }

  // Add cards column if it doesn't exist (for existing databases)
  const hasCardsColumn = await db.schema.hasColumn("user_presets", "cards");
  if (!hasCardsColumn) {
    await db.schema.table("user_presets", (t) => {
      t.json("cards");
    });
    console.log("✅ Added cards column to user_presets table");
  }

  // Create default presets table for built-in presets visible to all users
  const hasDefaultPresets = await db.schema.hasTable("default_presets");
  if (!hasDefaultPresets) {
    await db.schema.createTable("default_presets", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
      t.string("name").notNullable();
      t.string("description");
      t.json("landCycles");
      t.json("packages");
      t.timestamps(true, true);
      t.unique("name"); // Prevent duplicate names
    });
  }

  // --- PLAYGROUP NEXUS SCHEMA ---
  
  const hasPlaygroups = await db.schema.hasTable("playgroups");
  if (!hasPlaygroups) {
    await db.schema.createTable("playgroups", (t) => {
      t.increments("id").primary();
      t.string("name").notNullable();
      t.timestamps(true, true); // creates created_at and updated_at
    });
  }

  const hasPlaygroupMembers = await db.schema.hasTable("playgroup_members");
  if (!hasPlaygroupMembers) {
    await db.schema.createTable("playgroup_members", (t) => {
      t.integer("playgroup_id").notNullable().references("id").inTable("playgroups").onDelete("CASCADE");
      t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
      t.primary(["playgroup_id", "user_id"]);
    });
  }

  const hasUserCards = await db.schema.hasTable("user_cards");
  if (!hasUserCards) {
    await db.schema.createTable("user_cards", (t) => {
      t.increments("id").primary();
      t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
      t.string("card_name").notNullable();
      t.string("set_code").notNullable();
      t.string("collector_number").notNullable();
      t.boolean("is_foil").defaultTo(false);
      t.decimal("market_price", 10, 2);
      t.decimal("max_price_threshold", 10, 2);
      t.timestamps(true, true);
    });
  }

  const hasUserLists = await db.schema.hasTable("user_lists");
  if (!hasUserLists) {
    await db.schema.createTable("user_lists", (t) => {
      t.increments("id").primary();
      t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
      t.string("card_name").notNullable();
      t.string("list_kind").notNullable(); // 'proxy_wishlist', 'real_list', 'trade_sandbox'
      t.uuid("target_owner_id").references("id").inTable("users"); // for trade_sandbox
      t.timestamps(true, true);
    });
  }

  const hasProxyOrders = await db.schema.hasTable("proxy_orders");
  if (!hasProxyOrders) {
    await db.schema.createTable("proxy_orders", (t) => {
      t.increments("id").primary();
      t.integer("playgroup_id").notNullable().references("id").inTable("playgroups");
      t.string("status").defaultTo("open"); // 'open', 'locked', 'ordered'
      t.timestamps(true, true);
    });
  }
}
