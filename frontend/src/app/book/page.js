'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicAPI, appointmentAPI, babyAPI } from '../../lib/api';

export default function BookAppointmentPage() {
  const [step, setStep] = useState(1); // 1: clinic, 2: date/slot, 3: type, 4: confirm
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [bookingType, setBookingType] = useState('mother');
  const [babies, setBabies] = useState([]);
  const [selectedBabies, setSelectedBabies] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadClinics();
    loadBabies();
  }, []);

  const loadClinics = async () => {
    try {
      const { data } = await clinicAPI.list();
      setClinics(data.data);
    } catch (err) {
      toast.error('Failed to load clinics.');
    }
  };

  const loadBabies = async () => {
    try {
      const { data } = await babyAPI.list();
      setBabies(data.data);
    } catch (err) {
      // Mother might not have babies yet
    }
  };

  const loadSlots = async (clinicId, date) => {
    setLoading(true);
    try {
      const { data } = await clinicAPI.getSlots(clinicId, date);
      setSlots(data.data.availableSlots);
    } catch (err) {
      toast.error('Failed to load available slots.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    if (selectedClinic) {
      loadSlots(selectedClinic.id, date);
    }
  };

  const handleBook = async () => {
    setLoading(true);
    try {
      await appointmentAPI.book({
        slot_id: selectedSlot.id,
        clinic_id: selectedClinic.id,
        booking_type: bookingType,
        baby_ids: selectedBabies,
      });

      toast.success('Appointment booked! You will receive an SMS confirmation.');
      router.push('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Booking failed.');
    } finally {
      setLoading(false);
    }
  };

  // Allow booking from today onwards
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : router.back()} className="text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">Book Appointment</h1>
          <span className="ml-auto text-sm text-gray-400">Step {step}/4</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div className="h-1 bg-primary-600 transition-all" style={{ width: `${(step / 4) * 100}%` }} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 1: Select Clinic */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Select Clinic</h2>
            {clinics.map((clinic) => (
              <button
                key={clinic.id}
                onClick={() => { setSelectedClinic(clinic); setStep(2); }}
                className={`card w-full text-left hover:shadow-md transition-shadow ${
                  selectedClinic?.id === clinic.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <h3 className="font-bold text-lg">{clinic.name}</h3>
                <p className="text-sm text-gray-500">{clinic.slot_duration_min}-minute appointments</p>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Select Date & Slot */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Select Date & Time</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Choose a date</label>
              <input
                type="date"
                className="input-field"
                min={minDate}
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
              />
            </div>

            {selectedDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Available slots ({slots.length})
                </p>
                {loading ? (
                  <p className="text-gray-400">Loading slots...</p>
                ) : slots.length === 0 ? (
                  <p className="text-gray-400">No available slots on this date.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => { setSelectedSlot(slot); setStep(3); }}
                        className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                          selectedSlot?.id === slot.id
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white hover:bg-primary-50 border-gray-200'
                        }`}
                      >
                        <Clock size={14} className="inline mr-1" />
                        {slot.start_time} - {slot.end_time}
                        {slot.is_walkin && <span className="block text-xs opacity-75">Walk-in slot</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Booking Type */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Who is this appointment for?</h2>
            {['mother', 'baby', 'both'].map((type) => (
              <button
                key={type}
                onClick={() => setBookingType(type)}
                className={`card w-full text-left ${
                  bookingType === type ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <span className="font-semibold capitalize">{type === 'both' ? 'Mother & Baby' : type}</span>
              </button>
            ))}

            {['baby', 'both'].includes(bookingType) && babies.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Select baby/babies:</p>
                {babies.map((baby) => (
                  <label key={baby.id} className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      checked={selectedBabies.includes(baby.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBabies([...selectedBabies, baby.id]);
                        } else {
                          setSelectedBabies(selectedBabies.filter((id) => id !== baby.id));
                        }
                      }}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span>{baby.name}</span>
                  </label>
                ))}
              </div>
            )}

            <button onClick={() => setStep(4)} className="btn-primary w-full">
              Continue
            </button>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Confirm Booking</h2>
            <div className="card space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Clinic</span>
                <span className="font-semibold">{selectedClinic?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span className="font-semibold">{selectedSlot?.start_time} - {selectedSlot?.end_time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">For</span>
                <span className="font-semibold capitalize">{bookingType === 'both' ? 'Mother & Baby' : bookingType}</span>
              </div>
              {selectedSlot?.staffName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Staff</span>
                  <span className="font-semibold">{selectedSlot.staffName}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-gray-500 text-center">
              You will receive an SMS confirmation and reminders before your appointment.
            </p>

            <button onClick={handleBook} className="btn-primary w-full" disabled={loading}>
              {loading ? 'Booking...' : (
                <span className="flex items-center justify-center gap-2">
                  <Check size={18} /> Confirm Booking
                </span>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
