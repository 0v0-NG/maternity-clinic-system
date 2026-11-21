# Antenatal & Postnatal Clinic Appointment System

A full-stack, web-based appointment scheduling and live queue management system designed for antenatal and postnatal clinics in Nigerian hospitals.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons
- **Backend:** Node.js, Express, Knex.js query builder
- **Database:** PostgreSQL (Neon serverless) with SQLite local fallback
- **Authentication:** JWT with role-based access control (`mother`, `front_desk`, `midwife`, `doctor`, `admin`) & bcrypt password hashing
- **SMS Gateway:** Termii SMS API with automatic local simulation fallback
- **Task Scheduler:** `node-cron` for automated 24-hour and 2-hour appointment reminders

---

## Local Run Guide (Windows & PowerShell)

### Prerequisites
- Node.js v18.0.0 or higher
- PowerShell (Windows 10/11 default)

---

### 1. Backend Setup

Open a PowerShell terminal:

```powershell
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Copy environment variables template
Copy-Item .env.example .env
```

#### Database Option A: PostgreSQL on Neon (Default)
In `backend/.env`, set:
```env
DB_CLIENT=pg
DATABASE_URL=postgresql://<user>:<password>@<ep-project>.neon.tech/<dbname>?sslmode=require
DB_SSL=true
```

#### Database Option B: SQLite Local Fallback
To run entirely offline without cloud access, in `backend/.env`, set:
```env
DB_CLIENT=sqlite3
DATABASE_URL=
DB_SSL=false
```

#### Run Database Migrations and Seeds

```powershell
# Verify database connection without exposing secrets
npm run db:check

# Run schema migrations (creates all 11 tables)
npm run migrate

# Run initial seed data (clinics, default staff accounts)
npm run seed

# Populate schedule slots for today and the next 4 days
npm run seed:demo
```

#### Start the Backend Server

```powershell
# Start Express API server (runs on http://localhost:5000)
npm start

# OR start in development mode with auto-reload:
npm run dev
```

---

### 2. Frontend Setup

Open a second PowerShell terminal:

```powershell
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Verify/create local environment file
Copy-Item .env.example .env.local
```

Ensure `frontend/.env.local` has:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

#### Start Frontend Application

```powershell
# Start Next.js development server (runs on http://localhost:3000)
npm run dev

# OR build and run optimized production server:
npm run build
npm start
```

Open your browser to: **[http://localhost:3000](http://localhost:3000)**

---

## Automated Verification & Testing

From the `backend/` directory:

```powershell
# 1. Check database engine, server version, and table count
npm run db:check

# 2. Run unit and integration tests (uses isolated in-memory test database)
npm test

# 3. Run full end-to-end smoke test against the running API:
# Tests: Mother Registration -> OTP Verification -> Baby Creation ->
# Slot Lookup -> Booking -> Front Desk Check-In -> Live Queue ->
# Consultation Call -> Visit Completion -> Admin Report
npm run smoke
```

---

## Switching Between Neon PostgreSQL and SQLite Fallback

The backend supports zero-downtime engine toggling:

### To switch to SQLite:
1. In `backend/.env`, set:
   ```env
   DB_CLIENT=sqlite3
   DATABASE_URL=
   DB_SSL=false
   ```
2. Run `npm run migrate; npm run seed; npm run seed:demo`
3. Restart backend with `npm start`.

### To switch back to Neon PostgreSQL:
1. In `backend/.env`, set:
   ```env
   DB_CLIENT=pg
   DATABASE_URL=postgresql://<user>:<password>@<ep-project>.neon.tech/<dbname>?sslmode=require
   DB_SSL=true
   ```
2. Verify with `npm run db:check`.
3. Restart backend with `npm start`.

---

## Default Seed Credentials

All seeded accounts use password: `password123`

| Role | Name | Phone Number |
| :--- | :--- | :--- |
| **Administrator** | Admin User | `+2340000000001` |
| **Doctor** | Dr. Adebayo | `+2340000000002` |
| **Midwife** | Nurse Fatima | `+2340000000003` |
| **Front Desk** | Mr. Chukwu | `+2340000000004` |
| **Test Mother** | Fatima Bello | `+2348012345678` |

*(Note: The login page includes 1-click test buttons to populate credentials for any role instantly).*
