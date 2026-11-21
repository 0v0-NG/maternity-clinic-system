# Backend Feature Requests & API Contract Gaps

This document tracks backend discrepancies and missing endpoints identified during frontend implementation.

---

### 1. `GET /api/appointments` Omits Patient Name and Phone Number

- **Endpoint**: `GET /api/appointments`
- **Issue**:
  When called by staff (`front_desk`, `midwife`, `doctor`, `admin`), `GET /api/appointments` returns appointment objects with `mother_id`, `clinic_name`, `staff_name`, and `babies`, but **omits** `mother_name` and `mother_phone`.
- **Current Behavior in `appointment.controller.js` (`getMyAppointments`)**:
  ```javascript
  query = db('appointments')
    .join('schedule_slots', 'appointments.slot_id', 'schedule_slots.id')
    .join('clinics', 'appointments.clinic_id', 'clinics.id')
    .leftJoin('staff', 'appointments.staff_id', 'staff.id')
    .select(
      'appointments.*',
      'schedule_slots.slot_date',
      'schedule_slots.start_time',
      'schedule_slots.end_time',
      'clinics.name as clinic_name',
      'staff.name as staff_name'
    );
  ```
- **Requested Enhancement**:
  Join the `mothers` table to include patient identification for staff callers:
  ```javascript
  .join('mothers', 'appointments.mother_id', 'mothers.id')
  .select(
    ...
    'mothers.name as mother_name',
    'mothers.phone as mother_phone'
  )
  ```
- **Impact on Frontend**:
  Per instructions, the frontend does **not** make N+1 individual requests to `GET /api/mothers/:id` per row. Instead, the frontend displays what is available (`Patient ID: ...` and baby names), and filters searches using available attendee data. Once the backend adds `mother_name` and `mother_phone`, the frontend will seamlessly display and search by mother name and phone.

---

### 2. Missing Desk Registration and Patient Search for Walk-in / Phone-in Bookings

- **Required Functionality**: Front desk staff booking walk-in or telephone patients into open clinic slots.
- **Current Gaps in API**:
  1. **No Patient Search by Phone or Name**:
     - The only mother lookup endpoint is `GET /api/mothers/:id`, which requires a known internal UUID.
     - Staff cannot search for a mother by phone number or name to find her `mother_id` for booking.
     - **Requested Endpoint**: `GET /api/mothers?search=<term>` or `GET /api/mothers?phone=<phone>` accessible to `front_desk`, `midwife`, `doctor`, `admin`.
  2. **No Desk Patient Registration**:
     - The only mother creation endpoint is `POST /api/auth/register`, which is public and initiates a mobile phone OTP verification flow.
     - Staff at the hospital records desk cannot create a mother record directly when a patient arrives without an active smartphone or SMS connectivity.
     - **Requested Endpoint**: `POST /api/mothers` (Role: `front_desk`, `admin`) accepting `{ name, phone, hospital_id, hmo_number }` to register verified patients in person.
- **Frontend Action Taken**:
  In strict accordance with the contract and prompt instructions, walk-in patient creation was not improvised with invented endpoints. A clean notice informs staff that walk-in booking requires patient lookup/registration API support.
