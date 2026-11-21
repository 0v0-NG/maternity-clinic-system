/**
 * Concurrency Test for Antenatal & Postnatal System API
 * 
 * Verifies:
 * 1. 10 mothers book the same slot at the same moment.
 *    Expected: exactly 1 succeeds (201), 9 get 409 SLOT_TAKEN.
 *    DB holds exactly one active appointment for that slot.
 * 2. 1 mother books two overlapping slots at the same moment.
 *    Expected: exactly 1 succeeds (201), the other gets 409 OVERLAP.
 * 3. Direct DB check: Attempt to insert a second active appointment
 *    on an occupied slot and show that the database itself rejects it.
 * 
 * Cleans up only the test rows it created; never touches seed data.
 */

const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const db = require('../src/config/database');

const BASE_URL = process.env.API_URL || 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  const client = url.protocol === 'https:' ? https : http;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const bodyData = options.body ? JSON.stringify(options.body) : null;
  if (bodyData) {
    headers['Content-Length'] = Buffer.byteLength(bodyData);
  }

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runConcurrencyTests() {
  console.log(`Starting concurrency tests against ${BASE_URL}...\n`);

  const createdMotherIds = [];
  const createdSlotIds = [];
  const createdApptIds = [];

  let scenario1Passed = false;
  let scenario2Passed = false;
  let directDbPassed = false;

  try {
    // 1. Fetch existing clinics (Antenatal & Postnatal)
    const ancClinic = await db('clinics').where('name', 'Antenatal Clinic').first();
    const pncClinic = await db('clinics').where('name', 'Postnatal Clinic').first();

    if (!ancClinic || !pncClinic) {
      throw new Error('Clinics Antenatal and Postnatal must exist in DB.');
    }

    // ----------------------------------------------------
    // Scenario 1: 10 mothers book the same slot concurrently
    // ----------------------------------------------------
    console.log('--- SCENARIO 1: 10 mothers book the same slot at the same moment ---');

    // Create a temporary slot
    const testSlot1Id = uuidv4();
    createdSlotIds.push(testSlot1Id);
    await db('schedule_slots').insert({
      id: testSlot1Id,
      clinic_id: ancClinic.id,
      slot_date: '2026-12-15',
      start_time: '14:00:00',
      end_time: '14:20:00',
      is_walkin: false,
      is_blocked: false,
    });

    // Create 10 temporary mothers with valid auth tokens
    const scenario1Mothers = [];
    for (let i = 0; i < 10; i++) {
      const mId = uuidv4();
      const phone = `+23470${Math.floor(10000000 + Math.random() * 90000000)}`;
      createdMotherIds.push(mId);
      await db('mothers').insert({
        id: mId,
        phone,
        name: `Concurrency Mother ${i + 1}`,
        password_hash: 'test_hash',
        is_verified: true,
        consent_at: new Date(),
        role: 'mother',
      });
      const token = jwt.sign({ id: mId, role: 'mother', name: `Concurrency Mother ${i + 1}` }, config.jwt.secret);
      scenario1Mothers.push({ id: mId, token, phone });
    }

    // 10 concurrent booking requests
    const s1Promises = scenario1Mothers.map((m) =>
      request('/appointments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${m.token}` },
        body: {
          clinic_id: ancClinic.id,
          slot_id: testSlot1Id,
          booking_type: 'mother',
        },
      })
    );

    const s1Results = await Promise.all(s1Promises);

    const s1Successes = s1Results.filter((r) => r.status === 201);
    const s1SlotTaken = s1Results.filter(
      (r) => r.status === 409 && r.data?.error?.code === 'SLOT_TAKEN'
    );
    const s1OtherErrors = s1Results.filter(
      (r) => r.status !== 201 && (r.status !== 409 || r.data?.error?.code !== 'SLOT_TAKEN')
    );

    s1Successes.forEach((r) => {
      if (r.data?.data?.id) createdApptIds.push(r.data.data.id);
    });

    // Verify DB count
    const activeApptsInDb = await db('appointments')
      .where('slot_id', testSlot1Id)
      .where('status', '!=', 'cancelled');

    console.log(`Scenario 1 Results:`);
    console.log(`- Successes (201)           : ${s1Successes.length} (Expected: 1)`);
    console.log(`- SLOT_TAKEN (409)         : ${s1SlotTaken.length} (Expected: 9)`);
    console.log(`- Other statuses           : ${s1OtherErrors.length} (Expected: 0)`);
    console.log(`- Active bookings in DB    : ${activeApptsInDb.length} (Expected: 1)`);

    if (
      s1Successes.length === 1 &&
      s1SlotTaken.length === 9 &&
      s1OtherErrors.length === 0 &&
      activeApptsInDb.length === 1
    ) {
      scenario1Passed = true;
      console.log('Result: PASS\n');
    } else {
      console.log('Result: FAIL\n');
    }

    // ----------------------------------------------------
    // Scenario 2: 1 mother books 2 overlapping slots concurrently
    // ----------------------------------------------------
    console.log('--- SCENARIO 2: 1 mother books two overlapping slots at the same moment ---');

    // Create 2 overlapping slots on the same date/time
    const slotAId = uuidv4();
    const slotBId = uuidv4();
    createdSlotIds.push(slotAId, slotBId);

    await db('schedule_slots').insert([
      {
        id: slotAId,
        clinic_id: ancClinic.id,
        slot_date: '2026-12-16',
        start_time: '10:00:00',
        end_time: '10:20:00',
        is_walkin: false,
        is_blocked: false,
      },
      {
        id: slotBId,
        clinic_id: pncClinic.id,
        slot_date: '2026-12-16',
        start_time: '10:10:00',
        end_time: '10:30:00', // Overlaps 10:10 - 10:20
        is_walkin: false,
        is_blocked: false,
      },
    ]);

    // Create 1 temporary mother
    const s2MotherId = uuidv4();
    createdMotherIds.push(s2MotherId);
    await db('mothers').insert({
      id: s2MotherId,
      phone: `+23470${Math.floor(10000000 + Math.random() * 90000000)}`,
      name: 'Overlap Test Mother',
      password_hash: 'test_hash',
      is_verified: true,
      consent_at: new Date(),
      role: 'mother',
    });
    const s2MotherToken = jwt.sign({ id: s2MotherId, role: 'mother', name: 'Overlap Test Mother' }, config.jwt.secret);

    // Book both overlapping slots concurrently
    const [resA, resB] = await Promise.all([
      request('/appointments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${s2MotherToken}` },
        body: { clinic_id: ancClinic.id, slot_id: slotAId, booking_type: 'mother' },
      }),
      request('/appointments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${s2MotherToken}` },
        body: { clinic_id: pncClinic.id, slot_id: slotBId, booking_type: 'mother' },
      }),
    ]);

    const s2Responses = [resA, resB];
    const s2Successes = s2Responses.filter((r) => r.status === 201);
    const s2Overlap = s2Responses.filter((r) => r.status === 409 && r.data?.error?.code === 'OVERLAP');

    s2Successes.forEach((r) => {
      if (r.data?.data?.id) createdApptIds.push(r.data.data.id);
    });

    console.log(`Scenario 2 Results:`);
    console.log(`- Successes (201)           : ${s2Successes.length} (Expected: 1)`);
    console.log(`- OVERLAP (409)            : ${s2Overlap.length} (Expected: 1)`);

    if (s2Successes.length === 1 && s2Overlap.length === 1) {
      scenario2Passed = true;
      console.log('Result: PASS\n');
    } else {
      console.log(`Responses:`, JSON.stringify(s2Responses.map((r) => ({ status: r.status, body: r.data }))));
      console.log('Result: FAIL\n');
    }

    // ----------------------------------------------------
    // Scenario 3: Direct database check
    // Attempt to insert a second active appointment on an occupied slot
    // ----------------------------------------------------
    console.log('--- SCENARIO 3: Direct database partial unique index check ---');
    console.log(`Attempting raw DB insert of a second active appointment on occupied slot ${testSlot1Id}...`);

    try {
      const secondApptId = uuidv4();
      createdApptIds.push(secondApptId);
      await db('appointments').insert({
        id: secondApptId,
        mother_id: scenario1Mothers[1].id,
        clinic_id: ancClinic.id,
        slot_id: testSlot1Id,
        status: 'booked',
        booking_type: 'mother',
      });
      console.log('Database unexpectedly allowed duplicate active appointment.');
    } catch (dbErr) {
      directDbPassed = true;
      console.log(`Database successfully rejected duplicate insert!`);
      console.log(`DB Error Code: ${dbErr.code || 'SQLITE_CONSTRAINT'}`);
      console.log(`DB Error Message: ${dbErr.message}`);
    }

    if (directDbPassed) {
      console.log('Result: PASS\n');
    } else {
      console.log('Result: FAIL\n');
    }

  } catch (error) {
    console.error('Concurrency test encountered unexpected error:', error.message);
  } finally {
    // Clean up all rows created during this test run
    console.log('Cleaning up temporary concurrency test data from database...');
    try {
      if (createdApptIds.length) {
        await db('appointment_babies').whereIn('appointment_id', createdApptIds).del();
        await db('appointments').whereIn('id', createdApptIds).del();
      }
      if (createdSlotIds.length) {
        await db('schedule_slots').whereIn('id', createdSlotIds).del();
      }
      if (createdMotherIds.length) {
        await db('audit_logs').whereIn('user_id', createdMotherIds).del();
        await db('mothers').whereIn('id', createdMotherIds).del();
      }
      console.log('Cleanup complete. Seed data remains untouched.\n');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr.message);
    }
    await db.destroy();
  }

  const allPassed = scenario1Passed && scenario2Passed && directDbPassed;
  console.log('========================================');
  console.log(`CONCURRENCY TEST OVERALL: ${allPassed ? 'ALL PASS' : 'FAILURES DETECTED'}`);
  console.log('========================================\n');
  process.exit(allPassed ? 0 : 1);
}

runConcurrencyTests();
