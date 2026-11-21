/**
 * Migration: Add consent_at column to mothers table.
 * Supports Nigeria Data Protection Act (NDPA) 2023 statutory compliance
 * covering mother and child data.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('mothers', (table) => {
    table.timestamp('consent_at');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('mothers', (table) => {
    table.dropColumn('consent_at');
  });
};
