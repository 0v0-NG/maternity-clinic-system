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
- [x] Input layout alignment for "Hospital ID" and "NHIS number".
- [x] Safe JSON parsing in `useAuth.js` with fallback for missing/corrupt storage.
- [x] OTP single-flight submission preventing double submit toasts.
- [x] Automatic session redirection based on user role.

---

## Step 3: Mother Home and Appointments

### 3.0 Token & Auth Storage Verification
1. Navigate to `http://localhost:3000/register`.
2. Fill in registration details:
   - Full Name: `Test Mother`
   - Phone number for SMS (can be a husband's or relative's number): Unique 11-digit number (e.g. `080` + 8 random digits)
   - Hospital ID: `HOSP-TEST-001` (optional)
   - NHIS number: `NHIS-TEST-001` (optional)
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
   - Top of screen displays red Emergency Notice banner: *"Labour or an emergency? This clinic does not handle deliveries or emergencies. Go straight to the nearest hospital emergency unit."*.
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
   - Emergency notice is displayed at the top: *"Labour or an emergency? This clinic does not handle deliveries or emergencies. Go straight to the nearest hospital emergency unit."*.
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
   - Field 4 **NHIS number**: Editable input with placeholder *"NHIS number (optional)"*.
   - Primary button: **Save** (48px high, Nigerian green).
3. **Edit Profile Details**:
   - Update Full Name to `Amina Bello-Smith`.
   - Enter Hospital ID: `HOSP-998877`.
   - Enter NHIS number: `NHIS-112233`.
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
   - Top emergency banner: *"Labour or an emergency? This clinic does not handle deliveries or emergencies. Go straight to the nearest hospital emergency unit."*.
   - Bottom navigation bar visible and fixed.

#### B. Medical Facility, Contacts & Google Maps
1. **Verify Hospital Card**:
   - Displays hospital name: *"University Health Services, Bayero University, Kano - Ante-Natal Clinic"*.
   - Displays physical address with pin icon: *"Inside the main University Health Services Clinic, BUK New Site, Rimin Gata, Gwarzo Road, Kano"*.
   - Displays tap-to-call `clinicPhone` (`0810 704 7641`, `tel:08107047641`) and mailto `clinicEmail` (`info.clinic@buk.edu.ng`, `mailto:info.clinic@buk.edu.ng`).
   - Click **Open in Google Maps**:
     - Opens Google Maps search link in a new browser tab (`target="_blank" rel="noopener noreferrer"`).

#### C. Emergency Notice Card (No Deliveries/Emergencies)
1. **Verify Emergency Notice Card**:
   - Displays red **Emergency Notice** card stating: *"Labour or an emergency? This clinic does not handle deliveries or emergencies. Go straight to the nearest hospital emergency unit."*.
   - Verify no emergency unit phone number or 24/7 emergency call button is displayed.

#### D. Clinic Schedules & Indicative Booking Notice
1. **Verify Antenatal Clinic Card**:
   - Hours: `About 09:30 to mid-day (Lagos Time)`.
   - Slot duration: read dynamically from `clinics` table (e.g. `20 min slots`).
   - Clinic Days: Chips for `Tuesday`, `Thursday`.
   - Description text explaining Tuesday and Thursday clinic sessions.
2. **Verify Postnatal Clinic Card**:
   - Hours: `About 09:30 to mid-day (Lagos Time)`.
   - Slot duration: read dynamically from `clinics` table (e.g. `30 min slots`).
   - Clinic Days: Chips for `Tuesday`, `Thursday`.
   - Description text explaining Tuesday and Thursday clinic sessions.
3. **Verify Session & Indicative Notices**:
   - Schedule note displays: *"Monday is registration day. Wednesday is immunisation, which this system does not cover."*.
   - Amber alert explains that days shown are indicative schedules, and actual booking availability is determined by the live booking calendar.
4. **Verify Centered CTA**:
   - Centered **Book Appointment** button links directly to `/book`.

---

## Step 6: Staff Portal (`/staff`) - Front Desk & Clinical Views

### 6.1 Access Control & Role Gate
1. **Mother Redirection**:
   - Log in as a mother (`+2348012345678`).
   - In browser address bar, navigate to `http://localhost:3000/staff`.
   - **Expected**: Mother is immediately redirected to `/dashboard`.
2. **Unauthenticated Redirection**:
   - Open `/staff` in an incognito window with no stored auth token.
   - **Expected**: Redirected immediately to `/login`.
