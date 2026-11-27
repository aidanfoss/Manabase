/*
  Migration: add friend_code column to users table
  Generates an 8‑character uppercase alphanumeric code per user (unique).
*/

exports.up = async function (knex) {
  // Add nullable column first; code will be generated on demand.
  await knex.schema.table('users', (table) => {
    table.string('friend_code', 8).unique().nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('friend_code');
  });
};
