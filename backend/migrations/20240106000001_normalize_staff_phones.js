const { formatPhone } = require('../src/utils/helpers');

/**
 * Migration: Normalise existing staff phone numbers to international +234 format.
 */
exports.up = async function (knex) {
  const staffMembers = await knex('staff').select('id', 'phone');
  for (const staff of staffMembers) {
    if (staff.phone) {
      const formatted = formatPhone(staff.phone.trim());
      if (formatted !== staff.phone) {
        await knex('staff').where('id', staff.id).update({ phone: formatted });
      }
    }
  }
};

exports.down = function () {
  return Promise.resolve();
};
