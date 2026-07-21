import { beforeAll, afterAll, afterEach } from 'vitest';
import { db, initDB } from '../db/connection.js';

// Setup in-memory database before all tests
beforeAll(async () => {
  // Ensure we are using test environment
  process.env.NODE_ENV = 'test';
  
  // Run schema migrations
  await initDB();
});

// Clean up database after each test to ensure test isolation
afterEach(async () => {
  const tables = ['users', 'packages', 'user_presets', 'default_presets', 'user_cards', 'playgroups', 'playgroup_members', 'proxy_orders', 'trades', 'trade_items'];
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
