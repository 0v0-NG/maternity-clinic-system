# Frontend Test Checklist & Verification Guide

This document defines click-by-click manual testing procedures for verifying the frontend appointment system for antenatal and postnatal clinics.

---

## Environment Setup
1. **Backend Server**: Running at `http://localhost:5000/api`. Verify via `curl http://localhost:5000/api/health`.
2. **Frontend Dev Server**: Running at `http://localhost:3000`.
3. **Demo SMS OTP**: Set to `123456`.
4. **Timezone**: All dates and times are presented in Nigerian Time (`Africa/Lagos` UTC+1).

---

## Step 1 & 2: Authentication & Foundation (Recap)
- [x] NDPA 2023 Consent checkbox is mandatory on `/register`.
- [x] Input layout alignment for "Hospital ID" and "HMO / NHIA no.".
- [x] Safe JSON parsing in `useAuth.js` with fallback for missing/corrupt storage.
- [x] OTP single-flight submission preventing double submit toasts.
- [x] Automatic session redirection based on user role.

---

## Step 3: Mother Home and Appointments

### 3.0 Token & Auth Storage Verification
1. Navigate to `http://localhost:3000/register`.
2. Fill in registration details:
   - Full Name: `Test Mother`
   - Phone: Unique 11-digit number (e.g. `080` + 8 random digits)
   - Hospital ID: `HOSP-TEST-001` (optional)
   - HMO / NHIA no.: `HMO-TEST-001` (optional)
   - Password: `Password123!`
   - Confirm Password: `Password123!`
   - Check statutory NDPA consent box.
3. Click **Create Account**.
4. Enter OTP `123456` in the 6-digit OTP fields.
5. Account verifies with single success toast: *"Your account is verified. Welcome!"*.
6. Open Browser DevTools -> **Application** tab -> **Storage**:
   - `sessionStorage`:
     - Key `token` contains a valid JWT access token string.
   - `localStorage`:
     - Key `refreshToken` contains a valid JWT refresh token string.
     - Key `user` contains valid JSON: `{"id": "...", "name": "Test Mother", "phone": "+234...", "role": "mother", "is_verified": true}`.
7. Reload page: Visitor remains logged in as Mother on `/dashboard`.

---

### 3.1 Mother Dashboard (`/dashboard`)
1. **Access Control**:
   - Open an incognito browser window and go to `http://localhost:3000/dashboard`.
   - **Expected**: Immediately redirected to `http://localhost:3000/login`.
   - Log in with staff credentials (`08011112222` / `password123`).
   - **Expected**: Redirected away from `/dashboard` to `/staff` (or `/admin`).
2. **Greeting & Header**:
   - Log in as mother. Lands on `/dashboard`.
   - Header shows clinic brand and personalized greeting: *"Hello, Test 👋"*.
   - Logout button in header properly clears storage and returns to `/login`.
3. **Emergency Notice**:
   - Top of screen displays red Emergency Notice banner: *"Labour or an emergency? Go straight to the Emergency Unit."*.
4. **Empty State (Initial)**:
   - Before any appointment is booked, the Next Appointment card shows:
     - Calendar icon.
     - Title: *"No Upcoming Appointment"*.
     - Description: *"You have no visits scheduled right now. Book your next visit with the clinic easily."*.
     - 48px green button: **Book Appointment** linking to `/book`.
5. **Quick Actions**:
   - Four touch-friendly cards:
     - **Book Appointment** -> links to `/book`.
     - **My Appointments** -> links to `/appointments`.
     - **Live Queue** -> links to `/queue`.
     - **My Profile** -> links to `/profile`.
6. **Bottom Navigation**:
   - Fixed bottom bar shows 4 tabs: **Home**, **Book**, **Appointments**, **Profile**.
   - "Home" is highlighted in Nigerian green (`text-primary-500 font-bold`).

---

### 3.2 Booking a Test Appointment (at least 5 Hours Ahead)
To test cancellation and rescheduling rules, create an appointment far enough ahead to satisfy the 4-hour cutoff rule:

1. Click **Book Appointment** from the dashboard or navigate to `http://localhost:3000/book`.
2. **Step 1 - Select Clinic**:
   - Click **Antenatal Clinic** (or **Postnatal Clinic**).
3. **Step 2 - Select Date & Time**:
   - In the date input, pick a date **at least 1 day in the future** (e.g. tomorrow or two days ahead).
   - Available slot chips load dynamically (e.g. `08:00:00 - 08:20:00`).
   - Click an available slot chip (e.g. morning slot).
4. **Step 3 - Booking Type**:
   - Select **Mother** (or add baby if Postnatal Clinic).
5. **Step 4 - Confirm**:
   - Review clinic, date, time, and attendee.
   - Click **Confirm Booking**.
   - Toast appears: *"Appointment booked! You will receive an SMS confirmation."*.
   - Page redirects to `/dashboard`.
6. **Dashboard Next Appointment Card**:
   - Next Appointment card now displays:
     - Clinic Name (e.g. *"Antenatal Clinic"*).
     - Date in `DD/MM/YYYY` format (e.g. `23/11/2026`).
     - Time in 12-hour format (e.g. `8:00 AM – 8:20 AM`).
     - Green **Booked** badge.
     - Attendee info: *"For: Mother"*.
     - Button: **View Appointment Details** linking to `/appointments/[id]`.

---

