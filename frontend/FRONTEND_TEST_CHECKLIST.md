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


---

## Step 4: Booking Wizard (`/book`)

### 4.0 Access Control & Route Guard
1. In an unauthenticated browser / incognito tab, navigate directly to `http://localhost:3000/book`.
   - **Expected**: Immediately redirected to `/login`.
2. Log in with a staff account (e.g. `08011112222` / `password123`).
   - **Expected**: Redirected away to `/staff` (or `/admin`).
3. Log in as a registered mother.
   - **Expected**: Successfully access `/book`. The wizard displays header *"Book Appointment"*, *"Step 1 of 3"*, and visual progress bar at 33%. Top displays EmergencyNotice; bottom displays MotherBottomNav with "Book" active.

---

### 4.1 Scenario 1: Antenatal Clinic Booking (Mother Only)
1. **Step 1 - Clinic & Who It Is For**:
   - In "1. Choose Clinic", click on **Antenatal Clinic**.
   - Notice appears under "2. Who is this visit for?": *"Antenatal visits are for the mother only."*.
   - Confirm: There are no baby checkboxes or baby addition options shown.
   - Click **Next**.
2. **Step 2 - Date & Time (SlotPicker)**:
   - Wizard progresses to *"Step 2 of 3"* (progress bar at 66%).
   - Summary chip shows *"Clinic: Antenatal Clinic · For: Mother"*.
   - SlotPicker shows 14 date pills starting from today.
   - Click on tomorrow's date (or any date with available slots).
   - Available time chips appear in 12-hour format (e.g. `8:20 AM`, `8:40 AM`).
   - Click a slot chip (e.g. `8:20 AM`). The chip turns solid green with outline.
   - Preview card shows *"Selected Time: 8:20 AM"*.
   - Click **Next**.
3. **Step 3 - Review & Confirm**:
   - Wizard progresses to *"Step 3 of 3"* (progress bar at 100%).
   - Summary card shows:
     - Clinic: **Antenatal Clinic**
     - Date: Formatted as `DD/MM/YYYY`
     - Time: `8:20 AM – 8:40 AM (12-Hour Lagos Time)`
     - Who it is for: **Mother**
     - Notice: *"You can reschedule or cancel this appointment free of charge up to 4 hours before the scheduled start time via your dashboard."*.
   - Click **Confirm booking** (button disables and displays *"Confirming booking..."* during request).
4. **Success Screen**:
   - Success screen loads with green checkmark and header *"Booking Confirmed!"*.
   - Summary card displays clinic, date, time, and attendee.
   - Notice: *"SMS reminders will be sent to your registered phone number 24 hours and 2 hours before your appointment."*.
   - Click **View appointment** -> Navigates to `/appointments/[id]` with full details (or click Home in the bottom navigation).

---

### 4.2 Scenario 2: Postnatal Clinic Booking for Mother Only ("Me")
1. Navigate to `/book`.
2. **Step 1 - Clinic & Who It Is For**:
   - Select **Postnatal Clinic**.
   - Section 2 displays three selection buttons: **Me**, **My baby**, **Me & my baby**.
   - Select **Me** (`booking_type = "mother"`).
   - Confirm: No baby checkboxes are shown.
   - Click **Next**.
3. **Step 2 - Date & Time**:
   - Select a date in the next 14 days and choose an available slot chip (e.g. `1:30 PM`).
   - Click **Next**.
4. **Step 3 - Review & Confirm**:
   - Verify summary card displays:
     - Clinic: **Postnatal Clinic**
     - Date: `DD/MM/YYYY`
     - Time: `1:30 PM – 2:00 PM`
     - Who it is for: **Mother**
   - Click **Confirm booking**.
   - Success screen displays with confirmation details.

---

### 4.3 Scenario 3: Postnatal Booking with Baby (Inline Baby Creation & Auto-Selection)
1. Navigate to `/book`.
2. **Step 1 - Clinic & Who It Is For**:
   - Select **Postnatal Clinic**.
   - Select **My baby** (`booking_type = "baby"`).
   - If mother has no registered babies yet:
     - The inline mini form displays automatically.
     - Notice indicates *"Please select or add at least one baby to continue."*, and the continue button is disabled.
   - Enter baby details in the mini form:
     - Baby's Name: `Amara Bello`
     - Date of Birth: Pick a past date (e.g. `2024-05-15`)
     - Sex: `Female`
     - Click **Save**.
   - Toast: *"Baby profile added!"*.
   - Mini form closes and `Amara Bello` is added to the list as a card with an unticked checkbox.
   - Under the list, an **Add another baby** button appears.
   - Notice indicates *"Please select or add at least one baby to continue."*, and **Next** remains disabled.
   - Tick the checkbox for `Amara Bello`.
   - With at least one baby checked, **Next** becomes enabled.
   - Click **Next**.
