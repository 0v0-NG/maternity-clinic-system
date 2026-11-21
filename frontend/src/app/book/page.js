'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Baby,
  Users,
  CheckCircle2,
  Plus,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicAPI, appointmentAPI, babyAPI } from '../../lib/api';
import { getErrorMessage, getErrorCode } from '../../lib/errorMessages';
import {
  formatDate,
  formatTimeRange,
  formatTime12,
  getLagosToday,
} from '../../lib/dateTime';
import EmergencyNotice from '../../components/EmergencyNotice';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import SlotPicker from '../../components/SlotPicker';
import MotherBottomNav from '../../components/MotherBottomNav';

export default function BookAppointmentPage() {
  const router = useRouter();

  // Wizard step: 1 (Clinic & Who), 2 (Date & Time), 3 (Review & Confirm), 4 (Success)
  const [step, setStep] = useState(1);

  // Form selections
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [bookingType, setBookingType] = useState('mother'); // 'mother' | 'baby' | 'both'
  const [babies, setBabies] = useState([]);
  const [selectedBabies, setSelectedBabies] = useState([]);

  // SlotPicker state
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const slotPickerRef = useRef(null);

  // Loading & Submission states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [createdAppointment, setCreatedAppointment] = useState(null);

  // Inline Mini Form for adding a baby
  const [showAddBabyForm, setShowAddBabyForm] = useState(false);
  const [newBabyName, setNewBabyName] = useState('');
  const [newBabyDob, setNewBabyDob] = useState('');
  const [newBabySex, setNewBabySex] = useState('female');
  const [isSavingBaby, setIsSavingBaby] = useState(false);
  const [addBabyError, setAddBabyError] = useState('');

  // Access Control: mother only
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') {
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') {
        router.push('/login');
        return;
      }
      if (parsed.role === 'admin') {
        router.push('/admin');
        return;
      }
      if (['front_desk', 'midwife', 'doctor'].includes(parsed.role)) {
        router.push('/staff');
        return;
      }
      if (parsed.role !== 'mother') {
        router.push('/login');
        return;
      }
    } catch {
      router.push('/login');
      return;
    }

    loadInitialData();
  }, [router]);

  const loadInitialData = async () => {
    setLoadingInitial(true);
    try {
      const [clinicsRes, babiesRes] = await Promise.all([
        clinicAPI.list(),
        babyAPI.list().catch(() => ({ data: { data: [] } })),
      ]);
      const clinicsData = clinicsRes?.data?.data || [];
      const babiesData = babiesRes?.data?.data || [];

      setClinics(clinicsData);
      setBabies(babiesData);

      // Default select first clinic if available
      if (clinicsData.length > 0 && !selectedClinic) {
        setSelectedClinic(clinicsData[0]);
      }
    } catch (err) {
      toast.error('Failed to load clinic options. Please refresh.');
    } finally {
      setLoadingInitial(false);
    }
  };

  // Determine clinic type
  const isAntenatal = selectedClinic?.name?.toLowerCase().includes('antenatal');
  const isPostnatal = selectedClinic?.name?.toLowerCase().includes('postnatal');

  // Handle clinic selection
  const handleSelectClinic = (clinic) => {
    setSelectedClinic(clinic);
    setSelectedSlot(null); // Reset slot if clinic changes
    if (clinic?.name?.toLowerCase().includes('antenatal')) {
      setBookingType('mother');
      setSelectedBabies([]);
    }
  };

  // Toggle baby checkbox
  const handleToggleBaby = (babyId) => {
    setSelectedBabies((prev) =>
      prev.includes(babyId) ? prev.filter((id) => id !== babyId) : [...prev, babyId]
    );
  };

  // Inline baby creation
  const handleSaveNewBaby = async (e) => {
    e.preventDefault();
    if (!newBabyName.trim()) {
      setAddBabyError('Please enter the baby\'s name.');
      return;
    }
    if (!newBabyDob) {
      setAddBabyError('Please select the date of birth.');
      return;
    }

    setIsSavingBaby(true);
    setAddBabyError('');

    try {
      const res = await babyAPI.add({
        name: newBabyName.trim(),
        date_of_birth: newBabyDob,
        sex: newBabySex,
      });
      const addedBaby = res?.data?.data;
      if (addedBaby) {
        setBabies((prev) => [...prev, addedBaby]);
        toast.success('Baby profile added!');
      }
      // Reset form
      setNewBabyName('');
      setNewBabyDob('');
      setNewBabySex('female');
      setShowAddBabyForm(false);
    } catch (err) {
      setAddBabyError(getErrorMessage(err, 'Failed to save baby profile.'));
    } finally {
      setIsSavingBaby(false);
    }
  };

  // Step 1 Validation
  const canProceedFromStep1 = () => {
    if (!selectedClinic) return false;
    if (isPostnatal && (bookingType === 'baby' || bookingType === 'both')) {
      return selectedBabies.length > 0;
    }
    return true;
  };

  // Back Button handler
  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    } else {
      router.push('/dashboard');
    }
  };

  // Step 3 Submission
  const handleConfirmBooking = async () => {
    if (isSubmitting) return;
    if (!selectedClinic || !selectedSlot) {
      setBookingError('Please complete all booking steps.');
      return;
    }

    setIsSubmitting(true);
    setBookingError('');

    const payload = {
      clinic_id: selectedClinic.id,
      slot_id: selectedSlot.id,
      booking_type: bookingType,
    };

    if (bookingType === 'baby' || bookingType === 'both') {
      payload.baby_ids = selectedBabies;
    }

    try {
      const res = await appointmentAPI.book(payload);
      const apptData = res?.data?.data;
      setCreatedAppointment(apptData);
      setStep(4); // Success screen
      toast.success('Appointment booked successfully!');
    } catch (err) {
      const code = getErrorCode(err);

      if (code === 'SLOT_TAKEN') {
        toast.error('Another patient just took this slot. Please choose another time.');
        setSelectedSlot(null);
        setStep(2); // Go back to Step 2
        if (slotPickerRef.current && slotPickerRef.current.reload) {
          slotPickerRef.current.reload();
        }
      } else if (code === 'SLOT_PAST') {
        setBookingError('This time slot has already passed. Please select an upcoming slot.');
        setStep(2);
      } else if (code === 'OVERLAP') {
        setBookingError('You already have an appointment at this time.');
      } else if (code === 'SLOT_RESERVED') {
        setBookingError('This slot is reserved for hospital walk-in patients. Please choose another.');
      } else if (code === 'BOOKING_TYPE_INVALID') {
        setBookingError('This booking type is not allowed for the clinic you chose.');
      } else if (code === 'VALIDATION_ERROR') {
        setBookingError('Please check your entry and try again.');
      } else if (code === 'FORBIDDEN') {
        setBookingError('You do not have permission to book this appointment.');
      } else {
        setBookingError(getErrorMessage(err, 'Failed to book appointment. Please try again.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to format who the visit is for in summary
  const getSelectedBabyNames = () => {
    return babies
      .filter((b) => selectedBabies.includes(b.id))
      .map((b) => b.name)
      .join(', ');
  };

  const getWhoForSummary = () => {
    const names = getSelectedBabyNames();
    if (bookingType === 'baby') {
      return names ? `Baby (${names})` : 'Baby';
    }
    if (bookingType === 'both') {
      return names ? `Mother & Baby (${names})` : 'Mother & Baby';
    }
    return 'Mother';
  };

  const todayStr = getLagosToday();

  // -------------------------------------------------------------
  // SUCCESS SCREEN (Step 4)
  // -------------------------------------------------------------
  if (step === 4 && createdAppointment) {
    return (
      <div className="min-h-screen bg-clinic-50 pb-24">
        <EmergencyNotice />

        <main className="max-w-md mx-auto px-4 py-8 space-y-6">
          {/* Confirmed Banner */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="text-2xl font-extrabold text-clinic-dark">
              Booking Confirmed!
            </h1>
            <p className="text-xs text-body-muted">
              Your appointment has been registered with the hospital.
            </p>
          </div>

          {/* Appointment Summary Card */}
          <Card className="p-5 space-y-4 shadow-sm border-primary-200">
            <div className="border-b border-border pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                Scheduled Session
              </span>
              <h2 className="text-base font-bold text-body">
                {selectedClinic?.name}
              </h2>
            </div>

            <div className="bg-clinic-50 rounded-xl p-3 text-xs space-y-2 border border-primary-100">
              <div className="flex items-center gap-2 text-body">
                <Calendar size={15} className="text-primary-600 flex-shrink-0" />
                <span className="font-bold">
                  {formatDate(selectedSlot?.date || selectedDate)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-body">
                <Clock size={15} className="text-primary-600 flex-shrink-0" />
                <span>
                  {formatTimeRange(selectedSlot?.start_time, selectedSlot?.end_time)} (Lagos Time)
                </span>
              </div>
              <div className="flex items-center gap-2 text-body">
                <User size={15} className="text-primary-600 flex-shrink-0" />
                <span>
                  For: <strong className="font-semibold text-clinic-dark">{getWhoForSummary()}</strong>
                </span>
              </div>
            </div>

            {/* SMS Reminder Notice */}
            <div className="bg-white rounded-xl border border-border p-3 text-xs text-body-muted space-y-1">
              <p className="font-semibold text-body">📱 SMS Reminders</p>
              <p>
                SMS reminders will be sent to your registered phone number 24 hours and 2 hours
                before your appointment.
              </p>
            </div>
          </Card>

          {/* Action Buttons */}
          <div>
            <Link href={`/appointments/${createdAppointment.id}`} className="block">
              <Button variant="primary" className="w-full text-sm">
                View appointment
              </Button>
            </Link>
          </div>
        </main>

        <MotherBottomNav />
      </div>
    );
  }

  // -------------------------------------------------------------
  // WIZARD STEPS (Steps 1, 2, 3)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-clinic-50 pb-24">
      {/* Top Emergency Notice */}
      <EmergencyNotice />

      {/* Header with Back button and Step indicator */}
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              className="text-body-muted hover:text-body p-1 -ml-1 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-base font-bold text-body">Book Appointment</h1>
          </div>
          <span className="text-xs font-bold text-primary-600 bg-primary-50 border border-primary-200 px-2.5 py-1 rounded-full">
            Step {step} of 3
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-1 bg-gray-100 w-full overflow-hidden">
          <div
            className="h-1 bg-primary-500 transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </header>

      {/* Main Wizard Form Container */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-5">
        {loadingInitial ? (
          <div className="space-y-4">
            <Skeleton height={24} className="w-1/3" />
            <Skeleton height={80} className="w-full rounded-xl" />
            <Skeleton height={80} className="w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* ========================================================= */}
            {/* STEP 1: Clinic and Who It Is For                          */}
            {/* ========================================================= */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Clinic Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-body-muted mb-2">
                    1. Choose Clinic
                  </label>
                  <div className="space-y-3">
                    {clinics.map((clinic) => {
                      const isSelected = selectedClinic?.id === clinic.id;
                      return (
                        <button
                          key={clinic.id}
                          type="button"
                          onClick={() => handleSelectClinic(clinic)}
                          className={`w-full text-left p-4 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-500 shadow-sm'
                              : 'bg-white border-border hover:border-primary-300 hover:bg-clinic-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-body text-base">
                                {clinic.name}
                              </h3>
                              <p className="text-xs text-body-muted mt-0.5">
                                {clinic.slot_duration_min}-minute consultation sessions
                              </p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                                isSelected
                                  ? 'border-primary-500 bg-primary-500 text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Who is this visit for? */}
                {selectedClinic && (
                  <div className="pt-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-body-muted mb-2">
                      2. Who is this visit for?
                    </label>

                    {/* Antenatal Clinic -> Mother only sentence */}
                    {isAntenatal && (
                      <div className="bg-clinic-50 border border-primary-200 rounded-xl p-4 text-xs text-clinic-dark flex items-center gap-2">
                        <User size={18} className="text-primary-600 flex-shrink-0" />
                        <span>
                          Antenatal visits are for the mother only.
                        </span>
                      </div>
                    )}

                    {/* Postnatal Clinic -> Me / My baby / Me and my baby */}
                    {isPostnatal && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'mother', label: 'Me', icon: User },
                            { id: 'baby', label: 'My baby', icon: Baby },
                            { id: 'both', label: 'Me & my baby', icon: Users },
                          ].map(({ id, label, icon: Icon }) => {
                            const isSelected = bookingType === id;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setBookingType(id)}
                                className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl border text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                                    : 'bg-white text-body border-border hover:border-primary-300'
                                }`}
                              >
                                <Icon size={20} className="mb-1" />
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Baby Selection (When "baby" or "both") */}
                        {(bookingType === 'baby' || bookingType === 'both') && (
                          <div className="bg-white border border-border rounded-xl p-4 space-y-3">
                            <div>
                              <span className="text-xs font-bold text-body">
                                Select baby (one or more for twins)
                              </span>
                            </div>

                            {/* Existing Babies Checkbox List */}
                            {babies.length > 0 && (
                              <div className="space-y-2">
                                {babies.map((baby) => {
                                  const isChecked = selectedBabies.includes(baby.id);
                                  return (
                                    <label
                                      key={baby.id}
                                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                                        isChecked
                                          ? 'border-primary-500 bg-primary-50/40 font-semibold'
                                          : 'border-border bg-white hover:bg-clinic-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleBaby(baby.id)}
                                          className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        />
                                        <div>
                                          <p className="text-xs text-body font-bold">{baby.name}</p>
                                          <p className="text-[11px] text-body-muted">
                                            DOB: {formatDate(baby.date_of_birth)} · {baby.sex}
                                          </p>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* Under the list: "Add another baby" button that reopens the mini form */}
                            {babies.length > 0 && !showAddBabyForm && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddBabyForm(true);
                                  setAddBabyError('');
                                }}
                                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1.5 py-1"
                              >
                                <Plus size={14} /> Add another baby
                              </button>
                            )}

                            {/* Inline Mini Form for Adding Baby */}
                            {(babies.length === 0 || showAddBabyForm) && (
                              <div className="bg-clinic-50 border border-primary-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-clinic-dark">
                                    Add Baby Profile
                                  </h4>
                                  {babies.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAddBabyForm(false);
                                        setAddBabyError('');
                                      }}
                                      className="text-xs text-body-muted hover:text-body"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>

                                {addBabyError && (
                                  <div className="text-[11px] text-status-emergency bg-red-50 border border-red-200 rounded-lg p-2">
                                    {addBabyError}
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                                      Baby's Name *
                                    </label>
                                    <input
                                      type="text"
                                      value={newBabyName}
                                      onChange={(e) => setNewBabyName(e.target.value)}
                                      placeholder="e.g. Fatima Bello"
                                      className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                      disabled={isSavingBaby}
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                                        Date of Birth *
                                      </label>
                                      <input
                                        type="date"
                                        max={todayStr}
                                        value={newBabyDob}
                                        onChange={(e) => setNewBabyDob(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        disabled={isSavingBaby}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-semibold text-body-muted mb-0.5">
                                        Sex *
                                      </label>
                                      <select
                                        value={newBabySex}
                                        onChange={(e) => setNewBabySex(e.target.value)}
                                        className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        disabled={isSavingBaby}
                                      >
                                        <option value="female">Female</option>
                                        <option value="male">Male</option>
                                      </select>
                                    </div>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="primary"
                                    onClick={handleSaveNewBaby}
                                    disabled={isSavingBaby}
                                    className="w-full h-10 text-xs mt-2"
                                  >
                                    {isSavingBaby ? 'Saving...' : 'Save'}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Validation warning if no baby chosen */}
                            {selectedBabies.length === 0 && (
                              <p className="text-[11px] text-amber-700 flex items-center gap-1 pt-1">
                                <AlertCircle size={13} />
                                Please select or add at least one baby to continue.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 1 Next Button */}
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!canProceedFromStep1()}
                    onClick={() => setStep(2)}
                    className="w-full text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 2: Date and Time                                     */}
            {/* ========================================================= */}
            {step === 2 && selectedClinic && (
              <div className="space-y-5">
                {/* Selected Clinic Chip Summary */}
                <div className="bg-white border border-border rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-body-muted">
                      Clinic
                    </span>
                    <p className="font-bold text-clinic-dark text-sm">{selectedClinic.name}</p>
                    <p className="text-[11px] text-body-muted">
                      For: {getWhoForSummary()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-primary-600 font-semibold hover:underline"
                  >
                    Change
                  </button>
                </div>

                {/* Reusable SlotPicker */}
                <Card className="p-4">
                  <SlotPicker
                    ref={slotPickerRef}
                    clinicId={selectedClinic.id}
                    selectedSlotId={selectedSlot?.id}
                    onSelectSlot={(slot) => {
                      setSelectedSlot(slot);
                      setSelectedDate(slot.date);
                    }}
                    initialDate={selectedDate || selectedSlot?.date}
                  />
                </Card>

                {/* Selected Slot Preview */}
                {selectedSlot && (
                  <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 text-xs text-clinic-dark font-medium flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase tracking-wide text-primary-700 font-bold block">
                        Selected Time
                      </span>
                      <span className="font-bold text-sm">
                        {formatTime12(selectedSlot.start_time)}
                      </span>
                      {selectedSlot.staffName && (
                        <span className="block text-[11px] text-body-muted">
                          Doctor/Midwife: {selectedSlot.staffName}
                        </span>
                      )}
                    </div>
                    <CheckCircle2 size={20} className="text-primary-600" />
                  </div>
                )}

                {/* Step 2 Next Button */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="w-1/3 text-xs"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!selectedSlot}
                    onClick={() => setStep(3)}
                    className="flex-1 text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 3: Review and Confirm                                */}
            {/* ========================================================= */}
            {step === 3 && selectedClinic && selectedSlot && (
              <div className="space-y-5">
                <Card className="p-5 space-y-4 shadow-sm border-primary-200">
                  <div className="border-b border-border pb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                      Appointment Summary
                    </span>
                    <h2 className="text-base font-bold text-body">
                      {selectedClinic.name}
                    </h2>
                  </div>

                  {/* Date, Time, Who breakdown */}
                  <div className="bg-clinic-50 rounded-xl p-3.5 text-xs space-y-2.5 border border-primary-100">
                    <div className="flex items-center gap-2 text-body">
                      <Calendar size={15} className="text-primary-600 flex-shrink-0" />
                      <span>
                        <strong className="font-semibold">Date:</strong>{' '}
                        {formatDate(selectedSlot.date || selectedDate)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-body">
                      <Clock size={15} className="text-primary-600 flex-shrink-0" />
                      <span>
                        <strong className="font-semibold">Time:</strong>{' '}
                        {formatTimeRange(selectedSlot.start_time, selectedSlot.end_time)} (12-Hour Lagos Time)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-body">
                      <User size={15} className="text-primary-600 flex-shrink-0" />
                      <span>
                        <strong className="font-semibold">Who it is for:</strong>{' '}
                        {getWhoForSummary()}
                      </span>
                    </div>

                    {selectedSlot.staffName && (
                      <div className="flex items-center gap-2 text-body">
                        <Users size={15} className="text-primary-600 flex-shrink-0" />
                        <span>
                          <strong className="font-semibold">Attending Staff:</strong>{' '}
                          {selectedSlot.staffName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 4-Hour Cancellation Policy Reminder */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
                    <strong className="block font-semibold mb-0.5">Policy Notice:</strong>
                    You can reschedule or cancel this appointment free of charge up to 4 hours before
                    the scheduled start time via your dashboard.
                  </div>

                  {/* Booking Error Banner */}
                  {bookingError && (
                    <div className="bg-red-50 border border-red-200 text-status-emergency text-xs rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                      <span>{bookingError}</span>
                    </div>
                  )}

                  {/* Confirm Button */}
                  <div className="pt-2 space-y-2">
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleConfirmBooking}
                      disabled={isSubmitting}
                      className="w-full text-base font-bold"
                    >
                      {isSubmitting ? 'Confirming booking...' : 'Confirm booking'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(2)}
                      disabled={isSubmitting}
                      className="w-full text-xs"
                    >
                      Change Date or Time
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
