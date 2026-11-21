/**
 * Migration: Add partial UNIQUE index on appointments(slot_id) covering
 * every appointment status that occupies a slot.
 * 
 * Cancelled appointments ('cancelled') free the slot.
 * Raw SQL works identically across PostgreSQL and SQLite.
 */
exports.up = async function (knex) {
  // If existing duplicate active appointments exist on the same slot (e.g. from previous test runs),
  // retain the newest record and mark older ones as 'cancelled' so the unique index can be created cleanly.
  const isPg = knex.client.config.client === 'pg';

  if (isPg) {
    await knex.raw(`
      UPDATE appointments
      SET status = 'cancelled', updated_at = NOW()
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY slot_id ORDER BY created_at DESC) as rn
          FROM appointments
          WHERE status != 'cancelled'
        ) t WHERE rn = 1
      ) AND status != 'cancelled';
    `);
  } else {
    await knex.raw(`
      UPDATE appointments
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY slot_id ORDER BY created_at DESC) as rn
          FROM appointments
          WHERE status != 'cancelled'
        ) t WHERE rn = 1
      ) AND status != 'cancelled';
    `);
  }

  // Raw SQL partial unique index: works on both PostgreSQL and SQLite (>= 3.8.0)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_appointments_slot_active
    ON appointments (slot_id)
    WHERE status != 'cancelled';
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_appointments_slot_active;
  `);
};
