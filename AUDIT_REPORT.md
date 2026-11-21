# Comprehensive Project Audit Report

**Project Title:** Design and Implementation of a Web-Based Appointment System with SMS Reminders for Antenatal and Postnatal Clinics in Nigeria  
**Audit Date:** November 21, 2026  
**Auditor:** Independent Technical Evaluation  
**Target Environment:** Localhost / Node.js & React (Next.js) with PostgreSQL (Neon) & SQLite local fallback  

---

## Executive Summary

This audit is a factual, code-level assessment of the Antenatal & Postnatal Appointment System prototype. All statements below reflect verified code and live test execution. No planned work is reported as done.

---

## PART 1: WHAT EXISTS

### 1. Project Directory Tree & File Inventory

```text
antenatal-postnatal-system/
├── README.md                                          # Project overview, tech stack, and setup instructions
├── AUDIT_REPORT.md                                    # This audit report
├── docs/
│   └── uml/
│       ├── er-diagram.md                              # Entity-Relationship diagram (Mermaid)
│       ├── sequence-booking.md                        # Booking & double-booking prevention sequence
│       ├── sequence-checkin.md                        # Front-desk check-in & live queue sequence
│       └── use-case-diagram.md                        # Actor-to-use-case mapping (Mother, Staff, Admin)
├── backend/
│   ├── .env                                           # Active local environment variables (secrets present)
│   ├── .env.example                                   # Template environment variables for setup
│   ├── .gitignore                                     # Git ignore list for backend
│   ├── knexfile.js                                    # Knex CLI configuration for SQLite & PostgreSQL (Neon)
│   ├── package.json                                   # Backend manifest, scripts, and dependencies
│   ├── migrations/
│   │   └── 20240101000001_initial_schema.js           # 9-table relational database migration
│   ├── seeds/
│   │   └── 01_seed_data.js                            # Seed data for clinics, staff, mothers, babies, and slots
│   ├── src/
│   │   ├── app.js                                     # Express application entry, global middleware, routes
│   │   ├── server.js                                  # HTTP server listener and cron service bootstrap
│   │   ├── config/
│   │   │   ├── database.js                            # Knex connection pool initializer (PostgreSQL / SQLite)
│   │   │   └── index.js                               # Central environment variable parser
│   │   ├── controllers/
│   │   │   ├── admin.controller.js                    # Reports, staff management, date blocking, session cancel
│   │   │   ├── appointment.controller.js              # Booking, rescheduling, cancellation, check-in, status
│   │   │   ├── auth.controller.js                     # Registration, OTP verification, login, refresh token
│   │   │   ├── baby.controller.js                     # CRUD for mother's linked babies
│   │   │   ├── clinic.controller.js                   # Clinic directory and slot availability query
│   │   │   ├── mother.controller.js                   # Mother profile retrieval and updates
│   │   │   └── queue.controller.js                    # Today's queue and live position tracking
│   │   ├── middleware/
│   │   │   ├── auth.js                                # JWT verification and role-based authorization guard
│   │   │   ├── errorHandler.js                        # Operational and unhandled error response formatter
│   │   │   └── validate.js                            # Express-validator result interceptor
│   │   ├── routes/
│   │   │   ├── admin.routes.js                        # Admin endpoints with role-guard
│   │   │   ├── appointment.routes.js                  # Appointment booking and management endpoints
│   │   │   ├── auth.routes.js                         # Public auth endpoints (register, verify, login)
│   │   │   ├── baby.routes.js                         # Mother baby profile endpoints
│   │   │   ├── clinic.routes.js                       # Clinic listing and slot discovery endpoints
│   │   │   ├── mother.routes.js                       # Mother profile endpoints
│   │   │   └── queue.routes.js                        # Queue status endpoints
│   │   ├── services/
│   │   │   ├── reminder.service.js                    # Node-cron job running every 30m for 24h/2h reminders
│   │   │   └── sms.service.js                         # Termii API client with local simulation fallback
│   │   └── utils/
│   │       └── helpers.js                             # Phone formatter (+234), queue generator, ID helpers
│   └── tests/
│       └── auth.test.js                               # Jest/Supertest integration test for auth routes
└── frontend/
    ├── .env.example                                   # Frontend env template
    ├── .env.local                                     # Active frontend local API URL config
    ├── .gitignore                                     # Git ignore list for frontend
    ├── next.config.js                                 # Next.js configuration and API rewrite proxies
    ├── package.json                                   # Frontend manifest and dependencies
    ├── postcss.config.js                              # PostCSS configuration for Tailwind CSS
    ├── tailwind.config.js                             # Tailwind design tokens and theme extensions
    ├── public/
    │   ├── manifest.json                              # Web app manifest for PWA capabilities
    │   └── icons/
    │       ├── icon-192x192.png                       # 192px PWA home-screen icon
    │       └── icon-512x512.png                       # 512px PWA splash icon
    └── src/
        ├── app/
        │   ├── globals.css                            # Global CSS and Tailwind component layer
        │   ├── layout.js                              # Root HTML layout with Toaster container
        │   ├── page.js                                # Landing page with service overview & emergency notices
        │   ├── admin/page.js                          # Administrator dashboard, clinic load, reports, block dates
        │   ├── book/page.js                           # 4-step appointment booking wizard
        │   ├── dashboard/page.js                      # Mother portal: upcoming visits, quick actions
        │   ├── login/page.js                          # Universal login page with 1-click test role credentials
        │   ├── profile/page.js                        # Mother information & baby management screen
        │   ├── queue/page.js                          # Mother live queue position tracking screen
        │   ├── register/page.js                       # Phone registration with 6-digit OTP verification
        │   └── staff/page.js                          # Front Desk check-in & Doctor/Midwife consultation room
        ├── components/
        │   ├── EmptyState.js                          # Generic empty state UI placeholder
        │   └── LoadingSpinner.js                      # Loading indicator component
        ├── hooks/
        │   └── useAuth.js                             # React Context provider for user state and tokens
        └── lib/
            └── api.js                                 # Axios HTTP client with JWT Authorization interceptor
```

