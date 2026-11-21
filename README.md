# Antenatal & Postnatal Appointment System

A web-based appointment system with SMS reminders for antenatal and postnatal clinics in Nigeria.

## Tech Stack
- **Frontend:** Next.js (React), Tailwind CSS, PWA
- **Backend:** Node.js + Express (REST API)
- **Database:** PostgreSQL
- **SMS:** Termii
- **Auth:** JWT + bcrypt

## Getting Started

### Backend
```bash
cd backend
cp .env.example .env   # Edit with your credentials
npm install
npm run migrate
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000
