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
  let totalSteps = 10;

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
    const { motherId, pinId, demoOtp } = regRes.data.data;
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
    const babyId = babyRes.data.data.id;
    console.log('[PASS] Step 3: Add Baby');
    passedCount++;

    // 4. List Clinics & Slots
    const clinicsRes = await request('/clinics');
    if (clinicsRes.status !== 200 || !clinicsRes.data?.data?.length) {
      console.log(`[FAIL] Step 4: List Clinics - Status ${clinicsRes.status}`);
      process.exit(1);
    }
    // Find a clinic and date with available non-walkin slots
    let clinic = null;
    let selectedSlot = null;
    const now = new Date();
    const sortedClinics = [...clinicsRes.data.data].sort((a, b) => (b.name === 'Antenatal Clinic' ? 1 : -1));

    for (const candClinic of sortedClinics) {
      for (let d = 0; d < 7; d++) {
        const dt = new Date(now);
        dt.setDate(now.getDate() + d);
        const dateStr = dt.toISOString().split('T')[0];

        const slotsRes = await request(`/clinics/${candClinic.id}/slots?date=${dateStr}`);
        const availableList = slotsRes.data?.data?.availableSlots || [];
        if (slotsRes.status === 200 && availableList.length) {
          const available = availableList.find((s) => !s.is_walkin);
          if (available) {
            selectedSlot = { ...available, slot_date: dateStr };
            clinic = candClinic;
            break;
          }
        }
      }
      if (selectedSlot) break;
    }

    if (!selectedSlot || !clinic) {
      console.log('[FAIL] Step 4: List Slots - No unbooked slots found in the next 7 days.');
      process.exit(1);
    }
    console.log(`[PASS] Step 4: List Slots (Found slot on ${selectedSlot.slot_date} at ${selectedSlot.start_time} in ${clinic.name})`);
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
    const appointmentId = bookRes.data.data.id;
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

    // 6. Check In (Front Desk / Admin)
    const checkinRes = await request(`/appointments/${appointmentId}/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (checkinRes.status !== 200 || !checkinRes.data?.data?.queueNumber) {
      console.log(`[FAIL] Step 6: Check In - Status ${checkinRes.status}: ${JSON.stringify(checkinRes.data)}`);
      process.exit(1);
    }
    const queueNumber = checkinRes.data.data.queueNumber;
    console.log(`[PASS] Step 6: Check In (Assigned ${queueNumber})`);
    passedCount++;

    // 7. Queue Position
    const queueRes = await request(`/queue/position/${appointmentId}`, {
      headers: { Authorization: `Bearer ${motherToken}` },
    });

    if (queueRes.status !== 200 || typeof queueRes.data?.data?.position !== 'number') {
      console.log(`[FAIL] Step 7: Queue Position - Status ${queueRes.status}: ${JSON.stringify(queueRes.data)}`);
      process.exit(1);
    }
    console.log(`[PASS] Step 7: Queue Position (Position: ${queueRes.data.data.position})`);
    passedCount++;

    // 8. Mark In Consultation (Midwife / Doctor / Admin)
    const consultRes = await request(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'in_consultation' },
    });

    if (consultRes.status !== 200) {
      console.log(`[FAIL] Step 8: Mark In Consultation - Status ${consultRes.status}: ${JSON.stringify(consultRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 8: Mark In Consultation');
    passedCount++;

    // 9. Mark Completed
    const completeRes = await request(`/appointments/${appointmentId}/status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'completed' },
    });

    if (completeRes.status !== 200) {
      console.log(`[FAIL] Step 9: Mark Completed - Status ${completeRes.status}: ${JSON.stringify(completeRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 9: Mark Completed');
    passedCount++;

    // 10. Admin Report
    const reportRes = await request('/admin/reports/appointments', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (reportRes.status !== 200 || !Array.isArray(reportRes.data?.data?.clinics)) {
      console.log(`[FAIL] Step 10: Admin Report - Status ${reportRes.status}: ${JSON.stringify(reportRes.data)}`);
      process.exit(1);
    }
    console.log('[PASS] Step 10: Admin Report');
    passedCount++;

    console.log(`\n========================================`);
    console.log(`SMOKE TEST RESULT: ${passedCount}/${totalSteps} PASSED`);
    console.log(`========================================\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\nSmoke test encountered an error:`, error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(`Backend is not running at ${BASE_URL}. Start it with 'npm start' before running smoke tests.`);
    }
    process.exit(1);
  }
}

runSmokeTest();