---

### 2. Tech Stack Actually Used

| Layer | Library / Framework | Version (package.json) | Purpose |
|---|---|---|---|
| **Frontend Framework** | Next.js | `^14.2.0` (installed `14.2.35`) | React App Router, static site generation, API proxies |
| **UI Library** | React / React DOM | `^18.3.0` | Declarative UI rendering |
| **CSS Framework** | Tailwind CSS | `^3.4.0` | Utility-first responsive design |
| **Icons & Alerts** | Lucide React / React Hot Toast | `^0.400.0` / `^2.4.1` | UI icons and non-blocking toast notifications |
| **HTTP Client** | Axios | `^1.7.0` | Client-side API requests with auth interceptors |
| **Backend Runtime** | Node.js | v24.18.0 (active engine) | Server environment |
| **Web Framework** | Express | `^4.21.0` | REST API routing and middleware |
| **Security & Headers** | Helmet / Express Rate Limit | `^7.1.0` / `^7.4.0` | HTTP header protection and IP rate-limiting |
| **Validation** | Express Validator | `^7.2.0` | Request body schema and input validation |
| **Query Builder / ORM**| Knex.js | `^3.1.0` | Schema migrations, seeds, SQL transaction management |
| **Database Drivers** | `pg` / `sqlite3` | `^8.13.0` / `^6.0.1` | PostgreSQL driver (for Neon) & local SQLite fallback |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`) | `^9.0.2` | Signed bearer access & refresh tokens |
| **Password Hashing** | `bcryptjs` | `^2.4.3` | Salted password hashing (cost factor 12) |
| **Task Scheduler** | `node-cron` | `^3.0.3` | Recurring cron runner (every 30 mins) for SMS reminders |
| **SMS Gateway** | Termii API Client (custom service) | N/A (Fetch client) | OTP sending/verification and outbound SMS alerts |
| **Testing** | Jest / Supertest | `^29.7.0` / `^7.0.0` | Integration and unit testing |

---

### 3. Database: Schema, Constraints & Seed Data

The schema is created using a **Knex migration** file (`backend/migrations/20240101000001_initial_schema.js`). Seed data is inserted via `backend/seeds/01_seed_data.js`.

#### Relational Tables & Constraints

| Table | Columns | Primary Key | Foreign Keys | Constraints & Indexes |
|---|---|---|---|---|
| `mothers` | `id`, `phone`, `name`, `password_hash`, `hospital_id`, `hmo_number`, `is_verified`, `role`, `created_at`, `updated_at` | `id` (UUID) | None | `phone` UNIQUE, NOT NULL; `name` NOT NULL |
| `babies` | `id`, `mother_id`, `name`, `date_of_birth`, `sex`, `created_at`, `updated_at` | `id` (UUID) | `mother_id` -> `mothers(id)` ON DELETE CASCADE | `mother_id`, `name`, `date_of_birth`, `sex` NOT NULL |
| `staff` | `id`, `name`, `role`, `phone`, `password_hash`, `created_at`, `updated_at` | `id` (UUID) | None | `phone` UNIQUE, NOT NULL; `role` IN (`admin`, `front_desk`, `midwife`, `doctor`) |
| `clinics` | `id`, `name`, `slot_duration_min`, `walkin_reserve_pct`, `created_at`, `updated_at` | `id` (UUID) | None | `name` NOT NULL; `slot_duration_min` default 20; `walkin_reserve_pct` default 0.2 |
| `clinic_staff` | `clinic_id`, `staff_id` | Composite (`clinic_id`, `staff_id`) | `clinic_id` -> `clinics(id)`, `staff_id` -> `staff(id)` (CASCADE) | Many-to-many junction |
| `schedule_slots`| `id`, `clinic_id`, `staff_id`, `slot_date`, `start_time`, `end_time`, `is_walkin`, `is_blocked`, `created_at`, `updated_at` | `id` (UUID) | `clinic_id` -> `clinics(id)`, `staff_id` -> `staff(id)` | Indexes on `(clinic_id, slot_date)` and `(slot_date, start_time)` |
| `appointments` | `id`, `mother_id`, `clinic_id`, `staff_id`, `slot_id`, `status`, `booking_type`, `queue_number`, `booked_at`, `checked_in_at`, `reminder_24h_sent`, `reminder_2h_sent`, `created_at`, `updated_at` | `id` (UUID) | `mother_id`, `clinic_id`, `staff_id`, `slot_id` | Status default `'booked'`; indexes on `(mother_id, status)`, `(clinic_id, status)`, `(slot_id)` |
| `appointment_babies` | `appointment_id`, `baby_id` | Composite (`appointment_id`, `baby_id`) | `appointment_id` -> `appointments(id)`, `baby_id` -> `babies(id)` (CASCADE) | Many-to-many link supporting twins |
| `audit_logs` | `id`, `user_id`, `action`, `details`, `created_at` | `id` (UUID) | None (nullable `user_id`) | Indexes on `user_id`, `action`, `created_at` |

#### Seed Data Present in Database
* **Clinics (2):** Antenatal Clinic (20-min slots, 20% walk-in reserve), Postnatal Clinic (30-min slots, 20% walk-in reserve).
* **Staff Members (4):** Admin (`+2340000000001`), Dr. Adebayo (`+2340000000002`), Nurse Fatima (`+2340000000003`), Front Desk Mr. Chukwu (`+2340000000004`). All seeded with password hash for `password123`.
* **Mothers (1):** Mrs. Amina Bello (`+2348012345678`), verified, Hospital ID `HOSP-00123`, HMO `HMO-456`.
* **Babies (1):** Baby Bello (DOB: 2024-11-01, Female).
* **Schedule Slots (~90):** 12 Antenatal slots (08:00–12:00) and 6 Postnatal slots (13:00–16:00) generated for the next 5 consecutive weekdays.

---

### 4. API Endpoints

| Method | Path | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Registers mother account (hashed password), sends 6-digit OTP |
| `POST` | `/api/auth/verify-otp` | Public | Validates OTP, activates account (`is_verified: true`), returns JWT |
| `POST` | `/api/auth/login` | Public | Authenticates mother or staff via phone + password, returns JWT |
| `POST` | `/api/auth/refresh-token` | Public | Issues new access token from valid refresh token |
| `GET` | `/api/mothers/profile` | `mother` | Returns authenticated mother's profile and linked baby records |
| `PUT` | `/api/mothers/profile` | `mother` | Updates mother name, hospital ID, and HMO/NHIA number |
| `GET` | `/api/mothers/:id` | `admin`, `front_desk`, `midwife`, `doctor` | Returns specific mother profile and babies |
| `GET` | `/api/babies` | `mother` | Lists all babies belonging to the authenticated mother |
| `POST` | `/api/babies` | `mother` | Creates a new baby profile linked to the mother |
| `PUT` | `/api/babies/:id` | `mother` | Updates baby name, date of birth, or sex |
| `DELETE`| `/api/babies/:id` | `mother` | Deletes a baby profile |
| `GET` | `/api/clinics` | Public | Lists all clinics and configurations |
| `GET` | `/api/clinics/:id` | Public | Returns clinic details and assigned staff |
| `GET` | `/api/clinics/:id/slots` | Public | Returns available time slots for a clinic on a specific date |
| `POST` | `/api/clinics` | `admin` | Creates a new clinic |
| `PUT` | `/api/clinics/:id` | `admin` | Updates clinic slot duration or walk-in reserve percentage |
| `POST` | `/api/appointments` | `mother`, staff | Books an appointment (row lock + overlap check + SMS confirmation) |
| `GET` | `/api/appointments` | Authenticated | Lists appointments for the logged-in mother |
| `GET` | `/api/appointments/:id` | Authenticated | Retrieves appointment details and linked babies |
| `PUT` | `/api/appointments/:id/reschedule` | `mother`, staff | Reschedules to a new slot (enforces 4-hour cutoff) |
| `PUT` | `/api/appointments/:id/cancel` | `mother`, staff | Cancels an appointment (enforces 4-hour cutoff) |
| `POST` | `/api/appointments/:id/checkin` | `front_desk`, `admin` | Checks in patient, generates queue number (`ANC-001`, `PNC-001`) |
| `PUT` | `/api/appointments/:id/status` | `midwife`, `doctor`, `admin` | Updates visit status (`waiting`, `in_consultation`, `completed`, `no_show`) |
| `POST` | `/api/appointments/follow-up` | Staff | Schedules the next visit for a mother/baby |
| `GET` | `/api/queue/today/:clinicId` | Authenticated | Lists today's checked-in queue and currently serving ticket |
| `GET` | `/api/queue/position/:appointmentId` | Authenticated | Returns real-time position in line and estimated wait time |
| `GET` | `/api/admin/reports/appointments` | `admin` | Aggregates daily/weekly/monthly appointment counts per clinic |
| `GET` | `/api/admin/reports/no-shows` | `admin` | Returns no-show percentage rates per clinic |
| `GET` | `/api/admin/reports/clinic-load` | `admin` | Returns booked vs total slot occupancy percentage per clinic |
| `POST` | `/api/admin/block-date` | `admin` | Blocks all slots on a specified date for a clinic |
| `DELETE`| `/api/admin/block-date/:clinicId/:date` | `admin` | Unblocks slots on a date |
| `POST` | `/api/admin/cancel-session` | `admin` | Cancels all session bookings and triggers bulk SMS notifications |
| `GET` | `/api/admin/staff` | `admin` | Lists staff directory |
| `POST` | `/api/admin/staff` | `admin` | Creates a new staff user with hashed password |
| `PUT` | `/api/admin/staff/:id` | `admin` | Updates staff details |
| `GET` | `/api/health` | Public | System status and timestamp |
| `GET` | `/api/emergency-notice` | Public | Emergency protocol notice |

---

### 5. Frontend Pages & Role Mapping

| Route | Page Name | Primary User Role | Status & Capabilities |
|---|---|---|---|
| `/` | Landing Page | Public / Unauthenticated | Hero, how it works, emergency alerts, login/signup links |
| `/login` | Login Screen | All Users | Phone/password login, 1-click test role login buttons |
| `/register` | Registration Screen | Mother | 2-step phone registration, OTP verification input |
| `/dashboard` | Mother Dashboard | Mother | Lists upcoming appointments, baby profiles, emergency banner |
| `/book` | Booking Wizard | Mother / Staff | 4-step wizard: Clinic -> Date/Slot -> Mother/Baby/Both -> Confirm |
| `/profile` | Profile & Babies | Mother | Updates Mother Hospital ID, HMO number; adds/removes babies |
| `/queue` | Live Queue Tracker | Mother | Live queue ticket, position in line counter, estimated wait time |
| `/staff` | Staff Portal | Front Desk, Midwife, Doctor | Tab 1: Front Desk check-in; Tab 2: Doctor/Midwife call room |
| `/admin` | Admin Dashboard | Administrator | Occupancy load table, no-show rates, staff list, session cancel |

---

## PART 2: CHECK AGAINST THE PROPOSAL

| # | Proposal Requirement | Status | Evidence (File & Line) | Notes / Observations |
|---|---|---|---|---|
| 1 | Mother registration with phone number and SMS OTP | **WORKING** | `backend/src/controllers/auth.controller.js:14-91`<br>`frontend/src/app/register/page.js:25-70` | Mother registers phone + password; OTP is generated and verified before account activation. |
| 2 | Login (mother: phone/OTP; staff: email/password) | **PARTIAL** | `backend/src/controllers/auth.controller.js:100-155`<br>`frontend/src/app/login/page.js:15-38` | **Discrepancy:** Both mothers and staff log in with **phone + password**. Staff has no `email` column in DB; mothers do not use OTP for regular login. |
| 3 | Mother profile with one or more baby profiles (twins) | **WORKING** | `backend/src/controllers/baby.controller.js:9-52`<br>`frontend/src/app/profile/page.js:120-195` | `babies` table links to `mothers.id`. Full CRUD on multiple babies (twins/triplets) verified. |
| 4 | Clinics: Antenatal and Postnatal, with 20 and 30 min slots | **WORKING** | `backend/seeds/01_seed_data.js:19-24, 46-91`<br>`backend/src/controllers/clinic.controller.js:95-140` | ANC seeded with 20-min slots; PNC seeded with 30-min slots. Slots returned dynamically by date. |
| 5 | Booking for mother, baby/babies, or both in one slot | **WORKING** | `backend/src/controllers/appointment.controller.js:12-80`<br>`frontend/src/app/book/page.js:180-225` | `booking_type` (`mother`/`baby`/`both`) and multiple `baby_ids` linked via `appointment_babies`. |
| 6 | Prevention of double-booking | **WORKING** (Logical) / **PARTIAL** (Schema) | `backend/src/controllers/appointment.controller.js:17-40`<br>`backend/migrations/20240101000001_initial_schema.js:72-92` | Handled via `trx('schedule_slots').forUpdate()` and `WHERE slot_id` check. **Missing unique partial index on `appointments(slot_id)` in database schema.** |
| 7 | Rule: mother cannot hold overlapping appointments | **WORKING** | `backend/src/controllers/appointment.controller.js:42-53` | Checks for conflicting active appointments (`booked`/`checked_in`) overlapping start/end time. |
| 8 | Reschedule and cancel, with 4-hour cut-off | **PARTIAL** | `backend/src/controllers/appointment.controller.js:168-245`<br>`backend/src/utils/helpers.js:52-57` | Backend logic enforces `isWithinCutoff` (4 hours) for both. **Frontend lacks Reschedule/Cancel action buttons on the `/dashboard` UI.** |
| 9 | SMS confirmation and reminders at 24h and 2h | **WORKING** (Dual Mode) | `backend/src/services/sms.service.js:20-75`<br>`backend/src/services/reminder.service.js:15-84` | Confirmation sent on booking. Cron runs every 30m checking 24h/2h windows. Simulated to console in demo mode; calls Termii API when live key is set. |
| 10 | Reserved walk-in slots (20%) | **PARTIAL** | `backend/seeds/01_seed_data.js:68, 88`<br>`backend/src/controllers/clinic.controller.js:95-120` | Slots have `is_walkin: true`. **However, `clinic.controller.js` does NOT filter out walk-in slots from online patient queries.** |
| 11 | Front desk: today's list, check-in, no-show, walk-in | **WORKING** | `frontend/src/app/staff/page.js:140-210`<br>`backend/src/controllers/appointment.controller.js:250-290` | Front desk can view today's booked list, search patients, check-in to issue queue ticket, and launch walk-in booking. |
| 12 | Queue number at check-in and live queue status | **WORKING** | `backend/src/utils/helpers.js:8-14`<br>`frontend/src/app/queue/page.js:70-150` | Generates `ANC-001` or `PNC-001`. Mother's `/queue` page polls position and shows estimated wait time. |
| 13 | Midwife/doctor daily list with status updates | **WORKING** | `frontend/src/app/staff/page.js:215-310`<br>`backend/src/controllers/appointment.controller.js:300-325` | Staff view shows waiting lounge queue; buttons to "Call In" (`in_consultation`) and "Finish" (`completed`). |
| 14 | Admin: clinics, staff, schedules, blocked dates, cancel session, reports | **WORKING** | `frontend/src/app/admin/page.js`<br>`backend/src/controllers/admin.controller.js` | Load occupancy %, no-show rates, staff list, date blocking, and session cancellation with bulk SMS dispatch. |
| 15 | Appointment history (upcoming and past; no deletion) | **PARTIAL** | `backend/src/controllers/appointment.controller.js:85-135`<br>`frontend/src/app/dashboard/page.js:32-35` | Backend queries history and forbids deletion. **Frontend dashboard only displays `upcoming: true`, with no tab for past visits.** |
| 16 | Clinic info page with address and map link | **MISSING** | `frontend/src/app/` (No page found) | No clinic address, contact info, or Google Map view exists in the codebase. |
| 17 | Follow-up booking by staff for the next visit | **PARTIAL** | `backend/src/routes/appointment.routes.js:61-71`<br>`frontend/src/app/staff/page.js:77-84` | Backend endpoint `POST /api/appointments/follow-up` exists. **Frontend staff screen lacks a follow-up booking modal after consultation.** |
| 18 | Emergency notice banner | **WORKING** | `frontend/src/app/page.js:78-85`<br>`frontend/src/app/dashboard/page.js:145-150` | Red emergency warning banner displayed prominently on both landing and dashboard screens. |
| 19 | HMO/NHIA number captured | **WORKING** | `backend/migrations/20240101000001_initial_schema.js:13`<br>`frontend/src/app/profile/page.js:94-106` | Recorded on mother's profile (unverified per proposal spec). |
| 20 | Consent checkbox, RBAC, hashed passwords, audit log | **PARTIAL** | `backend/src/middleware/auth.js`<br>`backend/migrations/20240101000001_initial_schema.js:102-112` | RBAC, bcrypt hashing, and audit logging are implemented. **NDPA 2023 parental consent checkbox is missing on registration.** |
| 21 | Mobile-first / PWA behaviour | **PARTIAL** | `frontend/public/manifest.json`<br>`frontend/tailwind.config.js` | Tailwind responsive design and PWA manifest exist. **No service worker (`sw.js`) offline caching is configured.** |

#### Extra Scope Verification
* **Online Payment:** NONE (Confirmed strictly absent per proposal).
* **Clinical Notes / Diagnoses / Prescriptions:** NONE (Confirmed strictly absent).
* **GPS / Location Tracking:** NONE (Confirmed strictly absent).
* **In-App Notification Center:** NONE (Only SMS simulated/real).
* **Extra Feature Built:** "Prototype Fast Logins" panel on `/login` screen (added to facilitate multi-role grading and testing).

---

## PART 3: RUN IT

### 1. Exact Commands to Install, Setup & Run

#### Prerequisites
* Node.js v18+ (tested on v24.18.0) and npm v10+

#### Backend Setup
```powershell
cd "C:\Users\USER\.gemini\antigravity\scratch\antenatal-postnatal-system\backend"
copy .env.example .env
npm install
npx knex migrate:latest
npx knex seed:run
npm run dev
```

#### Frontend Setup
```powershell
cd "C:\Users\USER\.gemini\antigravity\scratch\antenatal-postnatal-system\frontend"
copy .env.example .env.local
npm install
npm run dev
```

### 2. Execution & Test Verification Results

* **Backend Unit & Integration Tests:**
  * Command: `npm test`
  * Result: **PASS** (1 test suite, 4 tests passed in 20.8s).
  * Passed Tests: `POST /api/auth/register` (missing phone validation, short password validation), `POST /api/auth/login` (empty fields validation), `GET /api/health` (200 OK).
* **Frontend Production Build:**
  * Command: `npm run build`
  * Result: **PASS** (`next build` compiled all 10 routes into optimized static pages with 0 errors).
* **End-to-End Integration Run:**
  * Verified live execution: User registration -> OTP verification -> Baby profile addition -> Slot discovery -> Appointment booking -> Front-desk check-in -> Queue position tracking.

### 3. Environment Variables Used

#### Backend (`backend/.env`)
* `NODE_ENV`
* `PORT`
* `DB_CLIENT` (options: `sqlite3` or `pg`)
* `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (for local PostgreSQL)
* `DATABASE_URL` (for Neon cloud PostgreSQL)
* `DB_SSL`
* `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
* `SMS_API_KEY`, `SMS_SENDER_ID`
* `CANCEL_CUTOFF_HOURS`, `WALKIN_RESERVE_PCT`, `REMINDER_HOURS`

#### Frontend (`frontend/.env.local`)
* `NEXT_PUBLIC_API_URL`

---

## PART 4: PROBLEMS & VULNERABILITIES

### High Priority

| Problem | Location | Description |
|---|---|---|
| **Absence of Database-Level Unique Constraint on Slots** | `backend/migrations/20240101000001_initial_schema.js` | Double booking prevention relies entirely on application-level transactions and row-locking (`forUpdate()`). There is no database-level partial unique index (`UNIQUE(slot_id) WHERE status IN ('booked', 'checked_in')`). Concurrent requests on non-Postgres engines or unisolated queries could theoretically double-book. |
| **PostgreSQL-Specific Cast in Reminder Service** | `backend/src/services/reminder.service.js:55` | Line 55 uses `::timestamp` raw casting (`(slot_date || ' ' || start_time)::timestamp`). While functional on Neon PostgreSQL, this will crash with a syntax error if run against local SQLite. |
| **Hardcoded Secret Fallback in Config** | `backend/src/config/index.js:20` | If `JWT_SECRET` is omitted from `.env`, the server defaults to `'dev-secret-change-me'`. Refresh token generation also uses simple string concatenation (`secret + '_refresh'`). |

### Medium Priority

| Problem | Location | Description |
|---|---|---|
| **Walk-In Slot Reservation Leakage** | `backend/src/controllers/clinic.controller.js:95-140` | `getAvailableSlots` returns all unbooked slots including those marked `is_walkin: true`. Online booking does not restrict mothers from booking reserved walk-in slots. |
| **Missing UI Action Triggers for Completed APIs** | `frontend/src/app/dashboard/page.js`<br>`frontend/src/app/staff/page.js` | The backend implements Rescheduling, Cancellation, and Follow-Up booking, but the frontend lacks buttons on the Dashboard to reschedule/cancel, and lacks a follow-up booking popup after consultation. |
| **Missing NDPA 2023 Consent Agreement** | `frontend/src/app/register/page.js` | No explicit checkbox or disclaimer acknowledging parental consent for storing child and pregnancy records under NDPA 2023. |
| **Insecure Client-Side Token Storage** | `frontend/src/lib/api.js:10`<br>`frontend/src/hooks/useAuth.js:23` | JWT access tokens are stored in browser `localStorage`, making them accessible to potential cross-site scripting (XSS) vectors. |

### Low Priority

| Problem | Location | Description |
|---|---|---|
| **Discrepancy in Login Credentials Specification** | `backend/src/controllers/auth.controller.js:100` | Staff logs in with Phone/Password rather than Email/Password as described in early academic notes. |
| **Empty Architecture Folder** | `backend/src/models/` | Folder is empty because database operations are performed directly via Knex query builder inside controllers. |
| **Reminder Window Skip Risk** | `backend/src/services/reminder.service.js:46` | The 30-minute cron checks a $\pm 15$ minute window. An appointment booked less than 24 hours in advance will completely miss the 24-hour reminder without a retroactive trigger. |

---

## PART 5: SUMMARY FOR SUPERVISOR MEETING

### 1. Plain-English Summary (10 Lines)
1. The project has an active full-stack prototype implementing the core booking and queue engine.
2. Mothers can register with a phone number, verify with a 6-digit OTP, and manage linked baby profiles (including twins).
3. Online booking allows selecting Antenatal (20-min) or Postnatal (30-min) clinics for Mother, Baby, or Both.
4. Double-booking prevention and overlap detection are enforced in backend database transactions.
5. Automated SMS confirmations and 24h/2h reminders are handled by a cron service with Termii API / local simulation.
6. Front-desk staff can search arriving mothers and check them in to generate sequential queue tickets (`ANC-001`).
7. Mothers can track their live queue position and estimated wait time directly from their phones.
8. Doctors and midwives have a consultation room interface to call patients in, complete visits, or mark no-shows.
9. Administrators can view real-time clinic load, occupancy rates, no-show metrics, and block or cancel sessions with bulk SMS.
10. The system strictly adheres to project boundaries: no online payments, no medical records, and single-hospital scope.

### 2. Completion Percentage by Role

| Role | Estimated Completion | Reasoning |
|---|---|---|
| **Mother** | **80%** | Registration, OTP, profile, baby management, 4-step booking, and live queue tracking work. Deductions: Dashboard lacks UI buttons to trigger reschedule/cancel and lacks past history tab; missing NDPA consent checkbox. |
| **Front Desk** | **85%** | Today's arrival list, patient search, 1-click check-in with ticket generation, and walk-in booking links work. Deductions: Walk-in slots are not strictly fenced from online mothers. |
| **Midwife / Doctor** | **80%** | Live queue monitoring, calling patients in (`in_consultation`), completing visits, and marking no-shows work. Deductions: Follow-up booking API exists but lacks an automated modal trigger after completing a visit. |
| **Administrator** | **80%** | Occupancy load tables, no-show reports, staff directory, date blocking, and session cancellation with bulk SMS work. Deductions: Creating new clinics and modifying slot durations is API-only (no UI form on admin page). |

### 3. Five-Minute Demo Script

* **Minute 1: Landing Page & Mother Registration**
  * Open `http://localhost:3000`. Show the mobile-friendly hero, clinic service breakdown, and emergency notice banner.
  * Click **Sign Up**. Enter name `Halima Garba`, phone `08031112233`, password `password123`.
  * Show the simulated OTP toast notification (`123456`), enter it, and verify into the dashboard.