3. **Role-Based Views**:
   - Log in as Front Desk (`+2340000000004` / `password123`):
     - Displays **Front Desk View** (check-in list and live queue panel).
     - No `/book` link is visible.
   - Log in as Midwife (`+2340000000003` / `password123`) or Doctor (`+2340000000002` / `password123`):
     - Displays **Clinical Consultation View** (grouped patient lounge and room queues).
   - Log in as Administrator (`+2340000000001` / `password123`):
     - Displays both views as selectable tabs: *"Front Desk View"* and *"Clinical Consultation View"*.

---

### 6.2 Scenario 1: Front Desk Check-In and Live Queue Verification

#### A. Booking an Appointment for Today (as Mother)
1. In Tab A, log in as test mother (`+2348012345678` / `123456`).
2. Navigate to `/book`.
3. Select **Antenatal Clinic** -> Click **Next**.
4. In SlotPicker, select **Today's** date chip (first chip).
5. Pick an available slot for today -> Click **Next** -> Click **Confirm booking**.
6. Note down the scheduled time (e.g. `11:00 AM – 11:20 AM`).

#### B. Mother's Pre-Check-in Queue View
1. Still in Tab A (Mother), navigate to `/queue`.
2. Verify amber notice card displays:
   - *"You have not checked in yet"*.
   - *"Please check in at the front desk when you arrive at the hospital."*.
   - Status badge shows green: **Booked**.

#### C. Front Desk Check-in (`/staff`)
1. In Tab B, log in as Front Desk staff (`+2340000000004` / `password123`).
2. Navigate to `/staff`.
3. **Verify Header & Top Controls**:
   - Header shows staff name: *"Mr. Chukwu"* and role badge *"Front Desk Officer"*.
   - Clinic selector defaults to *"Antenatal Clinic"*.
   - Date selector defaults to today's date in Lagos time (`YYYY-MM-DD`).
   - Count chips show counts: Booked, Checked In, Completed, No-Show, Cancelled.
4. **Locate Mother's Booking**:
   - Locate the booked appointment in today's list.
   - Verify card details: scheduled time, attendee, and green **Booked** status badge.
5. **Execute Check-In**:
   - On the appointment card, click **Check In**.
   - Button disables and briefly displays *"Processing..."*.
   - **Expected Result**:
     - Success toast appears: *"Patient checked in! Queue Ticket: ANC-001"* (or assigned ticket number, with `(Marked Late)` if arriving after 30-minute grace period).
     - Appointment status updates to **Checked In** with assigned ticket number.
     - Count chips update: Booked count decreases, Checked In count increases.
     - Live Queue Tracker on the right panel adds the patient with ticket `ANC-001` and status *"Waiting"*.

