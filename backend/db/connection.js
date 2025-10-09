// backend/db/connection.js
import knex from "knex";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = knex({
  client: "sqlite3",
  connection: {
    filename: path.join(__dirname, "manabase.db"),
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
}
