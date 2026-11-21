'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserCheck,
  Stethoscope,
  LogOut,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Clock,
  Search,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicAPI, appointmentAPI, queueAPI } from '../../lib/api';
import { getErrorMessage, getErrorCode } from '../../lib/errorMessages';
import {
  formatDate,
  formatTimeRange,
  formatTime12,
  getLagosToday,
  formatWhoFor,
} from '../../lib/dateTime';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import SlotPicker from '../../components/SlotPicker';

export default function StaffPortalPage() {
  const router = useRouter();

  // Auth & Role
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Tab & Filters
  // front_desk -> 'front_desk'; midwife/doctor -> 'clinic'; admin -> 'front_desk' | 'clinic'
  const [activeTab, setActiveTab] = useState('front_desk');
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [appointments, setAppointments] = useState([]);
  const [todayQueue, setTodayQueue] = useState({ queue: [], currentlyServing: null });
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [apptsError, setApptsError] = useState(null);
  const [queueError, setQueueError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null); // id of appt being processed

  // No-Show Confirmation Dialog
  const [noShowAppt, setNoShowAppt] = useState(null);
  const [isMarkingNoShow, setIsMarkingNoShow] = useState(false);

  // Clinic View Accordion State
  const [completedExpanded, setCompletedExpanded] = useState(false);

  // Follow-up Booking Dialog
  const [followUpAppt, setFollowUpAppt] = useState(null);
  const [selectedFollowUpSlot, setSelectedFollowUpSlot] = useState(null);
  const [isBookingFollowUp, setIsBookingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState(null);

  // Refs for polling
  const selectedClinicIdRef = useRef(selectedClinicId);
  selectedClinicIdRef.current = selectedClinicId;
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // 1. Access Control
  useEffect(() => {
    const today = getLagosToday();
    setSelectedDate(today);

    const stored = localStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') {
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!parsed || !['front_desk', 'midwife', 'doctor', 'admin'].includes(parsed.role)) {
        if (parsed?.role === 'mother') router.push('/dashboard');
        else router.push('/login');
        return;
      }
      setCurrentUser(parsed);
      if (parsed.role === 'midwife' || parsed.role === 'doctor') {
        setActiveTab('clinic');
      } else {
        setActiveTab('front_desk');
      }
      setAuthChecked(true);
    } catch {
      router.push('/login');
    }
  }, [router]);

  // 2. Load Clinics
  useEffect(() => {
    if (!authChecked) return;
    loadClinics();
  }, [authChecked]);

  const loadClinics = async () => {
    try {
      const res = await clinicAPI.list();
      const list = res?.data?.data || [];
      setClinics(list);
      if (list.length > 0 && !selectedClinicId) {
        setSelectedClinicId(list[0].id);
      }
    } catch (err) {
      toast.error('Failed to load clinic options.');
    }
  };

  // 3. Load Data when Clinic or Date changes
  const loadData = useCallback(async (isSilent = false) => {
    const cid = selectedClinicIdRef.current;
    const dt = selectedDateRef.current;
    if (!cid || !dt) return;

    if (!isSilent) {
      setLoadingAppts(true);
      setLoadingQueue(true);
    }
    setApptsError(null);
    setQueueError(null);

    // Fetch Appointments for this clinic and date
    const fetchAppts = appointmentAPI
      .list({ clinic_id: cid, date: dt })
      .then((res) => {
        setAppointments(res?.data?.data || []);
      })
      .catch((err) => {
        setApptsError(getErrorMessage(err, 'Failed to load appointments.'));
      })
      .finally(() => {
        if (!isSilent) setLoadingAppts(false);
      });

    // Fetch Live Queue for this clinic
    const fetchQueue = queueAPI
      .getToday(cid)
      .then((res) => {
        setTodayQueue({
          queue: res?.data?.data?.queue || [],
          currentlyServing: res?.data?.data?.currentlyServing || null,
        });
      })
      .catch((err) => {
        setQueueError(getErrorMessage(err, 'Failed to load live queue.'));
      })
      .finally(() => {
        if (!isSilent) setLoadingQueue(false);
      });

    await Promise.all([fetchAppts, fetchQueue]);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (selectedClinicId && selectedDate) {
      loadData(false);
    }
  }, [selectedClinicId, selectedDate, loadData]);

  // 4. Polling every 20 seconds (pauses when page is hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return; // Pause polling when hidden
      }
      if (selectedClinicIdRef.current && selectedDateRef.current) {
        loadData(true);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [loadData]);

  // 5. Actions: Check-in
  const handleCheckIn = async (appt) => {
    if (actionInProgress) return;
    setActionInProgress(appt.id);
    try {
      const res = await appointmentAPI.checkIn(appt.id);
      const data = res?.data?.data;
      const lateMsg = data?.late_arrival ? ' (Marked Late)' : '';
      toast.success(
        `Patient checked in! Queue Ticket: ${data?.queueNumber || 'Assigned'}${lateMsg}`
      );
      await loadData(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Check-in not allowed for this appointment.'));
    } finally {
      setActionInProgress(null);
    }
  };

  // 6. Actions: No-show
  const handleConfirmNoShow = async () => {
    if (!noShowAppt || isMarkingNoShow) return;
    setIsMarkingNoShow(true);
    try {
      await appointmentAPI.updateStatus(noShowAppt.id, { status: 'no_show' });
      toast.success('Appointment marked as No-show.');
      setNoShowAppt(null);
      await loadData(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not mark as no-show.'));
    } finally {
      setIsMarkingNoShow(false);
    }
  };

  // 7. Actions: Call in (Clinic view)
  const handleCallIn = async (appt) => {
    if (actionInProgress) return;
    setActionInProgress(appt.id);
    try {
      await appointmentAPI.updateStatus(appt.id, { status: 'in_consultation' });
      toast.success(`Called patient into consultation.`);
      await loadData(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update consultation status.'));
    } finally {
      setActionInProgress(null);
    }
  };

  // 8. Actions: Finish consultation (Clinic view)
  const handleFinish = async (appt) => {
    if (actionInProgress) return;
    setActionInProgress(appt.id);
    try {
      await appointmentAPI.updateStatus(appt.id, { status: 'completed' });
      toast.success('Consultation completed.');
      await loadData(true);

      // Open follow-up modal
      setFollowUpAppt(appt);
      setSelectedFollowUpSlot(null);
      setFollowUpError(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete appointment.'));
    } finally {
      setActionInProgress(null);
    }
  };

  // 9. Actions: Book follow-up
  const handleBookFollowUp = async () => {
    if (!followUpAppt || !selectedFollowUpSlot || isBookingFollowUp) return;

    setIsBookingFollowUp(true);
    setFollowUpError(null);

    const isAntenatal = followUpAppt.clinic_name?.toLowerCase().includes('antenatal');
    const bookingType = isAntenatal ? 'mother' : (followUpAppt.booking_type || 'mother');

    const payload = {
      mother_id: followUpAppt.mother_id,
      clinic_id: followUpAppt.clinic_id,
      slot_id: selectedFollowUpSlot.id,
      booking_type: bookingType,
    };

    if (bookingType === 'baby' || bookingType === 'both') {
      const babyIds = (followUpAppt.babies || []).map((b) => b.id);
      if (babyIds.length > 0) {
        payload.baby_ids = babyIds;
      }
    }

    try {
      await appointmentAPI.bookFollowUp(payload);
      toast.success('Follow-up appointment booked successfully.');
      setFollowUpAppt(null);
      setSelectedFollowUpSlot(null);
      await loadData(true);
    } catch (err) {
      setFollowUpError(getErrorMessage(err, 'Failed to book follow-up appointment.'));
    } finally {
      setIsBookingFollowUp(false);
    }
  };

  // Logout
  const handleLogout = () => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    toast.success('Logged out successfully.');
    router.push('/login');
  };

  // Format last updated time
  const formatUpdatedTime = (d) => {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
  };

  // Filtered Appointments for Front Desk
  const filteredAppointments = appointments.filter((appt) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'checked_in') {
        if (!['checked_in', 'waiting'].includes(appt.status)) return false;
      } else if (appt.status !== statusFilter) {
        return false;
      }
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const motherName = (appt.mother_name || '').toLowerCase();
      const motherPhone = (appt.mother_phone || '').toLowerCase();
      const motherId = (appt.mother_id || '').toLowerCase();
      const ticket = (appt.queue_number || '').toLowerCase();
      const babies = (appt.babies || []).map((b) => (b.name || '').toLowerCase()).join(' ');

      const matches =
        motherName.includes(q) ||
        motherPhone.includes(q) ||
        motherId.includes(q) ||
        ticket.includes(q) ||
        babies.includes(q);
      if (!matches) return false;
    }
    return true;
  });

  // Count Chips
  const countBooked = appointments.filter((a) => a.status === 'booked').length;
  const countCheckedIn = appointments.filter((a) =>
    ['checked_in', 'waiting'].includes(a.status)
  ).length;
  const countCompleted = appointments.filter((a) => a.status === 'completed').length;
  const countNoShow = appointments.filter((a) => a.status === 'no_show').length;
  const countCancelled = appointments.filter((a) => a.status === 'cancelled').length;

  // Clinic View Groupings
  const clinicInConsultation = appointments.filter((a) => a.status === 'in_consultation');
  const clinicWaiting = appointments
    .filter((a) => ['checked_in', 'waiting'].includes(a.status))
    .sort((a, b) => new Date(a.checked_in_at || 0) - new Date(b.checked_in_at || 0));
  const clinicBooked = appointments
    .filter((a) => a.status === 'booked')
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const clinicCompleted = appointments.filter((a) => a.status === 'completed');

  // Role labels
  const roleDisplayNames = {
    front_desk: 'Front Desk Officer',
    midwife: 'Nurse / Midwife',
    doctor: 'Doctor',
    admin: 'Administrator',
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-clinic-50 flex items-center justify-center p-4">
        <Skeleton height={60} className="w-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-50 pb-16">
      {/* Top Bar */}
      <header className="bg-white border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
              🏥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-body">Hospital Staff Portal</h1>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full">
                  {roleDisplayNames[currentUser?.role] || currentUser?.role}
                </span>
              </div>
              <p className="text-xs text-body-muted">
                Logged in as <strong className="font-semibold text-body">{currentUser?.name}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => loadData(false)}
              disabled={loadingAppts || loadingQueue}
              aria-label="Refresh data"
              className="text-xs font-semibold text-body hover:text-primary-700 p-2 rounded-xl border border-border bg-white hover:bg-clinic-50 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw
                size={15}
                className={loadingAppts || loadingQueue ? 'animate-spin' : ''}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="text-xs text-status-emergency border-red-200 hover:bg-red-50 h-9 px-3 gap-1.5"
            >
              <LogOut size={14} /> Log Out
            </Button>
          </div>
        </div>

        {/* Navigation Tabs (Admin gets both, others locked to role) */}
        {currentUser?.role === 'admin' && (
          <div className="max-w-7xl mx-auto px-4 pt-1 flex gap-2 border-t border-border">
            <button
              type="button"
              onClick={() => setActiveTab('front_desk')}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'front_desk'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-body-muted hover:text-body'
              }`}
            >
              <UserCheck size={16} /> Front Desk View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('clinic')}
              className={`px-4 py-2 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'clinic'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-body-muted hover:text-body'
              }`}
            >
              <Stethoscope size={16} /> Clinical Consultation View
            </button>
          </div>
        )}

        {/* Global Controls: Clinic & Date Selectors */}
        <div className="bg-clinic-50/60 border-t border-border px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Clinic Selector */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-body-muted">Clinic:</span>
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="bg-white border border-border rounded-lg px-2.5 py-1.5 font-bold text-body focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                >
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selector */}
              <div className="flex items-center gap-2">
                <span className="font-semibold text-body-muted">Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-white border border-border rounded-lg px-2.5 py-1 font-bold text-body focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs"
                />
              </div>
            </div>

            {/* Polling / Last Updated status */}
            <div className="text-[11px] text-body-muted flex items-center gap-2">
              <span>Auto-refreshing every 20s</span>
              {lastUpdated && (
                <span>
                  · Updated: <strong>{formatUpdatedTime(lastUpdated)}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ================================================================= */}
        {/* VIEW 1: FRONT DESK VIEW                                           */}
        {/* ================================================================= */}
        {activeTab === 'front_desk' && (
          <div className="space-y-6">
            {/* Walk-in notice banner */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900 leading-relaxed">
              <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Front Desk Check-in Desk:</strong>
                Verify arriving patients and issue live queue tickets below. (Note: Walk-in patient creation requires hospital records search API support, as documented in BACKEND_REQUESTS.md).
              </div>
            </div>

            {/* Layout Grid: Left = Appointments Table, Right = Live Queue Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column (2 Cols): Today's Appointments List */}
              <div className="lg:col-span-2 space-y-4">
                {/* Count Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === 'all'
                        ? 'bg-body text-white border-body shadow-sm'
                        : 'bg-white text-body border-border hover:bg-clinic-50'
                    }`}
                  >
                    All ({appointments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('booked')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === 'booked'
                        ? 'bg-status-booked text-white border-status-booked shadow-sm'
                        : 'bg-white text-body border-border hover:bg-clinic-50'
                    }`}
                  >
                    Booked ({countBooked})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('checked_in')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === 'checked_in'
                        ? 'bg-status-consultation text-white border-status-consultation shadow-sm'
                        : 'bg-white text-body border-border hover:bg-clinic-50'
                    }`}
                  >
                    Checked In ({countCheckedIn})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === 'completed'
                        ? 'bg-status-completed text-white border-status-completed shadow-sm'
                        : 'bg-white text-body border-border hover:bg-clinic-50'
                    }`}
                  >
                    Completed ({countCompleted})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('no_show')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === 'no_show'
                        ? 'bg-status-no-show text-white border-status-no-show shadow-sm'
                        : 'bg-white text-body border-border hover:bg-clinic-50'
                    }`}
                  >
                    No-Show ({countNoShow})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('cancelled')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      statusFilter === 'cancelled'
                        ? 'bg-status-cancelled text-white border-status-cancelled shadow-sm'
                        : 'bg-white text-body border-border hover:bg-clinic-50'
                    }`}
                  >
                    Cancelled ({countCancelled})
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-body-muted"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by patient name, phone, baby, or ticket number..."
                    className="w-full text-xs pl-10 pr-4 py-2.5 bg-white border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
                  />
                </div>

                {/* Appointments List / Table */}
                {loadingAppts ? (
                  <div className="space-y-3">
                    <Skeleton height={70} className="w-full rounded-xl" />
                    <Skeleton height={70} className="w-full rounded-xl" />
                    <Skeleton height={70} className="w-full rounded-xl" />
                  </div>
                ) : apptsError ? (
                  <Card className="p-6 text-center space-y-3">
                    <AlertTriangle size={36} className="text-amber-500 mx-auto" />
                    <h3 className="font-bold text-sm text-body">{apptsError}</h3>
                    <Button
                      variant="outline"
                      onClick={() => loadData(false)}
                      className="text-xs h-9 mx-auto"
                    >
                      Retry
                    </Button>
                  </Card>
                ) : filteredAppointments.length === 0 ? (
                  <Card className="p-8">
                    <EmptyState
                      icon={Clock}
                      title="No Appointments Found"
                      description={
                        searchQuery
                          ? 'No appointments match your search criteria on this date.'
                          : 'There are no appointments scheduled for this clinic on the selected date.'
                      }
                    />
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredAppointments.map((appt) => {
                      const isProcessing = actionInProgress === appt.id;
                      const isBooked = appt.status === 'booked';

                      // Patient name or fallback ID
                      const patientName =
                        appt.mother_name || `Patient (${appt.mother_id?.substring(0, 8)}...)`;

                      return (
                        <Card
                          key={appt.id}
                          className="p-4 space-y-3 hover:border-primary-300 transition-all shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-body">
                                  {patientName}
                                </span>
                                {appt.mother_phone && (
                                  <span className="text-xs text-body-muted font-medium">
                                    · {appt.mother_phone}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-body-muted mt-0.5">
                                For: <strong>{formatWhoFor(appt.booking_type, appt.babies)}</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              {appt.queue_number && (
                                <span className="font-mono text-xs font-bold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full border border-primary-200">
                                  Ticket {appt.queue_number}
                                </span>
                              )}
                              <StatusBadge
                                status={appt.status}
                                late_arrival={Boolean(appt.late_arrival)}
                                size="small"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border text-xs">
                            <div className="flex items-center gap-3 text-body-muted">
                              <span className="flex items-center gap-1 text-body font-semibold">
                                <Clock size={13} className="text-primary-600" />
                                {formatTimeRange(appt.start_time, appt.end_time)}
                              </span>
                              <span>·</span>
                              <span>Clinic: {appt.clinic_name}</span>
                            </div>

                            {/* Actions on 'booked' appointments */}
                            {isBooked && (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="primary"
                                  disabled={isProcessing}
                                  onClick={() => handleCheckIn(appt)}
                                  className="h-9 px-4 text-xs font-bold gap-1 shadow-sm"
                                >
                                  <CheckCircle2 size={14} />
                                  {isProcessing ? 'Processing...' : 'Check In'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={isProcessing}
                                  onClick={() => setNoShowAppt(appt)}
                                  className="h-9 px-3 text-xs text-status-no-show border-red-200 hover:bg-red-50"
                                >
                                  No-show
                                </Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column (1 Col): Live Queue Panel */}
              <div className="space-y-4">
                <Card className="p-4 space-y-4 border-primary-200 shadow-sm bg-white">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-primary-600" />
                      <h3 className="font-bold text-sm text-body">
                        Clinic Queue Tracker
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-200">
                      Live
                    </span>
                  </div>

                  {/* Now Serving Card */}
                  <div className="bg-clinic-50 rounded-xl p-3.5 border border-primary-200 text-center space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-body-muted">
                      Now Serving in Room
                    </span>
                    <div className="text-2xl font-black text-clinic-dark">
                      {todayQueue.currentlyServing ? (
                        <span className="text-primary-600">
                          Ticket {todayQueue.currentlyServing}
                        </span>
                      ) : (
                        <span className="text-body-muted text-base font-semibold">
                          None currently in consultation
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Waiting List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-body-muted">
                        Waiting in Lounge ({todayQueue.queue.length})
                      </span>
                    </div>

                    {loadingQueue ? (
                      <div className="space-y-2">
                        <Skeleton height={45} className="rounded-xl" />
                        <Skeleton height={45} className="rounded-xl" />
                      </div>
                    ) : queueError ? (
                      <p className="text-xs text-status-emergency p-2 bg-red-50 rounded-lg">
                        {queueError}
                      </p>
                    ) : todayQueue.queue.length === 0 ? (
                      <p className="text-xs text-body-muted py-6 text-center italic">
                        No checked-in patients waiting in queue.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                        {todayQueue.queue.map((item, idx) => (
                          <div
                            key={item.id || item.queue_number}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                              item.status === 'in_consultation'
                                ? 'bg-emerald-50 border-emerald-300 font-bold'
                                : 'bg-white border-border'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-xs font-black text-primary-700 bg-primary-100 px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-body">
                                  {item.mother_name || item.queue_number}
                                </p>
                                <p className="text-[10px] text-body-muted">
                                  Ticket: {item.queue_number}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.late_arrival && (
                                <span className="bg-status-late text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                                  Late
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  item.status === 'in_consultation'
                                    ? 'bg-status-consultation text-white'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.status === 'in_consultation' ? 'In Room' : 'Waiting'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 2: CLINICAL CONSULTATION VIEW (Midwife / Doctor)             */}
        {/* ================================================================= */}
        {activeTab === 'clinic' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-border shadow-sm">
              <div>
                <h2 className="text-base font-bold text-body">
                  Consultation Queue for {clinics.find((c) => c.id === selectedClinicId)?.name || 'Clinic'}
                </h2>
                <p className="text-xs text-body-muted">
                  Call in checked-in patients, conduct examination, and schedule follow-up appointments.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-200">
                  Total Patients Today: {appointments.length}
                </span>
              </div>
            </div>

            {loadingAppts ? (
              <div className="space-y-4">
                <Skeleton height={100} className="w-full rounded-xl" />
                <Skeleton height={140} className="w-full rounded-xl" />
                <Skeleton height={100} className="w-full rounded-xl" />
              </div>
            ) : apptsError ? (
              <Card className="p-6 text-center space-y-3">
                <AlertTriangle size={36} className="text-amber-500 mx-auto" />
                <h3 className="font-bold text-sm text-body">{apptsError}</h3>
                <Button
                  variant="outline"
                  onClick={() => loadData(false)}
                  className="text-xs h-9 mx-auto"
                >
                  Retry
                </Button>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* 1. IN CONSULTATION */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-consultation animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-body">
                      Currently In Consultation ({clinicInConsultation.length})
                    </h3>
                  </div>

                  {clinicInConsultation.length === 0 ? (
                    <Card className="p-5 text-center text-xs text-body-muted border-dashed">
                      No patient currently in the consultation room. Call in the next waiting patient below.
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {clinicInConsultation.map((appt) => {
                        const isProcessing = actionInProgress === appt.id;
                        const patientName =
                          appt.mother_name || `Patient (${appt.mother_id?.substring(0, 8)}...)`;
                        return (
                          <Card
                            key={appt.id}
                            className="p-5 border-2 border-primary-500 bg-emerald-50/40 shadow-sm space-y-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <span className="font-mono text-sm font-black bg-primary-500 text-white px-2.5 py-0.5 rounded-md">
                                  Ticket {appt.queue_number || 'In Room'}
                                </span>
                                <h4 className="text-base font-bold text-clinic-dark mt-1">
                                  {patientName}
                                </h4>
                                <p className="text-xs text-body-muted">
                                  For: <strong>{formatWhoFor(appt.booking_type, appt.babies)}</strong>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  status="in_consultation"
                                  late_arrival={Boolean(appt.late_arrival)}
                                  size="small"
                                />
                                <Button
                                  type="button"
                                  variant="primary"
                                  disabled={isProcessing}
                                  onClick={() => handleFinish(appt)}
                                  className="h-10 px-5 text-xs font-bold gap-1.5 shadow-sm"
                                >
                                  <CheckCircle2 size={16} />
                                  {isProcessing ? 'Finishing...' : 'Finish'}
                                </Button>
                              </div>
                            </div>

                            <div className="bg-white rounded-xl p-3 border border-primary-200 text-xs text-body-muted flex items-center justify-between">
                              <span>Slot Time: {formatTimeRange(appt.start_time, appt.end_time)}</span>
                              <span>Status only · No clinical notes recorded</span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. WAITING (CHECKED IN) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-waiting" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-body">
                      Waiting in Lounge ({clinicWaiting.length})
                    </h3>
                  </div>

                  {clinicWaiting.length === 0 ? (
                    <Card className="p-5 text-center text-xs text-body-muted border-dashed">
                      No patients currently waiting in line.
                    </Card>
                  ) : (
                    <div className="space-y-2.5">
                      {clinicWaiting.map((appt, idx) => {
                        const isProcessing = actionInProgress === appt.id;
                        const patientName =
                          appt.mother_name || `Patient (${appt.mother_id?.substring(0, 8)}...)`;
                        return (
                          <Card
                            key={appt.id}
                            className="p-4 flex flex-wrap items-center justify-between gap-3 hover:border-primary-300 transition-all shadow-sm"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-black bg-primary-100 text-primary-800 px-2.5 py-1 rounded-md">
                                #{idx + 1} · {appt.queue_number || 'Ticket'}
                              </span>
                              <div>
                                <h4 className="text-sm font-bold text-body">{patientName}</h4>
                                <p className="text-[11px] text-body-muted">
                                  For: {formatWhoFor(appt.booking_type, appt.babies)} · Scheduled: {formatTime12(appt.start_time)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge
                                status={appt.status}
                                late_arrival={Boolean(appt.late_arrival)}
                                size="small"
                              />
                              <Button
                                type="button"
                                variant="primary"
                                disabled={isProcessing}
                                onClick={() => handleCallIn(appt)}
                                className="h-9 px-4 text-xs font-bold gap-1 shadow-sm"
                              >
                                <ArrowRight size={14} />
                                {isProcessing ? 'Calling...' : 'Call In'}
                              </Button>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. NOT YET ARRIVED (BOOKED) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-status-booked" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-body">
                      Not Yet Arrived ({clinicBooked.length})
                    </h3>
                  </div>

                  {clinicBooked.length === 0 ? (
                    <Card className="p-4 text-center text-xs text-body-muted border-dashed">
                      All booked patients for today have arrived or no appointments scheduled.
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {clinicBooked.map((appt) => {
                        const patientName =
                          appt.mother_name || `Patient (${appt.mother_id?.substring(0, 8)}...)`;
                        return (
                          <Card
                            key={appt.id}
                            className="p-3.5 flex items-center justify-between text-xs bg-white/70"
                          >
                            <div>
                              <p className="font-bold text-body">{patientName}</p>
                              <p className="text-[11px] text-body-muted">
                                Time: {formatTime12(appt.start_time)} · For: {formatWhoFor(appt.booking_type, appt.babies)}
                              </p>
                            </div>
                            <StatusBadge status="booked" size="small" />
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 4. DONE TODAY (COMPLETED - COLLAPSED ACCORDION) */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setCompletedExpanded(!completedExpanded)}
                    className="w-full flex items-center justify-between p-3.5 bg-white border border-border rounded-xl text-xs font-bold text-body hover:bg-clinic-50 transition-colors shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-status-completed" />
                      <span>Done Today ({clinicCompleted.length} Completed Patients)</span>
                    </div>
                    {completedExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {completedExpanded && (
                    <Card className="p-4 space-y-2 bg-clinic-50/50">
                      {clinicCompleted.length === 0 ? (
                        <p className="text-xs text-body-muted text-center py-3">
                          No consultations completed yet today.
                        </p>
                      ) : (
                        <div className="divide-y divide-border">
                          {clinicCompleted.map((appt) => {
                            const patientName =
                              appt.mother_name || `Patient (${appt.mother_id?.substring(0, 8)}...)`;
                            return (
                              <div
                                key={appt.id}
                                className="py-2.5 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <span className="font-bold text-body">{patientName}</span>
                                  <span className="text-[11px] text-body-muted ml-2">
                                    Ticket: {appt.queue_number || '—'} · For: {formatWhoFor(appt.booking_type, appt.babies)}
                                  </span>
                                </div>
                                <StatusBadge status="completed" size="small" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* =================================================================== */}
      {/* DIALOG 1: No-Show Confirmation Dialog                               */}
      {/* =================================================================== */}
      {noShowAppt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-status-no-show flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-body">
                  Mark as No-Show?
                </h3>
                <p className="text-xs text-body-muted mt-0.5">
                  Patient:{' '}
                  {noShowAppt.mother_name || `Patient (${noShowAppt.mother_id?.substring(0, 8)}...)`}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
              <strong className="block font-semibold mb-0.5">Rule Notice:</strong>
              Appointments may only be marked as No-show after the appointment start time plus grace period (15 mins) has passed.
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                disabled={isMarkingNoShow}
                onClick={() => setNoShowAppt(null)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isMarkingNoShow}
                onClick={handleConfirmNoShow}
                className="flex-1 text-xs font-bold"
              >
                {isMarkingNoShow ? 'Marking...' : 'Confirm No-Show'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DIALOG 2: Book Follow-Up Dialog (Midwife / Doctor)                  */}
      {/* =================================================================== */}
      {followUpAppt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl my-8">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                  Follow-up Scheduling
                </span>
                <h3 className="text-base font-bold text-clinic-dark mt-0.5">
                  Book Follow-Up Appointment?
                </h3>
                <p className="text-xs text-body-muted">
                  Patient:{' '}
                  <strong>
                    {followUpAppt.mother_name || `Patient (${followUpAppt.mother_id?.substring(0, 8)}...)`}
                  </strong>{' '}
                  · Clinic: <strong>{followUpAppt.clinic_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFollowUpAppt(null)}
                className="text-body-muted hover:text-body text-xs font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {followUpError && (
              <div className="text-xs text-status-emergency bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{followUpError}</span>
              </div>
            )}

            {/* Reusable SlotPicker with walk-in visibility for staff */}
            <div className="border border-border rounded-xl p-3.5 bg-clinic-50/50">
              <SlotPicker
                clinicId={followUpAppt.clinic_id}
                allowWalkin={true}
                selectedSlotId={selectedFollowUpSlot?.id}
                onSelectSlot={(slot) => setSelectedFollowUpSlot(slot)}
              />
            </div>

            {selectedFollowUpSlot && (
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 text-xs text-clinic-dark flex items-center justify-between">
                <span>
                  Selected Slot: <strong>{formatTime12(selectedFollowUpSlot.start_time)}</strong> on{' '}
                  <strong>{formatDate(selectedFollowUpSlot.date)}</strong>
                  {selectedFollowUpSlot.is_walkin ? ' (Walk-in Slot)' : ''}
                </span>
                <CheckCircle2 size={16} className="text-primary-600 flex-shrink-0" />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isBookingFollowUp}
                onClick={() => setFollowUpAppt(null)}
                className="px-5 text-xs h-10"
              >
                Skip
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!selectedFollowUpSlot || isBookingFollowUp}
                onClick={handleBookFollowUp}
                className="px-6 text-xs font-bold h-10 shadow-sm"
              >
                {isBookingFollowUp ? 'Booking...' : 'Book Follow-Up'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