#### D. Verify Live Ticket on Mother's Queue Page
1. Switch back to Tab A (Mother's `/queue` page).
2. Within 20 seconds (or after clicking **Refresh**):
   - Amber "Not checked in" notice disappears.
   - Screen displays large ticket number: **ANC-001**.
   - Queue Position displays: **#1** (*"You are number 1 in the queue"*).
   - Status badge updates to teal: **Checked In**.
   - Live queue updates in real-time.

#### E. No-Show Marking
1. In Tab B (Front Desk), locate a booked appointment.
2. Click **No-show**:
   - Confirmation dialog opens: *"Mark as No-Show?"*.
   - Explanatory rule: *"Appointments may only be marked as No-show after the appointment start time plus grace period (30 mins) has passed."*.
3. Click **Confirm No-Show**:
   - If attempted before `start_time + 30m` has passed:
     - Error toast appears with mapped friendly message: *"You cannot mark this as a no-show yet. Please wait until after your appointment time."*.
   - If grace period has expired:
     - Status updates cleanly to **No-Show**.

---

### 6.3 Scenario 2: Clinical Consultation Queue (`midwife` / `doctor`)

#### A. Consultation Queue Layout
1. Log in as Nurse Fatima (`+2340000000003` / `password123`).
2. Verify Clinical Consultation View opens automatically.
3. **Verify 4 Queue Sections**:
   - **Currently In Consultation**: Empty notice or active patient in room.
   - **Waiting in Lounge**: List of checked-in patients in arrival order with ticket numbers.
   - **Not Yet Arrived**: Booked appointments scheduled for today.
   - **Done Today**: Collapsed accordion showing completed consultations.

#### B. Calling in a Patient ("Call In")
1. In **Waiting in Lounge**, locate patient with ticket `ANC-001`.
2. Click **Call In**:
   - Button shows *"Calling..."*.
   - Status updates to `in_consultation`.
   - Patient moves to the **Currently In Consultation** section.
   - Live Queue panel updates "Now Serving" to `ANC-001`.
3. In Mother's Tab A (`/queue`):
   - Screen updates to: *"It's your turn!"* with pulsating green check icon and instructions to enter the room.

#### C. Finishing Consultation & Follow-up Scheduling ("Finish")
1. In **Currently In Consultation**, click **Finish**:
   - Status updates to `completed`.
   - Toast displays: *"Consultation completed."*.
   - Mother moves to **Done Today** completed section.
2. **Follow-Up Booking Modal**:
   - Modal immediately opens: *"Book Follow-Up Appointment?"*.
   - Patient and clinic are pre-selected.
   - Reusable SlotPicker displays upcoming dates with walk-in and regular slots.
   - Select a date next week and click an available slot chip (e.g. `9:00 AM`).
   - Click **Book Follow-Up**:
     - Follow-up appointment is created in backend (`POST /api/appointments/follow-up`).
     - Toast: *"Follow-up appointment booked successfully."*.
     - Modal closes.
3. **Skip Follow-Up Option**:
   - Complete another consultation and click **Skip** in the follow-up modal:
     - Modal closes cleanly without scheduling a follow-up.

---

## 7. STEP 6B: FRONT DESK WALK-IN BOOKINGS & PATIENT MANAGEMENT

### 7.1 Looking Up an Existing Mother
1. Log in as Front Desk Officer (`+2340000000001` / `password123`) and open `/staff`.
2. In the Front Desk Reception header, click **Look up a mother**:
   - The "Look Up Patient Record" modal opens with an autofocus search field.
3. In the search box, enter at least 3 characters (e.g. `Ami`, `080`, folder number, or NHIS number):
   - A loading skeleton pulses while searching.
   - Matching mother cards appear showing Name, Phone, Folder number, NHIS number, and number of registered babies.
4. Click on a patient (e.g. *Mrs. Amina Bello*):
   - Full read-only profile loads via `GET /api/mothers/:id`.
   - Displays Name, Phone, Folder number, NHIS number, Registration Date, and Desk Registration badge (if registered in person).
   - Lists all registered babies with Name, Gender, and Date of Birth formatted as `DD/MM/YYYY`.
   - Lists past and upcoming visits newest first showing date, time, clinic, status, and baby names (without any clinical data).
5. Click **Book appointment for Mrs. Amina Bello**:
   - Lookup modal closes and the Walk-in Booking Wizard opens immediately with Amina pre-selected at Step 2 (Clinic & Attendee).

---

### 7.2 Registering a New Mother at the Front Desk
1. In the Front Desk Reception header, click **New walk-in or phone-in booking**:
   - The 4-step wizard opens at **Step 1: Find Patient**.
2. In the search field, type a new name (e.g. `Zainab D`) to confirm no match exists:
   - Notice displays: *"No mother found matching 'Zainab D'"*.
   - A **Register new mother** button is presented.
3. Click **Register new mother**:
   - The inline registration form expands (phone field labelled *"Phone number for SMS (can be a husband's or relative's number) *"*, NHIS field labelled *"NHIS number (Optional)"*).
4. **Validation Test (Consent Checkbox)**:
   - Enter Name: `Zainab Danladi`, Phone: `08099887766`.
   - Leave the consent checkbox unticked.
   - Click **Save**:
     - Form blocks submission and prompts: *"Patient verbal consent is required for staff registration."*.
5. **Duplicate Phone Test**:
   - Enter an already registered phone number (e.g. `+2340000000002` or `08012345678`).
   - Tick the required consent checkbox: *"The mother agrees to her and her baby's data being stored (NDPA 2023)"*.
   - Click **Save**:
     - Backend returns 409 `CONFLICT`.
     - Friendly error displays: *"A patient with this phone number is already registered. Please search for her instead."*.
     - A quick link *"Search for <phone>"* is provided to switch directly to searching her record.
6. **Successful Registration**:
   - Enter a new unique phone number (e.g. `08055443322`).
   - Enter optional Hospital ID: `HOSP-ZD-01`, NHIS number: `NHIS-9988`.
   - Ensure the NDPA 2023 consent checkbox is ticked.
   - Click **Save**:
     - Patient is registered in backend (`POST /api/mothers`) with `registered_by_staff: true`.
     - Toast appears: *"Patient registered successfully!"*.
     - Wizard advances automatically to **Step 2: Clinic & Who it is for** with Zainab selected.

---

### 7.3 Clinic Selection & Adding a Baby for Postnatal Care
1. At **Step 2 (Clinic & Who it is for)**:
   - Patient banner at the top shows: `Zainab Danladi · +2348055443322` with a "Change" link.
2. **Antenatal Clinic Rule**:
   - Click **Antenatal Clinic**:
     - Notice displays: *"Antenatal Clinic: The visit is for the mother only."*.
     - No baby options are shown.
3. **Postnatal Clinic Rule**:
   - Click **Postnatal Clinic**:
     - Question appears: *"Who is this visit for?"* with options: **Mother**, **Baby**, **Mother & baby**.
4. Select **Baby** (or **Mother & baby**):
   - Empty state displays: *"No babies registered for this mother yet. Please add a baby below."*.
   - The **Next** button remains disabled.
5. Click **Add baby**:
   - The mini inline baby form opens.
   - Enter Baby Name: `Baby Hassan`, DOB: `15/10/2026`, Sex: `Male`.
   - Click **Save**:
     - Backend creates baby linked to Zainab (`POST /api/babies` with `mother_id`).
     - Toast: *"Baby profile added!"*.
     - Mini form collapses.
     - `Baby Hassan` appears in the baby list **unticked**.
6. **Twins Handling ("Add another baby")**:
   - Click **Add baby** again.
   - Enter Baby Name: `Baby Husseina`, DOB: `15/10/2026`, Sex: `Female`.
   - Click **Save**:
     - Both twins now appear as selectable cards.
7. Tick `Baby Hassan` (and optionally `Baby Husseina`):
   - **Next** button becomes enabled.
   - Click **Next** to proceed to Step 3.

---

### 7.4 Selecting Walk-in Time Slot
1. At **Step 3 (Date & Time)**:
   - Reusable `SlotPicker` loads with `allowWalkin={true}`, defaulting to today's date in `Africa/Lagos`.
   - Walk-in slots are clearly marked with amber badges.
2. Select an available walk-in slot for today (or standard slot).
3. Selected slot chip highlights in primary green.
4. Click **Next** to proceed to Step 4.

---

### 7.5 Review & Confirming Walk-in Booking
1. At **Step 4 (Review & Confirm)**:
   - Review Card cleanly displays:
     - **Patient**: `Zainab Danladi (+2348055443322)`
     - **Clinic**: `Postnatal Clinic`
     - **Attendee**: `Baby` (`Baby Hassan`)
     - **Date**: Today's date (`DD/MM/YYYY`)
     - **Time**: 12-hour Lagos time range (e.g. `11:30 AM – 12:00 PM`)
     - **Slot Type**: Walk-in Slot badge
2. Click **Confirm booking**:
   - Button displays *"Confirming..."* and disables to prevent duplicate submissions.
   - `POST /api/appointments` is sent with `{ mother_id, clinic_id, slot_id, booking_type: "baby", baby_ids: [...] }`.
   - On success:
     - Wizard advances to **Step 5: Booking Confirmed**.
     - Toast: *"Appointment booked successfully!"*.

---

### 7.6 Checking In Arriving Patient & Queue Ticket Issuance
1. At **Step 5 (Booking Confirmed)**:
   - Green confirmation checkmark displays with summary: *"Appointment created for Zainab Danladi at Postnatal Clinic"*.
   - Two action buttons are presented: **Check in now** (primary) and **Back to list** (outline).
2. Click **Check in now**:
   - `POST /api/appointments/:id/checkin` is dispatched.
   - Toast displays: *"Patient checked in! Queue Ticket: PNC-001"*.
   - Large prominent Queue Ticket banner appears:
     - **Ticket PNC-001** (or next sequential queue number for today).
     - Notice: *"Patient has been added to today's active clinic waiting queue."*.
   - Button changes to **Back to list**.
3. Click **Back to list**:
   - Wizard closes.
   - Today's Front Desk appointment list automatically reloads.
   - **Zainab Danladi** appears in today's appointments table showing:
     - Name: **Zainab Danladi**
     - Phone: **+2348055443322**
     - For: **Baby Hassan**
     - Ticket: **Ticket PNC-001**
     - Status Badge: **Checked In** (or Waiting)
4. In the Right Column (Live Queue Panel):
   - Ticket `PNC-001` is visible in the active waiting queue.

---

### 7.7 Verifying Login Failure Handling & Dual-Storage Logout

#### Case A: Desk-Registered Account Attempting Login (Account Exists Without Password)
1. Open `/login` in a browser.
2. Enter the desk-registered phone number: `08098765432`.
3. Enter password: `Test12345`.
4. Click **Log in**:
   - `POST /api/auth/login` sends `{ phone: "08098765432", password: "Test12345" }`.
   - Backend responds with status `401 Unauthorized` (`INVALID_CREDENTIALS`).
   - The 401 response interceptor ignores auth endpoints and passes the error directly to the caller without triggering refresh or full-page navigation.
   - Toast displays mapped error: *"Invalid phone number or password. Please try again."*.
   - The phone input field **retains** `08098765432`.
   - The password field is **cleared**.
   - The submit button transitions back from `"Logging in..."` to `"Log in"`.
   - The page **does not reload** and does not navigate away.

#### Case B: Non-Existent Account / Wrong Credentials Attempting Login
1. On `/login`, enter an unregistered phone number: `08031112233`.
2. Enter password: `wrong123`.
3. Click **Log in**:
   - `POST /api/auth/login` sends `{ phone: "08031112233", password: "wrong123" }`.
   - Backend responds with status `401 Unauthorized` (`INVALID_CREDENTIALS`), returning an identical response body to Case A to prevent account enumeration.
   - Toast displays mapped error: *"Invalid phone number or password. Please try again."*.
   - The phone input field **retains** `08031112233`.
   - The password field is **cleared**.
   - The submit button transitions back from `"Logging in..."` to `"Log in"`.
   - The page **does not reload** and does not navigate away.

#### Case C: Registration & OTP Failure Field Preservation
1. On `/register`, submit mismatched passwords or invalid data:
   - Form fields (name, phone, hospital ID, NHIS number, consent) are retained.
   - Only password fields are cleared.
   - Friendly toast error is shown and no page reload occurs.
2. At OTP verification step:
   - Entering an invalid OTP (`000000`) clears only the 6 OTP input boxes and refocuses the first digit.
   - Phone context is preserved, loading stops, and no navigation occurs.

#### Case D: Dual-Storage Session Cleanup on Logout
1. Log in with valid credentials (e.g., front desk staff or mother account).
2. Open DevTools -> **Application** -> Storage:
   - Observe tokens and user data stored across `sessionStorage` (`token`) and `localStorage` (`refreshToken`, `user`).
3. Click **Log out** (from Dashboard, Profile, Staff, or Admin view).
4. Verify:
   - `sessionStorage`: `token`, `refreshToken`, `user` are all removed (`null`).
   - `localStorage`: `token`, `refreshToken`, `user` are all removed (`null`).
   - Browser redirects cleanly to `/login`.

---

## Step 7: Admin Portal (/admin)

### 8.0 Role-Based Access Control & Layout Navigation
1. **Unauthenticated Access**:
   - Open an incognito browser window and navigate directly to `http://localhost:3000/admin`.
   - **Expected**: Immediately redirected to `/login`.
2. **Unauthorized Role Access**:
   - Log in as a mother account (`08012345678` / `password123`) and navigate to `/admin`.
   - **Expected**: Redirected to `/dashboard`.
   - Log in as front desk staff (`+2340000000004` / `password123`) and navigate to `/admin`.
   - **Expected**: Redirected to `/staff`.
3. **Administrator Access**:
   - Log in with seeded admin credentials:
     - Phone: `+2340000000001`
     - Password: `password123`
   - **Expected**: Lands on `/admin`.
   - Top bar displays:
     - Portal title: **Admin Portal**
     - User name: **Admin User**
     - Role label: **System Administrator**
     - **Log out** button.
   - Left sidebar (desktop) displays 4 navigation items:
     - **Dashboard**
     - **Block dates**
     - **Cancel session**
     - **Audit log**
   - On mobile screens (`< 768px`), hamburger button toggles top dropdown menu.

---

### 8.1 Dashboard & Operational Reports
1. **Default View**:
   - Click **Dashboard** in sidebar.
   - Notice date filter defaults to **Last 7 days** up to today in Lagos time (`Africa/Lagos`).
   - Skeleton loading cards appear briefly while metrics are queried.
2. **Metric Summary Cards**:
   - **Total Visits**: Aggregated total appointments across all clinics.
   - **Completed**: Consultations finished.
   - **Cancelled**: Appointments cancelled by patient or staff.
   - **No-Shows**: Missed appointments.
   - **No-Show Rate (%)**: Exact calculated percentage (`no_shows / total * 100`).
3. **Charts**:
   - **Appointments by Clinic**: Color-coded CSS stacked bars showing completed (green), cancelled (red), no-shows (amber), and upcoming (blue) with exact counts and legend.
   - **Clinic Capacity & Load**: Shows booked slots vs total available slots with occupancy percentage for each specialty.
4. **Date Filtering**:
   - Click **Today** preset: updates cards and charts for today's live activity.
   - Click **Last 30 days** preset: expands range to cover the last month.
   - Adjust **From** and **To** date inputs manually and click the **Refresh** button.

---

### 8.2 Block & Unblock Clinic Dates
> ⚠️ **[DATA-CHANGING TEST]**: Modifying date blocks alters real slot availability in the database.
> **IMPORTANT**: Use a future date that has **no real test bookings** (e.g. `2026-12-25` or any date at least 7 days ahead with 0 bookings).

1. Click **Block dates** in sidebar.
2. **Live Booking Detection**:
   - Select clinic: **Antenatal Clinic**.
   - Pick a test date with **no active bookings** (e.g. `2026-12-25`).
   - Notice badge displays: *"No active bookings found on this date."*.
   - Pick a date known to have bookings (e.g. today):
   - Notice prominent warning banner displays:
     - *"Warning: There are X active booking(s) on this date. Blocking this date prevents future bookings but does NOT cancel existing appointments or notify mothers. To cancel existing bookings and notify mothers by SMS, please use Cancel session."*.
3. **Blocking a Date**:
   - Set test date back to an unused future date (e.g. `2026-12-25`).
   - Enter reason: `Christmas Public Holiday`.
   - Click **Block date**.
   - Confirmation dialog opens explaining:
     - Clinic name and date formatted as `DD/MM/YYYY`.
     - Clarification that schedule slots become blocked (`is_blocked = true`), preventing future bookings, while existing appointments are not cancelled.
   - Click **Confirm block**.
   - Button shows `"Blocking..."`, modal closes, and success toast displays (e.g. *"X slots blocked on 2026-12-25"*).
4. **Unblocking a Date**:
   - Under the **Unblock Clinic Date** card:
     - Select **Antenatal Clinic**.
     - Enter the same date: `2026-12-25`.
     - Click **Unblock date**.
   - Confirmation dialog opens: *"Unblock Antenatal Clinic on 25/12/2026? This will re-open any unbooked slots on this day for patient bookings."*.
   - Click **Confirm unblock**.
   - Success toast displays: *"X slots unblocked."*.
   - Slots immediately return to active status.

---

### 8.3 Cancel Session with Bulk SMS Alerts
> ⚠️ **[DATA-CHANGING TEST]**: Cancelling a session marks appointments as `cancelled`, blocks slots, and dispatches SMS notices.
> **IMPORTANT**: Only test on a test date with **no critical bookings** (or a single dummy booking created specifically for testing cancellation notices).

1. Click **Cancel session** in sidebar.
2. **Input Validation**:
   - Select **Antenatal Clinic**.
   - Select test date.
   - Notice dynamic impact summary shows how many active bookings will be cancelled and notified.
   - Leave the reason empty and submit: form validation blocks submission (*"A cancellation reason is required for patient SMS notices"*).
3. **Confirmation & Safety Guard**:
   - Enter reason: `Facility maintenance and power outage`.
   - Click **Cancel session and notify**.
   - Confirmation modal opens with red emergency styling:
     - Displays clinic name and date in `DD/MM/YYYY`.
     - Displays patient reason to be sent via SMS.
     - Outlines consequences: all active bookings cancelled, slots blocked, automated SMS alerts sent.
   - Click **Cancel session and notify**:
     - Button disables and displays `"Cancelling..."`.
     - Request `POST /api/admin/cancel-session` completes.
     - Success banner displays with exact counts returned from API:
       - *"Session cancelled. X appointments affected."*
       - Clinic name, date, and SMS dispatch status.

---

### 8.4 Audit Log & Sensitive Data Masking
1. Click **Audit log** in sidebar.
2. **Table Verification**:
   - Audit table loads newest operations first.
   - Timestamps display in Nigerian time (`Africa/Lagos` UTC+1) with calendar date and 12-hour time (e.g. `21/11/2026, 11:21 PM`).
   - Action badges are color-coded:
     - Green: `LOGIN_SUCCESS`, `CREATE_STAFF`, etc.
     - Red: `LOGIN_FAILURE`, `CANCEL_SESSION`.
     - Amber: `BLOCK_DATE`.
     - Blue: `BOOK_APPOINTMENT`, `CHECK_IN`, etc.
   - User column displays truncated user UUID (e.g. `e30b148d...`) with full UUID accessible via tooltip.
3. **Sensitive Data Masking**:
   - Inspect the **Details** column for login, registration, or session logs.
   - Verify that **passwords**, **JWT tokens**, **secrets**, and **OTPs** are NEVER shown in plain text and are masked as `••••••` or `••••••••`.
4. **Filtering & Pagination**:
   - In **Filter Action**, select `LOGIN_SUCCESS` and click **Apply** -> table shows only successful logins.
   - Select `BLOCK_DATE` or `CANCEL_SESSION` -> displays recent date management entries.
   - Enter a date in **Filter Date** -> table filters matching logs.
   - Click **Reset** -> filters reset and full log history reloads.
   - If more than 50 logs exist, click **Load more logs** -> next 50 records append to the bottom of the table.



---

## Step 8: Admin Completion (Slots Generator, Clinic Settings, Staff Accounts)

### 8.1 Slot Generator (`POST /api/admin/slots/generate`)
> ⚠️ **[DATA-CHANGING TEST]**: Generating slots creates new appointment intervals in the database.
> **SAFE TEST DATES**: Use safe dates between **26/11/2026** and **28/11/2026** (or next month) to avoid overwriting today's live clinic slots.

1. Click **Slot generator** in the left sidebar (or mobile navigation menu).
2. **Form Layout & Dynamic Preview**:
   - Verify clinic selector lists available clinics (e.g. "Antenatal Clinic", "Postnatal Clinic"). Select **Antenatal Clinic**.
   - Select **From date**: `26/11/2026`.
   - Select **To date**: `28/11/2026` (3 calendar days).
   - Set **Start time**: `08:00`, **End time**: `12:00` (4 hours / 240 mins).
   - Weekdays checkboxes: Notice Monday to Friday are checked by default (0-6 numbering). Check/uncheck individual days and verify state toggles.
   - Optional Clinician selector: Lists clinicians only (`doctor` and `midwife` roles, excluding admin and front desk). Leave unassigned or select a test clinician.
   - **Live Preview Line**: Check that the live calculation appears:
     - Shows the clinic's saved slot length (e.g. `20-min slots`) and saved walk-in percentage (e.g. `20% walk-in share`).
     - Shows calculated slots per active day and how many slots are held for walk-ins using the clinic's `walkin_reserve_pct` (spread evenly across the day).
3. **Validation Guards**:
   - Try selecting a past start date: form blocks submission (*"Cannot generate slots for past dates"*).
   - Try selecting a date range > 31 days (e.g. 01/01/2027 to 15/02/2027): form blocks submission (*"Date range cannot exceed 31 days"*).
   - Uncheck all weekdays and submit: form blocks submission (*"Please select at least one weekday"*).
4. **Confirmation & Generation Execution**:
   - Return dates to safe test range (`26/11/2026` to `28/11/2026`).
   - Click **Generate slots**.
   - Confirmation dialog opens displaying summary: Clinic, Date Range (DD/MM/YYYY), Operating Hours, Weekdays selected, and Clinician.
   - Click **Confirm and generate**:
     - Button disables and shows in-flight spinner (*"Generating..."*).
     - Upon completion, dialog closes and a green Success Summary Card renders:
       - Displays exact `created` count and `skipped` (existing) count returned by API.
       - Confirms walk-in slots automatically tagged according to clinic walk-in ratio.

---

### 8.2 Clinic Settings (`PUT /api/clinics/:id`)
> ⚠️ **[DATA-CHANGING TEST]**: Modifying clinic settings changes default slot durations and walk-in reserves for future slot generation.

1. Click **Clinic settings** in the sidebar.
2. **View & Informational Notice**:
   - Prominent note displays: *"Operating Rule Note: Changes to slot length and walk-in share only affect slots generated afterwards; existing slots and appointments are not altered."*
   - Cards display for each clinical department (e.g., Antenatal Clinic, Postnatal Clinic).
3. **Editable Fields & Validation**:
   - Under **Antenatal Clinic**:
     - Slot Duration: Enter `25` (must be whole minutes between 5 and 120).
       - Test invalid input: enter `3` or `150` and click **Save** -> validation toast displays error (*"Slot duration must be a whole number between 5 and 120 minutes"*).
     - Walk-in Share (%): Enter `25` (must be between 0% and 50%).
       - Test invalid input: enter `60` and click **Save** -> validation toast displays error (*"Walk-in share must be between 0% and 50%"*).
     - Notice the live preview calculation updates dynamically as numbers change (shows estimated total morning slots and reserved walk-in slots).
4. **Save Execution**:
   - Set slot duration to `20` and walk-in share to `20%`.
   - Click **Save**.
   - Button shows disabled state with spinner (*"Saving..."*).
   - Request `PUT /api/clinics/:id` sends payload `{ name, slot_duration_min: 20, walkin_reserve_pct: 0.2 }`.
   - Success toast displays: *"Clinic settings saved."*
   - Card updates with new saved values.

---

### 8.3 Staff Accounts (`GET /api/admin/staff`, `POST /api/admin/staff`, `PUT /api/admin/staff/:id`)
> ⚠️ **[DATA-CHANGING TEST]**: Adding or modifying staff accounts affects login credentials.
> **TEST ACCOUNTS**: Use throwaway test accounts (e.g., `Test Staff 1`, phone `08099881122`). Do not modify the seeded Admin or Front Desk credentials.

1. Click **Staff** in the sidebar.
2. **Staff List & Table**:
   - Verify table loads with columns: **Name**, **Role**, **Phone**, **Created Date**, and **Action**.
   - Distinct role badges:
     - Admin: Purple badge.
     - Doctor: Blue badge.
     - Midwife: Teal badge.
     - Front Desk: Amber badge.
   - Current logged-in user row displays `(You)` badge next to their name.
   - Test **Search Staff**: type a staff member's name or phone digits -> table filters instantly.
   - Test **Filter Role**: select "Doctor" -> table shows only doctors; select "All Roles" -> shows all staff.
3. **Add Staff Account Modal (`POST /api/admin/staff`)**:
   - Click **Add staff** button in top-right header.
   - Modal opens with fields: Full Name, Role, Phone Number, Password, Confirm Password.
   - **Validation checks**:
     - Leave name empty or password < 6 characters: form prevents submission.
     - Enter mismatched passwords: error message displays (*"Passwords do not match"*).
   - **Duplicate Phone Check (409 CONFLICT)**:
     - Enter seeded admin phone `+2340000000001` with a dummy name and password `TestPass123!`.
     - Submit: API responds with 409 Conflict.
     - Modal displays friendly error: *"A staff account with this phone number already exists."*
   - **Successful Creation**:
     - Enter Full Name: `Test Midwife Grace`.
     - Role: Select `Midwife`.
     - Phone: `08099882233` (throwaway Nigerian phone number).
     - Password: `Password123!`, Confirm Password: `Password123!`.
     - Click **Add staff**:
       - Button shows *"Adding..."* spinner.
       - Success toast displays: *"Staff account created."*
       - Modal closes, staff list reloads, and `Test Midwife Grace` appears with Teal Midwife badge.
4. **Edit Staff Account Modal (`PUT /api/admin/staff/:id`)**:
   - Locate the newly created `Test Midwife Grace` row. Click **Edit**.
   - Modal opens with pre-populated name, role, and phone.
   - Password field is empty with helper note: *"Leave blank to keep unchanged"*.
   - **Role Change Confirmation**:
     - Change Role from `Midwife` to `Doctor`.
     - Click **Save**.
     - Confirmation dialog opens: *"Are you sure you want to change Test Midwife Grace's role from MIDWIFE to DOCTOR? This will change their access level and portal permissions immediately."*
     - Click **Confirm role change**:
       - Button shows *"Updating..."*.
       - Success toast displays: *"Staff updated."*
       - Modal closes and row reflects the updated Doctor role (Blue badge).
   - **Admin Self-Role Protection**:
     - Find the current admin row (marked with `(You)`). Click **Edit**.
     - Verify the **Role** dropdown is disabled with lock notice: *"You cannot change your own admin role."*
     - Admin can still edit their own name, phone, or update their password, but cannot demote or alter their own administrative role.
   - **No Delete Action**:
     - Confirm there is NO delete button anywhere on staff rows or edit modals.
   - **Sensitive Data Security**:
     - Confirm that password hashes and plain-text passwords are never shown in the table or logged in console/audit.


---

### 8.4 Neon Console Database Link (`NEXT_PUBLIC_NEON_CONSOLE_URL`)
> 💡 **ADMIN CONSOLE SHORTCUT**: Quick-access link to the Neon project console for administrators.

1. **Configuration**:
   - In `frontend/.env.local`, set:
     ```env
     NEXT_PUBLIC_NEON_CONSOLE_URL=https://console.neon.tech/app/projects/<your-project-id>
     ```
   - **Crucial Requirement**: You **must restart the Next.js development server** (`npm run dev`) after creating or editing `.env.local` for the environment variable to be evaluated.
   - **Security Rules**:
     - Never enter a database connection string (`postgres://...` or `postgresql://...`).
     - Never embed database credentials (`user:password@`).
     - If the URL does not use `https:` or its hostname is not `console.neon.tech`, the safety guard hides the button completely.

2. **Verification on `/admin`**:
   - **Audit Log Tab Only**:
     - An "Open database" button appears in the System Audit Log tab, immediately next to the **Refresh** button in the same row.
     - Matches the Refresh button's size (`h-9 px-3.5 text-xs font-semibold`) and outline button styling with the `Database` icon and "Open database" label.
     - It does NOT appear in the top navigation bar or on any other admin tab.
     - Hover tooltip displays: *"Opens the Neon console in a new tab (needs your Neon login)"*.
     - Clicking the button opens the configured project console in a new tab (`target="_blank" rel="noopener noreferrer"`).
   - **Safety Fallback Verification**:
     - If `NEXT_PUBLIC_NEON_CONSOLE_URL` is empty, unset, contains credentials, or points to another domain, the button will not render.
