import { db, initDB } from "./db/connection.js";

async function fix() {
  await initDB();
  
// console.log("Fixing user_cards schema...");
  
  // 1. Rename current table
  await db.schema.renameTable("user_cards", "user_cards_broken");
  
  // 2. Create proper table with unique constraint using raw SQL to be absolutely certain
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
      "is_proxy" boolean default '0', 
      "market_price" float default '0', 
      "max_price_threshold" float, 
      "target_owner_id" char(36), 
      "created_at" datetime not null default CURRENT_TIMESTAMP, 
      "updated_at" datetime not null default CURRENT_TIMESTAMP, 
      foreign key("user_id") references "users"("id") ON DELETE CASCADE, 
      foreign key("target_owner_id") references "users"("id") ON DELETE CASCADE, 
      primary key ("id"),
      UNIQUE("user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language", "is_proxy")
    )
  `);

  // 3. Migrate data over
  const oldRows = await db("user_cards_broken");
// console.log(`Migrating ${oldRows.length} rows...`);
  
  // Insert in batches or individually, ignoring conflicts if duplicates exist
  for (const row of oldRows) {
    try {
      await db("user_cards").insert(row);
    } catch (e) {
// console.log(`Skipping duplicate row id ${row.id}`);
    }
  }
  
  // 4. Drop old table
  await db.schema.dropTable("user_cards_broken");
  
// console.log("Done fixing schema!");
  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});
