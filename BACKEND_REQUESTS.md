# Backend Feature Requests & API Contract Gaps

This document tracks backend discrepancies and missing endpoints identified during frontend implementation.

---

### 1. [RESOLVED] `GET /api/appointments` Omits Patient Name and Phone Number

- **Endpoint**: `GET /api/appointments`
- **Resolution**:
  `appointment.controller.js` now joins the `mothers` table when the authenticated caller is staff (`front_desk`, `midwife`, `doctor`, `admin`) and includes `mother_name` and `mother_phone` on every appointment record. When a mother calls the endpoint, the query remains strictly scoped to her own records and does not join or select extra fields.

---

### 2. [RESOLVED] Desk Registration and Patient Search for Walk-in / Phone-in Bookings

- **Endpoints Implemented**:
  1. `GET /api/mothers/search?q=<term>`:
     - Accessible to `front_desk` and `admin`.
     - Validates `q` has at least 3 characters (`VALIDATION_ERROR` 422 if shorter).
     - Performs case-insensitive name substring matching (`LOWER(mothers.name) LIKE ?`) and partial phone matching with Nigerian format normalization.
     - Returns maximum 20 results with `id`, `name`, `phone`, `hospital_id`, `hmo_number`, `registered_by_staff`, and linked `babies: [{ id, name, date_of_birth, sex }]`.
     - Automatically audit-logs searches with the result count only (never logging search text).
  2. `POST /api/mothers`:
     - Accessible to `front_desk` and `admin`.
     - Requires verbal consent confirmation (`consent_confirmed: true`, 400 `CONSENT_REQUIRED` otherwise).
     - Accepts `name`, `phone` (formatted via `formatPhone`), optional `hospital_id`, and optional `hmo_number`.
     - Enforces duplicate phone conflict check (409 `CONFLICT`).
     - Adds `registered_by_staff` boolean column via migration `20240105000001_add_registered_by_staff_to_mothers.js`.
     - Creates the mother record with `is_verified: true`, `consent_at: now`, `registered_by_staff: true`, and an unusable random bcrypt password hash (login returns 401 `INVALID_CREDENTIALS`).
     - Returns 201 Created with `{ id, name, phone, hospital_id, hmo_number, registered_by_staff, created_at }`.
     - Audit-logs registration as `CREATE_MOTHER_BY_STAFF`.
  3. `POST /api/babies`:
     - Allows `front_desk` and `admin` to supply an optional `mother_id` in the request body to link the infant to that mother.
     - When called by a mother, always uses her authenticated user ID and ignores any `mother_id` in the request body.
     - Audit-logs staff baby creation as `STAFF_ADD_BABY`.
