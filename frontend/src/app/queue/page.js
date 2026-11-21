'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  RefreshCw,
  Users,
  Calendar,
  User,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentAPI, queueAPI } from '../../lib/api';
import { getErrorMessage } from '../../lib/errorMessages';
import {
  formatDate,
  formatTimeRange,
  formatTime12,
  getLagosToday,
  formatWhoFor,
} from '../../lib/dateTime';
import EmergencyNotice from '../../components/EmergencyNotice';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import MotherBottomNav from '../../components/MotherBottomNav';

export default function QueueTrackerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [queuePosition, setQueuePosition] = useState(null);
  const [clinicQueue, setClinicQueue] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const selectedApptRef = useRef(selectedAppt);
  selectedApptRef.current = selectedAppt;

  // Access Control: mother only
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') {
      router.push('/login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
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

  // Load today's upcoming appointments
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const todayStr = getLagosToday();
      const res = await appointmentAPI.list({ view: 'upcoming' });
      const allAppts = res?.data?.data || [];

      // Filter for appointments whose slot_date is today in Africa/Lagos and not cancelled
      const todayList = allAppts.filter(
        (a) => a.slot_date === todayStr && !['cancelled', 'no_show'].includes(a.status)
      );

      setTodayAppointments(todayList);

      if (todayList.length > 0) {
        const first = todayList[0];
        setSelectedAppt(first);
        await fetchQueueData(first);
      }
    } catch (err) {
      toast.error('Failed to load appointments for today.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch queue position and today's clinic queue
  const fetchQueueData = useCallback(async (appt, isManual = false) => {
    if (!appt) return;
    if (isManual) setRefreshing(true);

    try {
      const [posRes, queueRes] = await Promise.all([
        queueAPI.getPosition(appt.id),
        appt.clinic_id ? queueAPI.getToday(appt.clinic_id).catch(() => null) : Promise.resolve(null),
      ]);

      const posData = posRes?.data?.data || null;
      const clinicData = queueRes?.data?.data || null;

      setQueuePosition(posData);
      setClinicQueue(clinicData);
      setLastUpdated(new Date());

      // If status changed on the appointment, update in-memory object
      if (posData?.status && appt.status !== posData.status) {
        setSelectedAppt((prev) => (prev ? { ...prev, status: posData.status } : prev));
      }
    } catch (err) {
      if (isManual) {
        toast.error('Failed to refresh queue position.');
      }
    } finally {
      if (isManual) setRefreshing(false);
    }
  }, []);

  // Handle appointment selection if multiple today
  const handleSelectAppt = (appt) => {
    setSelectedAppt(appt);
    setQueuePosition(null);
    setClinicQueue(null);
    fetchQueueData(appt, true);
  };

  // Polling every 20 seconds
  // Stop polling when document is hidden or when status is completed
  useEffect(() => {
    if (!selectedAppt) return;

    const currentStatus = queuePosition?.status || selectedAppt?.status;
    if (currentStatus === 'completed') {
      return; // Stop polling on completed
    }

    const interval = setInterval(() => {
      // Check document visibility
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return; // Don't poll while tab is hidden
      }

      if (selectedApptRef.current) {
        fetchQueueData(selectedApptRef.current);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [selectedAppt, queuePosition?.status, fetchQueueData]);

  // Format last updated time in 12-hour Lagos time
  const formatLastUpdatedTime = (d) => {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
  };

  // Derive current status & ticket info
  const effectiveStatus = queuePosition?.status || selectedAppt?.status || 'booked';
  const effectiveLate = Boolean(queuePosition?.late_arrival ?? selectedAppt?.late_arrival);
  const ticketNumber = queuePosition?.queueNumber || selectedAppt?.queue_number;
  const position = queuePosition?.position;
  const currentlyServing = clinicQueue?.currentlyServing;

  // Estimated wait calculation
  const getEstimatedWaitText = () => {
    if (position === null || position === undefined) return null;
    if (position <= 1) return 'You are next in line (< 5 mins)';
    return `Approx. ${(position - 1) * 20} minutes`;
  };

  return (
    <div className="min-h-screen bg-clinic-50 pb-24">
      {/* Top Emergency Notice */}
      <EmergencyNotice />

      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              aria-label="Back to dashboard"
              className="text-body-muted hover:text-body p-1 -ml-1 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-base font-bold text-body">Live Clinic Queue</h1>
          </div>
          {selectedAppt && (
            <button
              type="button"
              onClick={() => fetchQueueData(selectedAppt, true)}
              disabled={refreshing}
              aria-label="Refresh queue position"
              className="text-primary-600 hover:text-primary-700 p-1.5 rounded-lg hover:bg-clinic-50 transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton height={40} className="w-1/2" />
            <Skeleton height={200} className="w-full rounded-xl" />
            <Skeleton height={100} className="w-full rounded-xl" />
          </div>
        ) : todayAppointments.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={Clock}
              title="No Appointments Today"
              description="You have no clinic appointments scheduled for today in the hospital calendar. Book your next visit easily."
              action={
                <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                  <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                    <Plus size={16} /> Book Appointment
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <>
            {/* Multiple Appointments Selector */}
            {todayAppointments.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-body-muted">
                  Select Today's Appointment
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {todayAppointments.map((appt) => {
                    const isSelected = selectedAppt?.id === appt.id;
                    return (
                      <button
                        key={appt.id}
                        type="button"
                        onClick={() => handleSelectAppt(appt)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${
                          isSelected
                            ? 'bg-primary-500 text-white border-primary-500 shadow-sm'
                            : 'bg-white text-body border-border hover:border-primary-300'
                        }`}
                      >
                        {appt.clinic_name} ({formatTime12(appt.start_time)})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Appointment Meta Card */}
            {selectedAppt && (
              <Card className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                      Scheduled Session
                    </span>
                    <h2 className="text-base font-bold text-body">
                      {selectedAppt.clinic_name}
                    </h2>
                    <p className="text-xs text-body-muted mt-0.5">
                      For: {formatWhoFor(selectedAppt.booking_type, selectedAppt.babies)}
                    </p>
                  </div>
                  <StatusBadge
                    status={effectiveStatus}
                    late_arrival={effectiveLate}
                    size="small"
                  />
                </div>

                <div className="bg-clinic-50 rounded-xl p-3 text-xs space-y-1.5 border border-primary-100">
                  <div className="flex items-center gap-2 text-body">
                    <Calendar size={14} className="text-primary-600 flex-shrink-0" />
                    <span>Today, {formatDate(selectedAppt.slot_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-body">
                    <Clock size={14} className="text-primary-600 flex-shrink-0" />
                    <span>
                      {formatTimeRange(selectedAppt.start_time, selectedAppt.end_time)} (Lagos Time)
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* LIVE QUEUE DISPLAY */}

            {/* STATE 1: Status 'booked' (Not checked in yet) */}
            {effectiveStatus === 'booked' && (
              <Card className="p-6 text-center space-y-4 border-amber-200 bg-amber-50/40">
                <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <AlertCircle size={30} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-body">
                    You have not checked in yet
                  </h3>
                  <p className="text-xs text-body leading-relaxed max-w-xs mx-auto">
                    Please check in at the front desk when you arrive at the hospital. The records officer will verify your arrival and issue your queue ticket.
                  </p>
                </div>

                <div className="bg-white border border-amber-200 rounded-xl p-3 text-xs text-body-muted text-left space-y-1">
                  <p className="font-semibold text-body">Check-in Instructions:</p>
                  <p>• Have your Hospital Folder number ready.</p>
                  <p>• Arrive at least 15 minutes before your slot time.</p>
                </div>
              </Card>
            )}

            {/* STATE 2: Status 'in_consultation' (It's her turn!) */}
            {effectiveStatus === 'in_consultation' && (
              <Card className="p-6 text-center space-y-4 border-2 border-primary-500 bg-emerald-50/60 shadow-md">
                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-sm">
                  <CheckCircle2 size={36} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
                    Active Call
                  </span>
                  <h2 className="text-2xl font-black text-clinic-dark">
                    It's your turn!
                  </h2>
                </div>

                {ticketNumber && (
                  <div className="py-2">
                    <p className="text-xs text-body-muted uppercase tracking-wider font-semibold">
                      Your Ticket Number
                    </p>
                    <p className="text-4xl font-black text-primary-600 tracking-tight mt-0.5">
                      {ticketNumber}
                    </p>
                  </div>
                )}

                <div className="bg-white border border-primary-200 rounded-xl p-3.5 text-xs text-clinic-dark font-medium leading-relaxed">
                  Please proceed directly into the consultation room with the attending doctor or midwife.
                </div>
              </Card>
            )}

            {/* STATE 3: Status 'checked_in' or 'waiting' (In Queue) */}
            {['checked_in', 'waiting'].includes(effectiveStatus) && (
              <Card className="p-6 text-center space-y-5 border-primary-200 shadow-sm">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-body-muted">
                    Your Ticket Number
                  </span>
                  <div className="text-5xl font-black text-primary-600 tracking-tight mt-1">
                    {ticketNumber || '...'}
                  </div>
                </div>

                {/* Queue Position & Estimated Wait Breakdown */}
                <div className="grid grid-cols-2 gap-3 bg-clinic-50 rounded-xl p-4 border border-primary-100 text-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-body-muted block">
                      Queue Position
                    </span>
                    <span className="text-xl font-extrabold text-clinic-dark block mt-0.5">
                      {position !== null && position !== undefined ? `#${position}` : '—'}
                    </span>
                    <span className="text-[11px] text-body-muted block mt-0.5">
                      {position ? `Number ${position} in line` : 'Assigned'}
                    </span>
                  </div>

                  <div className="border-l border-primary-200 pl-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-body-muted block">
                      Estimated Wait
                    </span>
                    <span className="text-xl font-extrabold text-clinic-dark block mt-0.5">
                      {position !== null && position !== undefined ? `${(position - 1) * 20}m` : '—'}
                    </span>
                    <span className="text-[11px] text-body-muted block mt-0.5">
                      {getEstimatedWaitText() || 'Calculating...'}
                    </span>
                  </div>
                </div>

                {/* Position Message from API */}
                {queuePosition?.message && (
                  <p className="text-xs font-semibold text-clinic-dark">
                    {queuePosition.message}
                  </p>
                )}

                {/* Now Serving Ticket (Privacy Protected: Never shows names) */}
                <div className="bg-white border border-border rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-primary-600 flex-shrink-0" />
                    <span className="text-body font-semibold">Now Serving:</span>
                  </div>
                  <span className="font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-full border border-primary-200">
                    {currentlyServing ? `Ticket ${currentlyServing}` : 'Calling next patient...'}
                  </span>
                </div>
              </Card>
            )}

            {/* STATE 4: Status 'completed' */}
            {effectiveStatus === 'completed' && (
              <Card className="p-6 text-center space-y-3 border-emerald-200 bg-emerald-50/30">
                <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                <h3 className="text-base font-bold text-clinic-dark">
                  Consultation Completed
                </h3>
                <p className="text-xs text-body-muted">
                  Thank you for visiting today. Any follow-up appointments scheduled by your midwife will appear in your appointments list.
                </p>
                <div className="pt-2">
                  <Link href="/appointments" className="block">
                    <Button variant="outline" className="w-full text-xs">
                      View Appointments History
                    </Button>
                  </Link>
                </div>
              </Card>
            )}

            {/* Polling & Last Updated Info */}
            <div className="flex items-center justify-between text-[11px] text-body-muted px-1">
              <span>Auto-refreshing every 20 seconds</span>
              {lastUpdated && (
                <span>
                  Last updated: <strong>{formatLastUpdatedTime(lastUpdated)}</strong>
                </span>
              )}
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
