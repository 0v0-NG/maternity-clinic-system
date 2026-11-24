'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  User,
  Baby,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowLeft,
  ShieldCheck,
  Building,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motherAPI, clinicAPI, babyAPI, appointmentAPI } from '../../lib/api';
import { getErrorMessage, getErrorCode } from '../../lib/errorMessages';
import {
  formatDate,
  formatTimeRange,
  formatTime12,
  getLagosToday,
  formatWhoFor,
} from '../../lib/dateTime';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import SlotPicker from '../clinic/SlotPicker';

export default function WalkInBookingModal({
  isOpen,
  onClose,
  onBookingComplete,
  clinics = [],
  preselectedMother = null,
}) {
  // Wizard steps:
  // 1: Find or Register Mother
  // 2: Clinic & Who it is for
  // 3: Date & Slot
  // 4: Review & Confirm
  // 5: Success & Check-in
  const [step, setStep] = useState(1);

  // Step 1: Mother Search & Registration
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedMother, setSelectedMother] = useState(null);

  // Inline Registration
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regHospitalId, setRegHospitalId] = useState('');
  const [regHmoNumber, setRegHmoNumber] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState('');

  // Step 2: Clinic & Attendee
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [bookingType, setBookingType] = useState('mother'); // 'mother' | 'baby' | 'both'
  const [motherBabies, setMotherBabies] = useState([]);
  const [selectedBabies, setSelectedBabies] = useState([]);

  // Inline Baby Form
  const [showAddBabyForm, setShowAddBabyForm] = useState(false);
  const [newBabyName, setNewBabyName] = useState('');
  const [newBabyDob, setNewBabyDob] = useState('');
  const [newBabySex, setNewBabySex] = useState('female');
  const [isSavingBaby, setIsSavingBaby] = useState(false);
  const [addBabyError, setAddBabyError] = useState('');

  // Step 3: SlotPicker
  const [selectedSlot, setSelectedSlot] = useState(null);
  const slotPickerRef = useRef(null);

  // Step 4: Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [createdAppointment, setCreatedAppointment] = useState(null);

  // Step 5: Check-in
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInTicket, setCheckInTicket] = useState(null);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      if (preselectedMother) {
        setSelectedMother(preselectedMother);
        setMotherBabies(preselectedMother.babies || []);
        setStep(2);
      } else {
        setStep(1);
        setSelectedMother(null);
        setMotherBabies([]);
      }
      setSearchQuery('');
      setSearchResults([]);
      setHasSearched(false);
      setSearchError('');
      setShowRegisterForm(false);
      setRegName('');
      setRegPhone('');
      setRegHospitalId('');
      setRegHmoNumber('');
      setRegConsent(false);
      setRegError('');
      setSelectedClinic(clinics.length > 0 ? clinics[0] : null);
      setBookingType('mother');
      setSelectedBabies([]);
      setShowAddBabyForm(false);
      setSelectedSlot(null);
      setBookingError('');
      setCreatedAppointment(null);
      setCheckInTicket(null);
    }
  }, [isOpen, preselectedMother, clinics]);

  // Debounced search when searchQuery changes
  useEffect(() => {
    if (!isOpen || showRegisterForm) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      setHasSearched(false);
      setSearchError('');
      return;
    }

    setIsSearching(true);
    setSearchError('');

    const timer = setTimeout(async () => {
      try {
        const res = await motherAPI.search(trimmed);
        const data = res?.data?.data || [];
        setSearchResults(data);
        setHasSearched(true);
      } catch (err) {
        setSearchError(getErrorMessage(err, 'Failed to search for patients.'));
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, showRegisterForm]);

  if (!isOpen) return null;

  // --- Handlers ---

  // Select existing mother
  const handleSelectMother = (mother) => {
    setSelectedMother(mother);
    setMotherBabies(mother.babies || []);
    setSelectedBabies([]);
    setStep(2);
  };

  // Register new mother at desk
  const handleRegisterMother = async (e) => {
    e.preventDefault();
    if (!regName.trim()) {
      setRegError('Patient name is required.');
      return;
    }
    if (!regPhone.trim()) {
      setRegError('Phone number is required.');
      return;
    }
    if (!regConsent) {
      setRegError('Patient verbal consent is required for staff registration.');
      return;
    }

    setIsRegistering(true);
    setRegError('');

    try {
      const res = await motherAPI.registerByStaff({
        name: regName.trim(),
        phone: regPhone.trim(),
        hospital_id: regHospitalId.trim() || undefined,
        hmo_number: regHmoNumber.trim() || undefined,
        consent_confirmed: true,
      });

      const newMother = res?.data?.data;
      toast.success('Patient registered successfully!');
      setSelectedMother(newMother);
      setMotherBabies([]);
      setSelectedBabies([]);
      setShowRegisterForm(false);
      setStep(2);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'CONFLICT') {
        setRegError(
          'A patient with this phone number is already registered. Please search for her instead.'
        );
      } else if (code === 'CONSENT_REQUIRED') {
        setRegError('Patient verbal consent is required for staff registration.');
      } else {
        setRegError(getErrorMessage(err, 'Failed to register patient.'));
      }
    } finally {
      setIsRegistering(false);
    }
  };

  // Clinic selection
  const handleSelectClinic = (clinic) => {
    setSelectedClinic(clinic);
    setSelectedSlot(null);
    if (clinic.name?.toLowerCase().includes('antenatal')) {
      setBookingType('mother');
      setSelectedBabies([]);
    }
  };

  // Toggle baby selection
  const handleToggleBaby = (babyId) => {
    setSelectedBabies((prev) =>
      prev.includes(babyId) ? prev.filter((id) => id !== babyId) : [...prev, babyId]
    );
  };

  // Add baby for mother
  const handleSaveBaby = async (e) => {
    e.preventDefault();
    if (!newBabyName.trim()) {
      setAddBabyError("Please enter the baby's name.");
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
        mother_id: selectedMother.id,
      });

      const added = res?.data?.data;
      if (added) {
        // Add baby unticked to the list
        setMotherBabies((prev) => [...prev, added]);
        toast.success('Baby profile added!');
      }

      setNewBabyName('');
      setNewBabyDob('');
      setNewBabySex('female');
      setShowAddBabyForm(false);
    } catch (err) {
      setAddBabyError(getErrorMessage(err, 'Failed to add baby.'));
    } finally {
      setIsSavingBaby(false);
    }
  };

  // Step 2 validation
  const isAntenatal = selectedClinic?.name?.toLowerCase().includes('antenatal');
  const isPostnatal = selectedClinic?.name?.toLowerCase().includes('postnatal');

  const canProceedStep2 = () => {
    if (!selectedClinic) return false;
    if (isPostnatal && (bookingType === 'baby' || bookingType === 'both')) {
      return selectedBabies.length > 0;
    }
    return true;
  };

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (isSubmitting) return;
    if (!selectedMother || !selectedClinic || !selectedSlot) {
      setBookingError('Please complete all booking steps.');
      return;
    }

    setIsSubmitting(true);
    setBookingError('');

    const payload = {
      mother_id: selectedMother.id,
      clinic_id: selectedClinic.id,
      slot_id: selectedSlot.id,
      booking_type: bookingType,
    };

    if (bookingType === 'baby' || bookingType === 'both') {
      payload.baby_ids = selectedBabies;
    }

    try {
      const res = await appointmentAPI.book(payload);
      const appt = res?.data?.data;
      setCreatedAppointment(appt);
      setStep(5); // Success step
      toast.success('Appointment booked successfully!');
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'SLOT_TAKEN') {
        toast.error('Another patient just took this slot. Please choose another time.');
        setSelectedSlot(null);
        setStep(3); // Go back to slot selection
        if (slotPickerRef.current?.reload) slotPickerRef.current.reload();
      } else if (code === 'SLOT_PAST') {
        setBookingError('This time slot has already passed. Please select an upcoming slot.');
        setStep(3);
      } else if (code === 'OVERLAP') {
        setBookingError('The patient already has an appointment during this time.');
      } else if (code === 'BOOKING_TYPE_INVALID') {
        setBookingError('This booking type is not allowed for the clinic you chose.');
      } else if (code === 'SLOT_RESERVED') {
        setBookingError('This slot is reserved. Please choose another.');
      } else if (code === 'VALIDATION_ERROR') {
        setBookingError('Please check all fields and try again.');
      } else if (code === 'FORBIDDEN') {
        setBookingError('You do not have permission to book this appointment.');
      } else {
        setBookingError(getErrorMessage(err, 'Failed to book appointment.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5: Check in now
  const handleCheckInNow = async () => {
    if (!createdAppointment || isCheckingIn) return;
    const bookingDate =
      selectedSlot?.slot_date ||
      selectedSlot?.date ||
      createdAppointment?.slot_date ||
      createdAppointment?.date;
    const todayStr = getLagosToday();
    if (bookingDate && bookingDate !== todayStr) {
      toast.error('Check-in is only allowed on the day of your appointment.');
      return;
    }
    setIsCheckingIn(true);
    try {
      const res = await appointmentAPI.checkIn(createdAppointment.id);
      const data = res?.data?.data;
      const queueNum = data?.queueNumber || data?.queue_number || 'Assigned';
      setCheckInTicket(queueNum);
      toast.success(`Patient checked in! Queue Ticket: ${queueNum}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Check-in not allowed for this appointment.'));
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleFinishAndClose = () => {
    if (onBookingComplete) {
      onBookingComplete(createdAppointment);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-clinic-50 border-b border-border px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
              📋
            </div>
            <div>
              <h2 className="text-sm font-bold text-body">
                {step === 5
                  ? 'Booking Confirmed'
                  : `New Booking — Step ${step} of 4`}
              </h2>
              <p className="text-[11px] text-body-muted">
                {step === 1 && 'Find or register the patient'}
                {step === 2 && 'Select clinic and who the visit is for'}
                {step === 3 && 'Choose appointment date and time slot'}
                {step === 4 && 'Review details and confirm'}
                {step === 5 && 'Check in arriving patient or return to list'}
              </p>
            </div>
          </div>
          {step !== 5 && (
            <button
              type="button"
              onClick={onClose}
              className="text-body-muted hover:text-body p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-border transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* ============================================================= */}
          {/* STEP 1: FIND OR REGISTER MOTHER                                */}
          {/* ============================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              {!showRegisterForm ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-body">
                      Search Patient
                    </label>
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-body-muted"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by mother's name or phone number..."
                        className="w-full text-xs pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-body-muted">
                      Type at least 3 characters to search hospital records.
                    </p>
                  </div>

                  {/* Search Results */}
                  {isSearching ? (
                    <div className="space-y-2 py-2">
                      <Skeleton height={56} className="w-full rounded-xl" />
                      <Skeleton height={56} className="w-full rounded-xl" />
                    </div>
                  ) : searchError ? (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-emergency flex items-center gap-2">
                      <AlertCircle size={15} />
                      <span>{searchError}</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      <p className="text-[11px] font-semibold text-body-muted">
                        Select a patient from results:
                      </p>
                      {searchResults.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleSelectMother(m)}
                          className="p-3 border border-border rounded-xl hover:border-primary-500 hover:bg-primary-50/40 cursor-pointer transition-all flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                              <User size={16} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-body">
                                  {m.name}
                                </span>
                                {m.registered_by_staff && (
                                  <span className="text-[9px] bg-clinic-100 text-primary-800 px-1.5 py-0.5 rounded-full font-bold">
                                    Desk Reg
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-body-muted">
                                Phone: <strong>{m.phone}</strong>
                                {m.hospital_id && ` · ID: ${m.hospital_id}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded-lg">
                              {m.babies?.length || 0}{' '}
                              {m.babies?.length === 1 ? 'baby' : 'babies'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : hasSearched && searchQuery.trim().length >= 3 ? (
                    <Card className="p-5 text-center space-y-3 bg-clinic-50/50">
                      <p className="text-xs font-semibold text-body">
                        No mother found matching &ldquo;{searchQuery}&rdquo;.
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          setShowRegisterForm(true);
                          setRegPhone(searchQuery.replace(/\D/g, '') ? searchQuery : '');
                        }}
                        className="text-xs h-9 mx-auto px-4 gap-1.5"
                      >
                        <Plus size={14} /> Register new mother
                      </Button>
                    </Card>
                  ) : null}

                  {/* Manual Register Button */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                    <span className="text-body-muted">First-time patient?</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRegisterForm(true)}
                      className="text-xs h-8 px-3 gap-1"
                    >
                      <Plus size={13} /> Register new mother
                    </Button>
                  </div>
                </>
              ) : (
                /* Inline Registration Form */
                <form onSubmit={handleRegisterMother} className="space-y-3.5">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <h3 className="text-xs font-bold text-body">
                      Register Mother at Desk
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowRegisterForm(false)}
                      className="text-xs text-primary-600 font-semibold hover:underline"
                    >
                      Back to search
                    </button>
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-emergency flex items-start gap-2">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                      <div className="space-y-1.5">
                        <p>{regError}</p>
                        {regError.includes('already registered') && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowRegisterForm(false);
                              setSearchQuery(regPhone);
                            }}
                            className="text-primary-700 font-bold underline block"
                          >
                            Search for {regPhone}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-body">
                      Mother Name *
                    </label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Amina Bello"
                      className="w-full text-xs px-3 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-body">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="w-full text-xs px-3 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-body">
                        Hospital ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={regHospitalId}
                        onChange={(e) => setRegHospitalId(e.target.value)}
                        placeholder="e.g. HOSP-1234"
                        className="w-full text-xs px-3 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-body">
                        HMO / NHIA Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={regHmoNumber}
                        onChange={(e) => setRegHmoNumber(e.target.value)}
                        placeholder="e.g. HMO-5678"
                        className="w-full text-xs px-3 py-2 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {/* Required Consent Checkbox */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-primary-200 bg-primary-50/50 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={regConsent}
                      onChange={(e) => setRegConsent(e.target.checked)}
                      className="mt-0.5 rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                      required
                    />
                    <span className="text-body font-medium leading-relaxed">
                      The mother agrees to her and her baby&apos;s data being stored
                      (NDPA 2023).
                    </span>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowRegisterForm(false)}
                      className="text-xs h-9 px-4"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isRegistering || !regConsent}
                      className="text-xs h-9 px-5 font-bold"
                    >
                      {isRegistering ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 2: CLINIC & WHO IT IS FOR                                */}
          {/* ============================================================= */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Selected Mother Summary */}
              <div className="bg-primary-50/60 border border-primary-200 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 block">
                    Patient Selected
                  </span>
                  <span className="font-bold text-body text-sm">
                    {selectedMother?.name}
                  </span>
                  <span className="text-body-muted ml-2">· {selectedMother?.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-primary-700 font-bold hover:underline"
                >
                  Change
                </button>
              </div>

              {/* Clinic Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-body">
                  Select Clinic
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {clinics.map((clinic) => {
                    const isSelected = selectedClinic?.id === clinic.id;
                    return (
                      <div
                        key={clinic.id}
                        onClick={() => handleSelectClinic(clinic)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${isSelected
                          ? 'border-primary-500 bg-primary-50/50 shadow-xs'
                          : 'border-border bg-white hover:border-primary-200'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-body">
                            {clinic.name}
                          </span>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-primary-600" />
                          )}
                        </div>
                        <p className="text-[11px] text-body-muted">
                          {clinic.slot_duration_min || 20} min appointment slot
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Who it is for */}
              {isAntenatal && (
                <div className="p-3 bg-clinic-50 border border-border rounded-xl text-xs text-body leading-relaxed">
                  <span className="font-bold text-primary-700 block mb-0.5">
                    Antenatal Clinic:
                  </span>
                  The visit is for the mother only.
                </div>
              )}

              {isPostnatal && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <label className="block text-xs font-bold text-body">
                    Who is this visit for?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'mother', label: 'Mother', icon: User },
                      { type: 'baby', label: 'Baby', icon: Baby },
                      { type: 'both', label: 'Mother & baby', icon: Users },
                    ].map(({ type, label, icon: Icon }) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setBookingType(type);
                          if (type === 'mother') setSelectedBabies([]);
                        }}
                        className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${bookingType === type
                          ? 'border-primary-500 bg-primary-50/60 text-primary-700 font-bold shadow-2xs'
                          : 'border-border bg-white text-body hover:bg-clinic-50'
                          }`}
                      >
                        <Icon size={18} />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Baby Selector for Postnatal */}
                  {(bookingType === 'baby' || bookingType === 'both') && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-body">
                          Select baby (one or more for twins) *
                        </label>
                        {!showAddBabyForm && (
                          <button
                            type="button"
                            onClick={() => setShowAddBabyForm(true)}
                            className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"
                          >
                            <Plus size={13} /> Add baby
                          </button>
                        )}
                      </div>

                      {/* Babies Checkbox List */}
                      {motherBabies.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {motherBabies.map((b) => {
                            const isTicked = selectedBabies.includes(b.id);
                            return (
                              <div
                                key={b.id}
                                onClick={() => handleToggleBaby(b.id)}
                                className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${isTicked
                                  ? 'border-primary-500 bg-primary-50/50 shadow-2xs'
                                  : 'border-border bg-white hover:border-primary-200'
                                  }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isTicked}
                                  onChange={() => { }}
                                  className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4 pointer-events-none"
                                />
                                <div>
                                  <span className="font-bold text-xs text-body block">
                                    {b.name}
                                  </span>
                                  <span className="text-[10px] text-body-muted capitalize">
                                    {b.sex} · DOB: {formatDate(b.date_of_birth)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-body-muted italic">
                          No babies registered for this mother yet. Please add a baby
                          below.
                        </p>
                      )}

                      {/* Mini Inline Add Baby Form */}
                      {showAddBabyForm && (
                        <form
                          onSubmit={handleSaveBaby}
                          className="p-3 bg-clinic-50 border border-border rounded-xl space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-border pb-1.5 font-bold text-body">
                            <span>Add Baby Profile</span>
                            <button
                              type="button"
                              onClick={() => setShowAddBabyForm(false)}
                              className="text-body-muted hover:text-body"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {addBabyError && (
                            <p className="text-status-emergency font-semibold">
                              {addBabyError}
                            </p>
                          )}

                          <div className="space-y-1">
                            <label className="font-semibold text-body">
                              Baby Name *
                            </label>
                            <input
                              type="text"
                              value={newBabyName}
                              onChange={(e) => setNewBabyName(e.target.value)}
                              placeholder="e.g. Baby Aisha"
                              className="w-full px-2.5 py-1.5 bg-white border border-border rounded-lg text-xs"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="font-semibold text-body">
                                Date of Birth *
                              </label>
                              <input
                                type="date"
                                max={getLagosToday()}
                                value={newBabyDob}
                                onChange={(e) => setNewBabyDob(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white border border-border rounded-lg text-xs"
                                required
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="font-semibold text-body">Sex *</label>
                              <select
                                value={newBabySex}
                                onChange={(e) => setNewBabySex(e.target.value)}
                                className="w-full px-2 py-1.5 bg-white border border-border rounded-lg text-xs"
                              >
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowAddBabyForm(false)}
                              className="h-8 px-3 text-xs"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              variant="primary"
                              disabled={isSavingBaby}
                              className="h-8 px-4 text-xs font-bold"
                            >
                              {isSavingBaby ? 'Saving...' : 'Save'}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2 Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="text-xs h-9 px-4 gap-1"
                >
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canProceedStep2()}
                  onClick={() => setStep(3)}
                  className="text-xs h-9 px-6 font-bold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 3: DATE & TIME (SLOTPICKER WITH WALKIN ALLOWED)           */}
          {/* ============================================================= */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-clinic-50 border border-border rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-body">{selectedClinic?.name}</span>
                  <span className="text-body-muted ml-2">
                    · Attendee: {bookingType}
                  </span>
                </div>
                <span className="text-[10px] font-bold bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full">
                  Walk-ins Available
                </span>
              </div>

              {/* SlotPicker */}
              <div className="border border-border rounded-xl p-3 bg-white">
                <SlotPicker
                  ref={slotPickerRef}
                  clinicId={selectedClinic?.id}
                  allowWalkin={true}
                  initialDate={getLagosToday()}
                  selectedSlotId={selectedSlot?.id}
                  onSelectSlot={(slot) => setSelectedSlot(slot)}
                />
              </div>

              {/* Step 3 Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="text-xs h-9 px-4 gap-1"
                >
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!selectedSlot}
                  onClick={() => setStep(4)}
                  className="text-xs h-9 px-6 font-bold"
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 4: REVIEW & CONFIRM                                      */}
          {/* ============================================================= */}
          {step === 4 && (
            <div className="space-y-4">
              {bookingError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-status-emergency flex items-center gap-2">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              <Card className="p-4 space-y-3 bg-clinic-50/40 border-primary-200 shadow-2xs">
                <h3 className="font-bold text-xs text-primary-800 uppercase tracking-wider">
                  Appointment Review
                </h3>

                <div className="divide-y divide-border text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-body-muted">Patient:</span>
                    <span className="font-bold text-body">
                      {selectedMother?.name} ({selectedMother?.phone})
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-body-muted">Clinic:</span>
                    <span className="font-bold text-body">
                      {selectedClinic?.name}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-body-muted">Attendee:</span>
                    <span className="font-bold text-body capitalize">
                      {bookingType === 'both' ? 'Mother & Baby' : bookingType}
                    </span>
                  </div>
                  {selectedBabies.length > 0 && (
                    <div className="py-2 flex justify-between">
                      <span className="text-body-muted">Babies:</span>
                      <span className="font-bold text-body">
                        {motherBabies
                          .filter((b) => selectedBabies.includes(b.id))
                          .map((b) => b.name)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="py-2 flex justify-between">
                    <span className="text-body-muted">Date:</span>
                    <span className="font-bold text-body">
                      {formatDate(selectedSlot?.slot_date || selectedSlot?.date)}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-body-muted">Time:</span>
                    <span className="font-bold text-body">
                      {formatTimeRange(
                        selectedSlot?.start_time,
                        selectedSlot?.end_time
                      )}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-body-muted">Slot Type:</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedSlot?.is_walkin
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-green-100 text-green-800 border border-green-300'
                        }`}
                    >
                      {selectedSlot?.is_walkin ? 'Walk-in Slot' : 'Standard Slot'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Step 4 Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  className="text-xs h-9 px-4 gap-1"
                >
                  <ArrowLeft size={14} /> Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isSubmitting}
                  onClick={handleConfirmBooking}
                  className="text-xs h-9 px-6 font-bold"
                >
                  {isSubmitting ? 'Confirming...' : 'Confirm booking'}
                </Button>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 5: SUCCESS & IMMEDIATE CHECK-IN                          */}
          {/* ============================================================= */}
          {step === 5 && (() => {
            const bookingDate =
              selectedSlot?.slot_date ||
              selectedSlot?.date ||
              createdAppointment?.slot_date ||
              createdAppointment?.date;
            const todayStr = getLagosToday();
            const isBookingToday = Boolean(bookingDate && bookingDate === todayStr);

            return (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={32} />
                </div>

                <div>
                  <h3 className="text-base font-bold text-body">
                    Booking Confirmed!
                  </h3>
                  <p className="text-xs text-body-muted mt-1">
                    Appointment created for{' '}
                    <strong className="text-body">{selectedMother?.name}</strong> at{' '}
                    <strong className="text-body">{selectedClinic?.name}</strong>.
                  </p>
                </div>

                {/* Ticket Banner if checked in */}
                {checkInTicket && (
                  <div className="p-4 bg-primary-50 border-2 border-primary-500 rounded-2xl max-w-sm mx-auto shadow-sm">
                    <span className="text-[11px] font-bold text-primary-700 uppercase tracking-wider block mb-1">
                      Queue Ticket Issued
                    </span>
                    <span className="text-2xl font-black font-mono text-primary-800">
                      {checkInTicket}
                    </span>
                    <p className="text-[11px] text-body-muted mt-1">
                      Patient has been added to today&apos;s active clinic waiting queue.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                  {!checkInTicket && (
                    isBookingToday ? (
                      <Button
                        type="button"
                        variant="primary"
                        disabled={isCheckingIn}
                        onClick={handleCheckInNow}
                        className="w-full sm:w-auto text-xs h-10 px-6 font-bold gap-1.5 shadow-sm"
                      >
                        <CheckCircle2 size={16} />
                        {isCheckingIn ? 'Checking in...' : 'Check in now'}
                      </Button>
                    ) : (
                      <div className="p-3 bg-clinic-50 border border-border rounded-xl text-xs text-body font-medium">
                        Booked for {formatDate(bookingDate)}. Check in on the day.
                      </div>
                    )
                  )}
                  <Button
                    type="button"
                    variant={checkInTicket || !isBookingToday ? 'primary' : 'outline'}
                    onClick={handleFinishAndClose}
                    className="w-full sm:w-auto text-xs h-10 px-6 font-bold"
                  >
                    Back to list
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