3. **Step 2 & 3**:
   - Pick date and slot chip.
   - Review card displays *"Who it is for: Baby (Amara Bello)"*.
   - Click **Confirm booking**.
   - Success screen confirms visit for `Baby (Amara Bello)`.

---

### 4.4 Scenario 4: Postnatal Booking with Twins (Two Babies Selected)
1. Navigate to `/book`.
2. **Step 1 - Clinic & Who It Is For**:
   - Select **Postnatal Clinic**.
   - Select **Me & my baby** (`booking_type = "both"`).
   - Click **Add another baby** under the list to reopen the mini form:
     - Name: `Zainab Bello`
     - Date of Birth: `2024-05-15`
     - Sex: `Female`
     - Click **Save**.
   - Now in the baby checklist, ensure **both** checkboxes are ticked:
     - [x] `Amara Bello`
     - [x] `Zainab Bello`
   - Click **Next**.
3. **Step 2 & 3**:
   - Pick an available date and time.
   - On Step 3 Review card, verify attendee line:
     - *"Who it is for: Mother & Baby (Amara Bello, Zainab Bello)"*.
   - Click **Confirm booking**.
   - Success screen displays booking for twins.
   - In `/appointments/[id]`, both baby profiles are listed under "Registered Baby Details".

---

### 4.5 Scenario 5: Slot Conflict (`SLOT_TAKEN` / `OVERLAP`)
1. **Slot Taken Simulation**:
   - Open two browser tabs on `/book` for two different mothers.
   - In both tabs, select the exact same clinic, date, and slot chip (e.g. `24/11/2026 at 9:00 AM`).
   - Proceed to Step 3 in both tabs.
   - In Tab A, click **Confirm booking** -> Booking succeeds.
   - In Tab B, click **Confirm booking** -> Backend returns `409 SLOT_TAKEN`.
   - **Expected in Tab B**:
     - Friendly error toast: *"Another patient just took this slot. Please choose another time."*.
     - Wizard automatically returns to **Step 2 (Date & Time)**.
     - Slots automatically refresh so the taken slot is removed from available options.
     - Mother can cleanly pick an alternative slot without losing clinic or attendee selections.
2. **Appointment Overlap Simulation**:
   - Attempt to book a second appointment on the same date/time when an active booking already exists.
   - Backend returns `409 OVERLAP`.
   - **Expected**: Error alert displays: *"You already have an appointment at this time."*.

---

## Step 5: Live Queue, Profile & Babies, and Clinic Information

### 5.1 Scenario 1: Live Queue Tracking (`/queue`)

#### A. Empty State (No Appointments Today)
1. Log in as a mother who has no appointments scheduled for today (`slot_date === today` in Africa/Lagos time).
2. Tap **Queue** in the bottom navigation or click **Live Queue** from Dashboard Quick Actions.
3. **Verify Header**:
   - Header title: *"Live Clinic Queue"*.
   - Back arrow navigates back to `/dashboard`.
   - Emergency notice is displayed at the top: *"Labour or an emergency? Go straight to the Emergency Unit."*.
4. **Verify Empty State**:
   - Clock icon is horizontally centered.
   - Title: *"No Appointments Today"*.
   - Description: *"You have no clinic appointments scheduled for today in the hospital calendar. Book your next visit easily."*.
   - Centered primary button: **Book Appointment** (navigates to `/book`).

#### B. Setup Today's Appointment for Live Queue Testing
1. Navigate to `/book`.
2. Select **Antenatal Clinic** or **Postnatal Clinic**.
3. Choose today's date (first date chip in SlotPicker).
4. Select an upcoming slot for today (e.g., afternoon slot after current time).
5. Click **Next** -> **Confirm booking**.
6. The appointment is created for today with initial status `"booked"`.
7. Note down the Appointment ID or return to `/queue`.