* **Minute 2: Baby Profile & Appointment Booking**
  * In the dashboard, click **My Profile**. Add a baby: `Baby Hassan`, DOB `2024-10-01`, Male. Enter Hospital ID `HOSP-7788`.
  * Click **Book Appointment**. Select **Postnatal Clinic** (30 mins). Pick today's date and time slot `13:00 - 13:30`.
  * Select booking for **Mother & Baby**, tick `Baby Hassan`, and confirm. Show the simulated SMS confirmation.
* **Minute 3: Front Desk Check-In**
  * Click **Log Out**, go to `/login`, and click the **"🧑‍💼 Front Desk"** 1-click button.
  * On `/staff`, locate `Halima Garba` under "Booked Appointments Awaiting Arrival".
  * Click **"Check In Patient"**. Show the generated queue ticket: `PNC-001`.
* **Minute 4: Live Queue Tracker**
  * Open an incognito window, log back in as `Halima Garba` (or use `/queue`), and show the live queue screen.
  * Show the ticket `PNC-001`, position `#1 in line`, and estimated wait time `0m`.
* **Minute 5: Doctor Consultation & Admin Reports**
  * In the staff window, switch to the **"Doctor / Midwife Queue"** tab.
  * Click **"📞 Call Patient In"**. Show the status transition to `In Consultation` (and the mother's screen updating to *"It's Your Turn!"*).
  * Click **"✓ Finish Consultation"**.
  * Switch to `/login`, click **"🔧 Administrator"**, and demonstrate the **Clinic Load Table** showing booked slots and the **No-Show Rate** table.

### 4. Top 5 Priorities to Fix Next

1. **Add Reschedule and Cancel buttons to the Mother Dashboard UI** to expose the existing backend cutoff and cancellation logic.
2. **Add a database-level partial unique index** (`UNIQUE (slot_id) WHERE status IN ('booked', 'checked_in')`) to provide ironclad double-booking prevention at the storage engine level.
3. **Filter out `is_walkin: true` slots** from the patient slot availability endpoint so the 20% walk-in quota is strictly reserved for front-desk use.
4. **Add a Follow-Up Booking Modal** on the Doctor/Midwife screen immediately following visit completion.
5. **Add an NDPA 2023 Consent Checkbox** on the registration and baby creation screens to satisfy Nigerian statutory data protection requirements.
