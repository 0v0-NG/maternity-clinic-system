/**
 * Migration: Add late_arrival column to appointments table.
 * Supports late-arrival grace period tracking.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('appointments', (table) => {
    table.boolean('late_arrival').notNullable().defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('appointments', (table) => {
    table.dropColumn('late_arrival');
  });
};