#### C. Pre-Check-in State (Status: "booked")
1. Navigate to `/queue`.
2. **Verify Scheduled Session Card**:
   - Clinic name is displayed (e.g. *"Antenatal Clinic"*).
   - "For: Mother" (or baby name).
   - Date: *"Today, DD/MM/YYYY"*.
   - Time: 12-hour format (e.g. *"2:00 PM – 2:20 PM (Lagos Time)"*).
   - Status badge shows green: **Booked**.
3. **Verify Check-in Notice Card**:
   - Amber alert card displays:
     - Heading: *"You have not checked in yet"*.
     - Notice: *"Please check in at the front desk when you arrive at the hospital. The records officer will verify your arrival and issue your queue ticket."*.
     - Bullet points with check-in instructions.

#### D. Check-in via Staff Portal & Checked-in Queue State
1. In another window or via staff portal / curl, check the mother in:
   - Call `POST /api/appointments/:id/checkin` with front desk credentials.
   - Status updates to `"checked_in"`, assigning ticket number (e.g. `ANC-001`) and position in line.
2. In the mother's `/queue` tab, wait for the 20-second auto-poll or tap the **Refresh** button in the header.
3. **Verify Checked-in Display**:
   - Large ticket number is rendered prominently (e.g. `ANC-001`).
   - Queue Position card displays position number (e.g. `#1`, *"Number 1 in line"*).
   - Estimated wait displays: *"You are next in line (< 5 mins)"* for position 1, or estimated minutes for position > 1.
   - Status badge shows teal: **Checked In** (and includes the amber **Late** badge if arrival was past grace period).
   - **Now Serving** card shows current serving ticket (or *"Calling next patient..."*).
   - **Privacy Verification**: Confirm NO other patient's name is displayed anywhere on screen.

#### E. Active Consultation State (Status: "in_consultation")
1. Update appointment status to `"in_consultation"` via clinical staff portal:
   - `PUT /api/appointments/:id/status` with `{ status: "in_consultation" }`.
2. Mother's `/queue` tab auto-refreshes or click **Refresh**:
3. **Verify "It's your turn!" Display**:
   - Prominent green card with pulsating check icon appears.
   - Banner heading: *"It's your turn!"*.
   - Shows her exact queue ticket number: *"Ticket Number: ANC-001"*.
   - Clear directive: *"Please proceed directly into the consultation room with the attending doctor or midwife."*.
   - Status badge shows teal: **In Consultation**.

#### F. Consultation Completed State (Status: "completed")
1. Staff marks consultation completed:
   - `PUT /api/appointments/:id/status` with `{ status: "completed" }`.
2. Mother's screen updates:
   - Card displays: *"Consultation Completed"*.
   - Thank you message and link button: **View Appointments History**.
   - Auto-polling stops completely (no background network requests sent).

#### G. Polling & Visibility Control
1. Confirm the "Last updated" time updates every 20 seconds.
2. Minimize or switch away from the browser tab (`document.hidden = true`).
3. Confirm in network activity that polling is suspended while hidden.
4. Switch back to tab: polling resumes cleanly.

---

### 5.2 Scenario 2: Mother Profile & Babies Management (`/profile`)

#### A. View & Edit Mother Profile
1. Tap **Profile** in the bottom navigation.
2. **Verify Mother's Information Form**:
   - Field 1 **Full Name**: Pre-filled with her name (editable).
   - Field 2 **Phone Number (Verified)**: Pre-filled with verified phone number, disabled/read-only with helper note.
   - Field 3 **Hospital ID**: Editable input with placeholder *"Folder No. (e.g. HOSP-1234)"*.
   - Field 4 **HMO / NHIA No.**: Editable input with placeholder *"Optional"*.
   - Primary button: **Save** (48px high, Nigerian green).
3. **Edit Profile Details**:
   - Update Full Name to `Amina Bello-Smith`.
   - Enter Hospital ID: `HOSP-998877`.
   - Enter HMO Number: `NHIA-112233`.
   - Click **Save**.
4. **Expected**:
   - Button briefly shows *"Saving..."*.
   - Success toast appears: *"Profile updated successfully!"*.
   - Form retains updated values.
   - Return to `/dashboard` -> greeting reflects updated first name: *"Hello, Amina 👋"*.

