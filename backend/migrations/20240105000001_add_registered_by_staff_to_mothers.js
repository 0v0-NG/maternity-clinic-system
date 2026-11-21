/**
 * Migration: Add registered_by_staff column to mothers table.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('mothers', (table) => {
    table.boolean('registered_by_staff').defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('mothers', (table) => {
    table.dropColumn('registered_by_staff');
  });
};