### 3.3 Appointments List (`/appointments`)
1. Click **My Appointments** or navigate to `http://localhost:3000/appointments`.
2. **Upcoming Tab**:
   - "Upcoming" tab is active by default.
   - The booked appointment card displays:
     - Clinic name.
     - Scheduled date in `DD/MM/YYYY` format.
     - Scheduled time range in 12-hour Lagos time (`h:mm AM/PM – h:mm AM/PM`).
     - StatusBadge (`Booked`).
     - Late badge: Only visible if `late_arrival: true` (amber `LATE` badge).
     - Attendee breakdown (`For: Mother`).
     - Three action buttons (48px touch-friendly):
       - **View** (opens detail page).
       - **Reschedule** (opens reschedule modal with SlotPicker).
       - **Cancel** (opens cancellation confirmation modal).
3. **Past Tab**:
   - Click **Past History** tab.
   - If no past visits: shows empty state *"No Past Appointments"*.
   - When past visits exist: cards show clinic, date, time, status (`Completed`, `Cancelled`, `No Show`), and only the **View** button.
   - **Verification**: Confirm there is **no delete button** anywhere on either tab.
4. **Bottom Nav**:
   - Bottom nav highlights **Appointments** tab in green.

---

### 3.4 Appointment Details Page (`/appointments/[id]`)
1. Click **View** on an upcoming appointment card.
2. Lands on `http://localhost:3000/appointments/<uuid>`.
3. Verify page elements:
   - Header with **Back Arrow** button (navigates back to `/appointments`).
   - Top Emergency Notice banner.
   - Clinic session name and large StatusBadge.
   - Scheduled date in `DD/MM/YYYY`.
   - Scheduled time range in 12-hour format with label `(12-Hour Lagos Time)`.
   - **Queue Ticket**: Displays *"Not checked in (ticket assigned at clinic desk)"* prior to check-in, or queue ticket number (e.g. `PNC-001`) if checked in.
   - **Attending Staff**: Displays assigned doctor/midwife name or *"Assigned on arrival"*.
   - **Visit Type**: Displays *"Mother"*, *"Baby (Baby Name)"*, or *"Mother & Baby"*.
   - **Booked On**: Shows full timestamp in `DD/MM/YYYY, h:mm AM/PM`.
   - Actions: **Reschedule Appointment** and **Cancel Appointment** buttons are visible for `booked` appointments.

---

### 3.5 Rescheduling Flow & Reusable SlotPicker
1. On `/appointments` or `/appointments/[id]`, click **Reschedule**.
2. **Reschedule Modal** opens:
   - Header: *"Reschedule Appointment"*.
   - Shows current slot date and time.
   - Explains 4-hour policy rule.
3. **SlotPicker Functionality**:
   - Shows horizontal date carousel of 14 days (all days selectable, none disabled by static weekdays).
   - Click a date pill (e.g. 3 days ahead):
     - Loading skeleton displays while fetching `GET /api/clinics/:id/slots?date=YYYY-MM-DD`.
     - Available slot chips render with 12-hour time (e.g. `8:20 AM`, `8:40 AM`).
     - If no slots exist on that date: displays *"No available slots on this day, please try another date"*.
   - Current appointment slot is excluded from selection.
4. Click a slot chip:
   - Chip turns solid green with outline.
   - Preview updates: *"New slot selected: 8:40 AM"*.
   - **Confirm Reschedule** button becomes active.
5. Click **Confirm Reschedule**:
   - Button shows loading state *"Rescheduling..."*.
   - On success: Toast displays *"Appointment rescheduled successfully."*.
   - Modal closes and appointment card updates to the new date and time.
6. **Error Code Handling**:
   - `SLOT_TAKEN`: If another user took the slot, displays *"Another patient just took this slot. Please choose another time."*, refreshes slot list automatically, and deselects the taken slot.
   - `CUTOFF_PASSED`: If attempting to reschedule within 4 hours of start time, displays *"Appointments cannot be cancelled or rescheduled within 4 hours of the start time. Please contact the front desk."*.
   - `OVERLAP`: Displays *"You already have an appointment at this time."*.
   - `SLOT_RESERVED`: Displays *"This slot is reserved for hospital walk-in patients. Please choose another."*.

---

### 3.6 Cancellation Flow & 4-Hour Rule
1. On an appointment scheduled at least 5 hours ahead, click **Cancel**.
2. **Cancel Modal** opens:
   - Warning icon and title *"Cancel Appointment"*.
   - Appointment summary: clinic, date, time.
   - Notice: *"Hospital policy requires appointments to be cancelled at least 4 hours before your scheduled slot. Cancelling immediately releases this slot for another mother."*.
   - Optional reason textarea field.
   - Two buttons: **Keep Visit** (secondary) and **Confirm Cancel** (danger red).
3. Click **Keep Visit**: Modal closes with no changes made.
4. Click **Cancel** again, optionally enter a reason (e.g. *"Schedule conflict"*), and click **Confirm Cancel**:
   - Button shows *"Cancelling..."*.
   - Toast displays *"Appointment cancelled successfully."*.
   - Modal closes.
5. **List Verification**:
   - In `/appointments`: The cancelled appointment immediately leaves the "Upcoming" tab.
   - Switch to **Past History** tab: The appointment appears with a red **Cancelled** badge.
   - Only the **View** button is available on the cancelled card.
6. **4-Hour Cutoff Validation**:
   - If attempting to cancel an appointment starting in less than 4 hours:
   - Backend returns `400 CUTOFF_PASSED`.
   - Modal displays: *"Appointments cannot be cancelled within 4 hours of the start time. Please contact the front desk."*.
   - Appointment remains booked and active.
