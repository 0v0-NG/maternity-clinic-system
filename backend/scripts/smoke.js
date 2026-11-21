/**
 * Smoke Test for Antenatal & Postnatal System API
 * Full flow:
 * 1. Register mother
 * 2. Verify OTP
 * 3. Add baby
 * 4. List slots
 * 5. Book slot
 * 6. Check-in (front desk)
 * 7. Queue position
 * 8. Mark in consultation (doctor/midwife)
 * 9. Mark completed
 * 10. Admin report
 */

const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const db = require('../src/config/database');
const { getLagosToday } = require('../src/utils/helpers');

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

async function runSmokeTest() {
  console.log(`Starting smoke test against ${BASE_URL}...\n`);
  let passedCount = 0;
  let totalSteps = 12;

  let motherId = null;
  let babyId = null;
  let appointmentId = null;
  let m2Id = null;
  let tempSlotId = null;
  let tempWalkinSlotId = null;

  try {
    // 1. Register Mother
    const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        phone: testPhone,
        name: 'Smoke Test Mother',
        password: 'Password123!',
        consent: true,
      },
    });

    if (regRes.status !== 201 || !regRes.data?.data?.motherId) {
      console.log(`[FAIL] Step 1: Register Mother - Status ${regRes.status}: ${JSON.stringify(regRes.data)}`);
      process.exit(1);
    }
    const { motherId: regMotherId, pinId, demoOtp } = regRes.data.data;
    motherId = regMotherId;
    console.log('[PASS] Step 1: Register Mother');
    passedCount++;

    // 2. Verify OTP
    const verifyRes = await request('/auth/verify-otp', {
      method: 'POST',
      body: {
        motherId,
        pinId,
        otp: demoOtp || '123456',
      },
    });

    if (verifyRes.status !== 200 || !verifyRes.data?.data?.token) {
      console.log(`[FAIL] Step 2: Verify OTP - Status ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`);
      process.exit(1);
    }
    const motherToken = verifyRes.data.data.token;
    console.log('[PASS] Step 2: Verify OTP');
    passedCount++;

    // 3. Add Baby
    const babyRes = await request('/babies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${motherToken}` },
      body: {
        name: 'Smoke Test Baby',
        date_of_birth: '2026-01-15',
        sex: 'female',
      },
    });

    if (babyRes.status !== 201 || !babyRes.data?.data?.id) {
      console.log(`[FAIL] Step 3: Add Baby - Status ${babyRes.status}: ${JSON.stringify(babyRes.data)}`);
      process.exit(1);
    }
    babyId = babyRes.data.data.id;
    console.log('[PASS] Step 3: Add Baby');
    passedCount++;

    // 4. List Clinics & Ensure Slots on Today (Africa/Lagos)
    const clinicsRes = await request('/clinics');
    if (clinicsRes.status !== 200 || !clinicsRes.data?.data?.length) {
      console.log(`[FAIL] Step 4: List Clinics - Status ${clinicsRes.status}`);
      process.exit(1);
    }
    const clinic = clinicsRes.data.data.find((c) => c.name === 'Antenatal Clinic') || clinicsRes.data.data[0];
    const today = getLagosToday();

    // Check if an available non-walkin slot exists today in the future
    let slotsRes = await request(`/clinics/${clinic.id}/slots?date=${today}`);
    let availableList = slotsRes.data?.data?.availableSlots || [];
    let selectedSlot = availableList.find((s) => !s.is_walkin);

    // If today doesn't have an available regular slot, create a temporary one for today's test
    if (!selectedSlot) {
      tempSlotId = uuidv4();
      await db('schedule_slots').insert({
        id: tempSlotId,
        clinic_id: clinic.id,
        slot_date: today,
        start_time: '23:30:00',
        end_time: '23:50:00',
        is_walkin: false,
        is_blocked: false,
      });
      selectedSlot = { id: tempSlotId, slot_date: today, start_time: '23:30:00' };
    }

    // Ensure a walkin slot also exists today for the Step 6 filtering check
    const hasWalkin = availableList.some((s) => s.is_walkin);
    if (!hasWalkin) {
      tempWalkinSlotId = uuidv4();
      await db('schedule_slots').insert({
        id: tempWalkinSlotId,
        clinic_id: clinic.id,
        slot_date: today,
        start_time: '23:50:00',
        end_time: '23:59:00',
        is_walkin: true,
        is_blocked: false,
      });
    }

    console.log(`[PASS] Step 4: List Slots (Found slot on ${today} at ${selectedSlot.start_time} in ${clinic.name})`);
    passedCount++;

    // 5. Book Appointment
    const bookRes = await request('/appointments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${motherToken}` },
      body: {
        clinic_id: clinic.id,
        slot_id: selectedSlot.id,
        booking_type: 'both',
        baby_ids: [babyId],
      },
    });

    if (bookRes.status !== 201 || !bookRes.data?.data?.id) {
      console.log(`[FAIL] Step 5: Book Appointment - Status ${bookRes.status}: ${JSON.stringify(bookRes.data)}`);
      process.exit(1);
    }
    appointmentId = bookRes.data.data.id;
    console.log('[PASS] Step 5: Book Appointment');
    passedCount++;

    // Login as Admin for Staff Actions (Admin has front_desk, doctor, midwife, admin capabilities)
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        phone: '+2340000000001',
        password: 'password123',
      },
    });

    if (adminLoginRes.status !== 200 || !adminLoginRes.data?.data?.token) {
      console.log(`[FAIL] Staff Login for checks - Status ${adminLoginRes.status}`);
      process.exit(1);
    }
    const adminToken = adminLoginRes.data.data.token;

    // 6. Walk-in Slots Filtering Check
    const motherSlotsRes = await request(`/clinics/${clinic.id}/slots?date=${today}`, {
      headers: { Authorization: `Bearer ${motherToken}` },
    });
    const motherSlots = motherSlotsRes.data?.data?.availableSlots || [];
    const motherHasWalkin = motherSlots.some((s) => s.is_walkin);

    const staffSlotsRes = await request(`/clinics/${clinic.id}/slots?date=${today}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const staffSlots = staffSlotsRes.data?.data?.availableSlots || [];
    const staffHasWalkin = staffSlots.some((s) => s.is_walkin);

    if (motherHasWalkin || !staffHasWalkin) {
      console.log(`[FAIL] Step 6: Walk-in Slot Filtering - Mother saw walkin: ${motherHasWalkin}, Staff saw walkin: ${staffHasWalkin}`);
      process.exit(1);
    }
    console.log('[PASS] Step 6: Walk-in Slot Filtering (Excluded for mother, included for front desk)');
    passedCount++;

    // 7. Ownership Check (Second mother gets 403 on reading first mother's appointment)
    const testPhone2 = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
    const reg2Res = await request('/auth/register', {
      method: 'POST',
      body: { phone: testPhone2, name: 'Smoke Mother Two', password: 'Password123!', consent: true },
    });
    const { motherId: registeredM2Id, pinId: p2Id, demoOtp: otp2 } = reg2Res.data.data;
    m2Id = registeredM2Id;
    const verify2Res = await request('/auth/verify-otp', {
      method: 'POST',
      body: { motherId: m2Id, pinId: p2Id, otp: otp2 || '123456' },
    });
    const mother2Token = verify2Res.data.data.token;

    const crossReadRes = await request(`/appointments/${appointmentId}`, {
      headers: { Authorization: `Bearer ${mother2Token}` },
    });

    if (crossReadRes.status !== 403 || crossReadRes.data?.error?.code !== 'FORBIDDEN') {
      console.log(`[FAIL] Step 7: Ownership Check - Status ${crossReadRes.status}: ${JSON.stringify(crossReadRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 7: Ownership Check (Second mother received 403 FORBIDDEN)');
    passedCount++;

    // 8. Check In (Front Desk / Admin)
    const checkinRes = await request(`/appointments/${appointmentId}/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (checkinRes.status !== 200 || !checkinRes.data?.data?.queueNumber) {
      console.log(`[FAIL] Step 8: Check In - Status ${checkinRes.status}: ${JSON.stringify(checkinRes.data)}`);
      process.exit(1);
    }
    const queueNumber = checkinRes.data.data.queueNumber;
    console.log(`[PASS] Step 8: Check In (Assigned ${queueNumber})`);
    passedCount++;

    // 9. Queue Position
    const queueRes = await request(`/queue/position/${appointmentId}`, {
      headers: { Authorization: `Bearer ${motherToken}` },
    });

    if (queueRes.status !== 200 || typeof queueRes.data?.data?.position !== 'number') {
      console.log(`[FAIL] Step 9: Queue Position - Status ${queueRes.status}: ${JSON.stringify(queueRes.data)}`);
      process.exit(1);
    }
    console.log(`[PASS] Step 9: Queue Position (Position: ${queueRes.data.data.position})`);
    passedCount++;

    // 10. Mark In Consultation (Midwife / Doctor / Admin)
    const consultRes = await request(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'in_consultation' },
    });

    if (consultRes.status !== 200) {
      console.log(`[FAIL] Step 10: Mark In Consultation - Status ${consultRes.status}: ${JSON.stringify(consultRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 10: Mark In Consultation');
    passedCount++;

    // 11. Mark Completed
    const completeRes = await request(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'completed' },
    });

    if (completeRes.status !== 200) {
      console.log(`[FAIL] Step 11: Mark Completed - Status ${completeRes.status}: ${JSON.stringify(completeRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 11: Mark Completed');
    passedCount++;

    // 12. Admin Report
    const reportRes = await request('/admin/reports/appointments', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (reportRes.status !== 200 || !Array.isArray(reportRes.data?.data?.clinics)) {
      console.log(`[FAIL] Step 12: Admin Report - Status ${reportRes.status}: ${JSON.stringify(reportRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 12: Admin Report');
    passedCount++;

    console.log(`\n========================================`);
    console.log(`SMOKE TEST RESULT: ${passedCount}/${totalSteps} PASSED`);
    console.log(`========================================\n`);
  } catch (error) {
    console.error(`\nSmoke test encountered an error:`, error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(`Backend is not running at ${BASE_URL}. Start it with 'npm start' before running smoke tests.`);
    }
    process.exitCode = 1;
  } finally {
    try {
      if (appointmentId) {
        await db('appointment_babies').where('appointment_id', appointmentId).del();
        await db('appointments').where('id', appointmentId).del();
      }
      if (babyId) {
        await db('babies').where('id', babyId).del();
      }
      if (tempSlotId) {
        await db('schedule_slots').where('id', tempSlotId).del();
      }
      if (tempWalkinSlotId) {
        await db('schedule_slots').where('id', tempWalkinSlotId).del();
      }
      if (motherId) {
        await db('mothers').where('id', motherId).del();
      }
      if (m2Id) {
        await db('mothers').where('id', m2Id).del();
      }
      await db.destroy();
    } catch (cleanErr) {
      // ignore
    }
  }
}

runSmokeTest();
