import { beforeAll, afterAll, afterEach } from 'vitest';
import { db, initDB } from '../db/connection.js';

// Setup in-memory database before all tests
beforeAll(async () => {
  // Ensure we are using test environment and dev login
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_DEV_LOGIN = 'true';

  // Run schema migrations
  await initDB();
});

// Clean up database after each test to ensure test isolation
afterEach(async () => {
  const tables = ['users', 'packages', 'user_presets', 'default_presets', 'user_cards', 'user_archidekt_deck_items', 'user_archidekt_decks', 'user_deck_dismissals', 'user_land_preferences', 'playgroups', 'playgroup_members', 'playgroup_invites', 'proxy_orders', 'trades', 'trade_items'];
  for (const table of tables) {
    try {
      await db(table).del();
    } catch (e) {
      // Ignore if table doesn't exist yet during some tests
    }
  }
});

// Close database connection after all tests
afterAll(async () => {
  await db.destroy();
});