#### B. List & Add Baby Profiles
1. On `/profile`, scroll to **My Babies** section.
2. Existing babies are rendered as cards showing name, formatted date of birth (`DD/MM/YYYY`), and capitalized sex (`Female` / `Male`).
3. Each card has an **Edit** (pencil) and **Delete** (trash) icon.
4. Click **Add another baby**:
   - Inline form opens below the list with fields: Baby's Name, Date of Birth, Sex.
   - Enter details:
     - Name: `Ibrahim Bello`
     - DOB: Past date (e.g. `2024-08-10`)
     - Sex: `Male`
   - Click **Save**.
5. **Expected**:
   - Success toast: *"Baby profile added!"*.
   - Inline form closes and `Ibrahim Bello` appears immediately in the babies list.

#### C. Edit Baby Profile
1. On `Ibrahim Bello` card, click the **Edit** icon (pencil).
2. The card transforms into an inline edit form pre-filled with his current details.
3. Change Name to `Ibrahim Al-Amin Bello`.
4. Click **Save**:
   - Success toast: *"Baby profile updated."*.
   - Edit form closes and card reflects updated name: `Ibrahim Al-Amin Bello`.
5. Click **Cancel** on any edit to verify form cancels without saving changes.

#### D. Delete Baby Profile with Confirmation Warning
1. On `Ibrahim Al-Amin Bello` card, click the **Delete** icon (trash).
2. **Verify Confirmation Dialog**:
   - Modal dialog appears with title: *"Delete Baby Profile?"*.
   - Prominent red warning:
     *"Warning: This baby will be removed from your appointment history. Are you sure you want to delete the profile for Ibrahim Al-Amin Bello?"*.
   - Two buttons: **Cancel** (outline) and **Delete** (danger red).
3. Click **Cancel**:
   - Dialog closes; baby profile remains untouched.
4. Click Delete icon again, and click **Delete**:
   - Success toast: *"Baby profile removed."*.
   - Modal closes; baby card is removed from the list.

#### E. Log Out
1. Scroll to the bottom of the `/profile` page.
2. Click **Log Out**:
   - Success toast: *"Logged out successfully."*.
   - Local and session storage tokens are wiped.
   - Visitor is redirected to `/login`.

---

### 5.3 Scenario 3: Hospital & Clinic Information (`/clinic-info`)

#### A. Navigation & Access
1. From `/dashboard`, tap the **Hospital & Clinic Information** card in Quick Actions.
2. From `/profile`, tap the **Hospital & Clinic Information** card.
3. Verify page loads at `/clinic-info` with:
   - Header with back button to `/dashboard` and refresh icon.
   - Top emergency banner: *"Labour or an emergency? Go straight to the Emergency Unit."*.
   - Bottom navigation bar visible and fixed.

#### B. Medical Facility & Google Maps
1. **Verify Hospital Card**:
   - Displays hospital name: *"General Hospital Lagos / Federal Medical Centre"*.
   - Displays physical address with pin icon: *"123 Broad Street, Lagos Island, Lagos State, Nigeria"*.
   - Click **Open in Google Maps**:
     - Opens Google Maps in a new browser tab (`target="_blank" rel="noopener noreferrer"`).

#### C. Emergency Unit & Tap-to-Call
1. **Verify Emergency Card**:
   - Red emergency card with *"24/7"* availability badge.
   - Instructions: *"For acute emergencies (heavy bleeding, severe pain, labour onset), proceed directly to the Emergency Obstetric Triage."*.
   - Click **Tap to Call: +2348000000911**:
     - Verifies `tel:+2348000000911` phone dialer link triggers.

#### D. Clinic Schedules & Indicative Booking Notice
1. **Verify Antenatal Clinic Card**:
   - Hours: `08:00 - 12:00 (Lagos Time)`.
   - Slot duration: `20 min slots`.
   - Clinic Days: Chips for `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`.
   - Description text explaining morning consultation sessions.
2. **Verify Postnatal Clinic Card**:
   - Hours: `13:00 - 16:00 (Lagos Time)`.
   - Slot duration: `30 min slots`.
   - Clinic Days: Chips for `Monday`, `Wednesday`, `Friday`.
   - Description text explaining afternoon mother and newborn checks.
3. **Verify Indicative Notice**:
   - Amber alert explains that days shown are indicative schedules, and actual booking availability is determined by the live booking calendar.
4. **Verify Centered CTA**:
   - Centered **Book Appointment** button links directly to `/book`.
