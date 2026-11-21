/**
 * Initial database schema for the Antenatal & Postnatal Appointment System.
 */
exports.up = function (knex) {
  return knex.schema
    // ---- Mothers ----
    .createTable('mothers', (table) => {
      table.uuid('id').primary();
      table.string('phone', 20).unique().notNullable();
      table.string('name', 100).notNullable();
      table.string('password_hash').notNullable();
      table.string('hospital_id', 50);
      table.string('hmo_number', 50);
      table.boolean('is_verified').defaultTo(false);
      table.string('role', 20).defaultTo('mother');
      table.timestamps(true, true);
    })

    // ---- Babies ----
    .createTable('babies', (table) => {
      table.uuid('id').primary();
      table.uuid('mother_id').notNullable().references('id').inTable('mothers').onDelete('CASCADE');
      table.string('name', 100).notNullable();
      table.date('date_of_birth').notNullable();
      table.string('sex', 10).notNullable();
      table.timestamps(true, true);
    })

    // ---- Staff ----
    .createTable('staff', (table) => {
      table.uuid('id').primary();
      table.string('name', 100).notNullable();
      table.string('role', 20).notNullable(); // front_desk, midwife, doctor, admin
      table.string('phone', 20).unique().notNullable();
      table.string('password_hash').notNullable();
      table.timestamps(true, true);
    })

    // ---- Clinics ----
    .createTable('clinics', (table) => {
      table.uuid('id').primary();
      table.string('name', 100).notNullable();
      table.integer('slot_duration_min').notNullable().defaultTo(20);
      table.float('walkin_reserve_pct').defaultTo(0.2);
      table.timestamps(true, true);
    })

    // ---- Clinic ↔ Staff (many-to-many) ----
    .createTable('clinic_staff', (table) => {
      table.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
      table.uuid('staff_id').notNullable().references('id').inTable('staff').onDelete('CASCADE');
      table.primary(['clinic_id', 'staff_id']);
    })

    // ---- Schedule Slots ----
    .createTable('schedule_slots', (table) => {
      table.uuid('id').primary();
      table.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
      table.uuid('staff_id').references('id').inTable('staff').onDelete('SET NULL');
      table.date('slot_date').notNullable();
      table.time('start_time').notNullable();
      table.time('end_time').notNullable();
      table.boolean('is_walkin').defaultTo(false);
      table.boolean('is_blocked').defaultTo(false);
      table.timestamps(true, true);

      table.index(['clinic_id', 'slot_date']);
      table.index(['slot_date', 'start_time']);
    })

    // ---- Appointments ----
    .createTable('appointments', (table) => {
      table.uuid('id').primary();
      table.uuid('mother_id').notNullable().references('id').inTable('mothers').onDelete('CASCADE');
      table.uuid('clinic_id').notNullable().references('id').inTable('clinics').onDelete('CASCADE');
      table.uuid('staff_id').references('id').inTable('staff').onDelete('SET NULL');
      table.uuid('slot_id').notNullable().references('id').inTable('schedule_slots').onDelete('CASCADE');
      table.string('status', 20).notNullable().defaultTo('booked');
        // booked, checked_in, waiting, in_consultation, completed, cancelled, no_show
      table.string('booking_type', 10).notNullable().defaultTo('mother');
        // mother, baby, both
      table.string('queue_number', 10);
      table.timestamp('booked_at').defaultTo(knex.fn.now());
      table.timestamp('checked_in_at');
      table.boolean('reminder_24h_sent').defaultTo(false);
      table.boolean('reminder_2h_sent').defaultTo(false);
      table.timestamps(true, true);

      table.index(['mother_id', 'status']);
      table.index(['clinic_id', 'status']);
      table.index(['slot_id']);
    })

    // ---- Appointment ↔ Babies (many-to-many) ----
    .createTable('appointment_babies', (table) => {
      table.uuid('appointment_id').notNullable().references('id').inTable('appointments').onDelete('CASCADE');
      table.uuid('baby_id').notNullable().references('id').inTable('babies').onDelete('CASCADE');
      table.primary(['appointment_id', 'baby_id']);
    })

    // ---- Audit Logs ----
    .createTable('audit_logs', (table) => {
      table.uuid('id').primary();
      table.uuid('user_id');
      table.string('action', 50).notNullable();
      table.jsonb('details');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['user_id']);
      table.index(['action']);
      table.index(['created_at']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('appointment_babies')
    .dropTableIfExists('appointments')
    .dropTableIfExists('schedule_slots')
    .dropTableIfExists('clinic_staff')
    .dropTableIfExists('clinics')
    .dropTableIfExists('staff')
    .dropTableIfExists('babies')
    .dropTableIfExists('mothers');
};
