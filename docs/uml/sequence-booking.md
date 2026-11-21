# Sequence Diagram: Appointment Booking Flow

```mermaid
sequenceDiagram
    actor Mother
    participant FE as Frontend (PWA)
    participant API as Backend API
    participant DB as PostgreSQL
    participant SMS as Termii SMS

    Mother->>FE: Select clinic, date, slot
    FE->>API: GET /api/clinics/:id/slots?date=...
    API->>DB: Query available slots (LEFT JOIN appointments)
    DB-->>API: Available slots
    API-->>FE: Slot list
    FE-->>Mother: Display available slots

    Mother->>FE: Choose slot + booking type (mother/baby/both)
    FE->>API: POST /api/appointments
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT slot FOR UPDATE (row lock)
    DB-->>API: Slot data

    alt Slot already taken
        API-->>FE: 409 Conflict
        FE-->>Mother: "Slot already booked"
    else Overlapping appointment exists
        API-->>FE: 409 Conflict
        FE-->>Mother: "You have an overlapping appointment"
    else Slot available
        API->>DB: INSERT appointment
        API->>DB: INSERT appointment_babies (if baby/both)
        API->>DB: COMMIT
        API->>DB: INSERT audit_log
        API->>SMS: Send booking confirmation SMS
        SMS-->>Mother: SMS: "Appointment confirmed!"
        API-->>FE: 201 Created
        FE-->>Mother: "Booking confirmed!"
    end
```
