// backend/db/connection.js
import knex from "knex";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /data when running in production (e.g. inside container)
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

// Determine correct DB path
let dbPath;
if (isTest) {
  dbPath = ":memory:";
} else if (isProd) {
  dbPath = "/data/manabase.db";
} else {
  dbPath = path.join(__dirname, "manabase.db");
}

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

  // Create user_cards table for collection tracking (Owned, Wishlist, Tradelist)
  const hasUserCards = await db.schema.hasTable("user_cards");
  if (!hasUserCards) {
    await db.schema.raw(`
      CREATE TABLE "user_cards" (
        "id" char(36) default (lower(hex(randomblob(16)))), 
        "user_id" char(36) not null, 
        "card_name" varchar(255) not null, 
        "list_type" varchar(255) not null, 
        "quantity" integer default '1', 
        "set_code" varchar(255) default '', 
        "collector_number" varchar(255) default '', 
        "is_foil" boolean default '0', 
        "any_printing" boolean default '1', 
        "card_condition" varchar(255) default 'NM', 
        "card_language" varchar(255) default 'EN', 
        "market_price" float default '0', 
        "max_price_threshold" float, 
        "target_owner_id" char(36), 
        "created_at" datetime not null default CURRENT_TIMESTAMP, 
        "updated_at" datetime not null default CURRENT_TIMESTAMP, 
        foreign key("user_id") references "users"("id") ON DELETE CASCADE, 
        foreign key("target_owner_id") references "users"("id") ON DELETE CASCADE, 
        primary key ("id"),
        UNIQUE("user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language")
      )
    `);
    console.log("✅ Created user_cards table");
  } else {
    // Run schema migration if card_condition column is missing
    const hasConditionColumn = await db.schema.hasColumn("user_cards", "card_condition");
    if (!hasConditionColumn) {
      console.log("🔄 Migrating user_cards table to add Cardsphere features (condition, language)...");
      
      // 1. Rename old table
      await db.schema.renameTable("user_cards", "user_cards_temp");
      
      // 2. Create new table with updated schema
      await db.schema.createTable("user_cards", (t) => {
        t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
        t.uuid("user_id").notNullable().references("id").inTable("users");
        t.string("card_name").notNullable();
        t.string("list_type").notNullable();
        t.integer("quantity").defaultTo(1);
        t.string("set_code").defaultTo("");
        t.string("collector_number").defaultTo("");
        t.boolean("is_foil").defaultTo(false);
        t.boolean("any_printing").defaultTo(true);
        t.string("card_condition").defaultTo("NM");
        t.string("card_language").defaultTo("EN");
        t.decimal("market_price", 10, 2).defaultTo(0);
        t.decimal("max_price_threshold", 10, 2);
        t.uuid("target_owner_id").references("id").inTable("users");
        t.timestamps(true, true);
        t.unique(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]);
      });
      
      // 3. Migrate data
      const oldRows = await db("user_cards_temp");
      console.log(`📦 Found ${oldRows.length} old user cards to migrate.`);
      
      // Check which columns actually existed in temp table to avoid select errors
      const hasTempMarketPrice = await db.schema.hasColumn("user_cards_temp", "market_price");
      const hasTempMaxPrice = await db.schema.hasColumn("user_cards_temp", "max_price_threshold");
      const hasTempTargetOwner = await db.schema.hasColumn("user_cards_temp", "target_owner_id");
      
      for (const row of oldRows) {
        await db("user_cards").insert({
          id: row.id,
          user_id: row.user_id,
          card_name: row.card_name,
          list_type: row.list_type,
          quantity: row.quantity || 1,
          set_code: row.set_code || "",
          collector_number: row.collector_number || "",
          is_foil: !!row.is_foil,
          any_printing: true,
          card_condition: "NM",
          card_language: "EN",
          market_price: hasTempMarketPrice ? (row.market_price || 0) : 0,
          max_price_threshold: hasTempMaxPrice ? (row.max_price_threshold || null) : null,
          target_owner_id: hasTempTargetOwner ? (row.target_owner_id || null) : null,
          created_at: row.created_at || db.fn.now(),
          updated_at: row.updated_at || db.fn.now()
        });
      }
      
      // 4. Drop temp table
      await db.schema.dropTable("user_cards_temp");
      console.log("✅ Successfully migrated user_cards schema!");
    } else {
      // Check for any_printing migration specifically
      const hasAnyPrintingColumn = await db.schema.hasColumn("user_cards", "any_printing");
      if (!hasAnyPrintingColumn) {
        console.log("🔄 Migrating user_cards table to add any_printing...");
        
        // Drop the old unique index to prevent name collision when recreating the table
        await db.schema.alterTable("user_cards", (t) => {
          t.dropUnique(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]);
        });
        
        await db.schema.renameTable("user_cards", "user_cards_temp");
        
        await db.schema.createTable("user_cards", (t) => {
          t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
          t.uuid("user_id").notNullable().references("id").inTable("users");
          t.string("card_name").notNullable();
          t.string("list_type").notNullable();
          t.integer("quantity").defaultTo(1);
          t.string("set_code").defaultTo("");
          t.string("collector_number").defaultTo("");
          t.boolean("is_foil").defaultTo(false);
          t.boolean("any_printing").defaultTo(true);
          t.string("card_condition").defaultTo("NM");
          t.string("card_language").defaultTo("EN");
          t.decimal("market_price", 10, 2).defaultTo(0);
          t.decimal("max_price_threshold", 10, 2);
          t.uuid("target_owner_id").references("id").inTable("users");
          t.timestamps(true, true);
          t.unique(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]);
        });
        
        const oldRows = await db("user_cards_temp");
        console.log(`📦 Found ${oldRows.length} old user cards to migrate for any_printing.`);
        
        for (const row of oldRows) {
          await db("user_cards").insert({
            id: row.id,
            user_id: row.user_id,
            card_name: row.card_name,
            list_type: row.list_type,
            quantity: row.quantity || 1,
            set_code: row.set_code || "",
            collector_number: row.collector_number || "",
            is_foil: !!row.is_foil,
            any_printing: true,
            card_condition: row.card_condition || "NM",
            card_language: row.card_language || "EN",
            market_price: row.market_price || 0,
            max_price_threshold: row.max_price_threshold || null,
            target_owner_id: row.target_owner_id || null,
            created_at: row.created_at || db.fn.now(),
            updated_at: row.updated_at || db.fn.now()
          });
        }
        
        await db.schema.dropTable("user_cards_temp");
        console.log("✅ Successfully migrated user_cards for any_printing!");
      }
    }
  }

  // Create playgroups tables
  const hasPlaygroups = await db.schema.hasTable("playgroups");
  if (!hasPlaygroups) {
    await db.schema.createTable("playgroups", (t) => {
      t.increments("id").primary();
      t.string("name").notNullable();
      t.timestamps(true, true);
    });
    console.log("✅ Created playgroups table");
  }

  const hasPlaygroupMembers = await db.schema.hasTable("playgroup_members");
  if (!hasPlaygroupMembers) {
    await db.schema.createTable("playgroup_members", (t) => {
      t.integer("playgroup_id").notNullable().references("id").inTable("playgroups").onDelete("CASCADE");
      t.uuid("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
      t.primary(["playgroup_id", "user_id"]);
    });
    console.log("✅ Created playgroup_members table");
  }

  const hasProxyOrders = await db.schema.hasTable("proxy_orders");
  if (!hasProxyOrders) {
    await db.schema.createTable("proxy_orders", (t) => {
      t.increments("id").primary();
      t.integer("playgroup_id").notNullable().references("id").inTable("playgroups");
      t.string("status").defaultTo("open"); // 'open', 'locked', 'ordered'
      t.timestamps(true, true);
    });
    console.log("✅ Created proxy_orders table");
  }

  // Trades system
  const hasTrades = await db.schema.hasTable("trades");
  if (!hasTrades) {
    await db.schema.createTable("trades", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
      t.uuid("sender_id").notNullable().references("id").inTable("users");
      t.uuid("receiver_id").notNullable().references("id").inTable("users");
      t.string("status").defaultTo("proposed"); // 'proposed', 'countered', 'accepted', 'completed', 'cancelled', 'declined'
      t.timestamps(true, true);
    });
    console.log("✅ Created trades table");
  }

  const hasTradeItems = await db.schema.hasTable("trade_items");
  if (!hasTradeItems) {
    await db.schema.createTable("trade_items", (t) => {
      t.uuid("id").primary().defaultTo(db.raw("(lower(hex(randomblob(16))))"));
      t.uuid("trade_id").notNullable().references("id").inTable("trades").onDelete("CASCADE");
      t.uuid("user_id").notNullable().references("id").inTable("users"); // The user giving the card
      t.string("card_name").notNullable();
      t.integer("quantity").defaultTo(1);
      t.string("set_code").defaultTo("");
      t.string("collector_number").defaultTo("");
      t.boolean("is_foil").defaultTo(false);
      t.timestamps(true, true);
    });
    console.log("✅ Created trade_items table");
  }
}
