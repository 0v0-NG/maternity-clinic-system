'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, Plus, Baby, Eye, RefreshCw, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentAPI } from '../../lib/api';
import { formatDate, formatTimeRange, formatWhoFor } from '../../lib/dateTime';
import EmergencyNotice from '../../components/clinic/EmergencyNotice';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import MotherBottomNav from '../../components/clinic/MotherBottomNav';
import CancelAppointmentModal from '../../components/modals/CancelAppointmentModal';
import RescheduleAppointmentModal from '../../components/modals/RescheduleAppointmentModal';

export default function AppointmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past'
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);

  const checkAuthAndRole = useCallback(() => {
    const stored = localStorage.getItem('user');
    if (!stored || stored === 'undefined' || stored === 'null') {
      router.push('/login');
      return false;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') {
        router.push('/login');
        return false;
      }
      if (parsed.role === 'admin') {
        router.push('/admin');
        return false;
      }
      if (['front_desk', 'midwife', 'doctor'].includes(parsed.role)) {
        router.push('/staff');
        return false;
      }
      if (parsed.role !== 'mother') {
        router.push('/login');
        return false;
      }
      return true;
    } catch {
      router.push('/login');
      return false;
    }
  }, [router]);

  const loadAppointments = useCallback(async (tab) => {
    setLoading(true);
    try {
      const res = await appointmentAPI.list({ view: tab });
      setAppointments(res?.data?.data || []);
    } catch (err) {
      toast.error('Failed to load appointments.');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ok = checkAuthAndRole();
    if (ok) {
      loadAppointments(activeTab);
    }
  }, [activeTab, checkAuthAndRole, loadAppointments]);

  const handleOpenCancel = (appt) => {
    setSelectedAppointment(appt);
    setIsCancelOpen(true);
  };

  const handleOpenReschedule = (appt) => {
    setSelectedAppointment(appt);
    setIsRescheduleOpen(true);
  };

  return (
    <div className="min-h-screen bg-clinic-50 pb-24">
      {/* Emergency Notice */}
      <EmergencyNotice />

      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-body">My Appointments</h1>
          <Link href="/book">
            <Button variant="primary" className="h-9 px-3 text-xs gap-1 rounded-lg">
              <Plus size={16} /> Book
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="max-w-md mx-auto px-4 flex border-t border-border">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'upcoming'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-body-muted hover:text-body'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-3 text-center text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'past'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-body-muted hover:text-body'
            }`}
          >
            Past History
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-md mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton height={20} className="w-1/2" />
                  <Skeleton height={20} className="w-20 rounded-full" />
                </div>
                <Skeleton height={14} className="w-3/4" />
                <Skeleton height={14} className="w-1/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton height={40} className="flex-1 rounded-xl" />
                  <Skeleton height={40} className="flex-1 rounded-xl" />
                </div>
              </Card>
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <Card className="p-8">
            {activeTab === 'upcoming' ? (
              <EmptyState
                icon={Calendar}
                title="No Upcoming Appointments"
                description="You don't have any appointments scheduled right now."
                action={
                  <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                    <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                      <Plus size={16} /> Book Appointment
                    </Button>
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={Calendar}
                title="No Past Appointments"
                description="Your past clinic visits and history will appear here once concluded."
                action={
                  <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                    <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                      <Plus size={16} /> Book Appointment
                    </Button>
                  </Link>
                }
              />
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => {
              const canModify = activeTab === 'upcoming' && appt.status === 'booked';
              const isPast = activeTab === 'past';

              return (
                <Card key={appt.id} className="p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                  {/* Top: Clinic & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-bold text-clinic-dark text-sm sm:text-base">
                        {appt.clinic_name}
                      </h2>
                      <p className="text-xs text-body-muted mt-0.5">
                        For: {formatWhoFor(appt.booking_type, appt.babies)}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} late_arrival={appt.late_arrival} />
                  </div>

                  {/* Date & Time block */}
                  <div className="bg-clinic-50 rounded-xl p-3 text-xs space-y-1.5 border border-primary-100">
                    <div className="flex items-center gap-2 text-body">
                      <Calendar size={14} className="text-primary-600 flex-shrink-0" />
                      <span className="font-semibold">{formatDate(appt.slot_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-body">
                      <Clock size={14} className="text-primary-600 flex-shrink-0" />
                      <span>{formatTimeRange(appt.start_time, appt.end_time)}</span>
                    </div>

                    {/* Attending Doctor/Midwife if assigned */}
                    {appt.staff_name && (
                      <p className="text-[11px] text-body-muted pt-0.5">
                        Attending: <span className="font-medium text-body">{appt.staff_name}</span>
                      </p>
                    )}

                    {/* Linked Babies */}
                    {appt.babies && appt.babies.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-body-muted pt-0.5">
                        <Baby size={13} className="text-primary-600 flex-shrink-0" />
                        <span>
                          Baby: {appt.babies.map((b) => (typeof b === 'object' ? b.name : b)).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link href={`/appointments/${appt.id}`} className="flex-1">
                      <Button variant="outline" className="w-full text-xs gap-1">
                        <Eye size={15} /> View
                      </Button>
                    </Link>

                    {canModify && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenReschedule(appt)}
                          className="flex-1 text-xs gap-1"
                        >
                          <RefreshCw size={14} /> Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenCancel(appt)}
                          className="text-xs text-status-emergency hover:bg-red-50 px-3 gap-1"
                        >
                          <XCircle size={15} /> Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}

            {/* Centered Book appointment button at bottom of list on Upcoming tab */}
            {activeTab === 'upcoming' && (
              <div className="flex justify-center pt-2 pb-1">
                <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                  <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                    <Plus size={16} /> Book Appointment
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <CancelAppointmentModal
        appointment={selectedAppointment}
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onSuccess={() => loadAppointments(activeTab)}
      />

      <RescheduleAppointmentModal
        appointment={selectedAppointment}
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        onSuccess={() => loadAppointments(activeTab)}
      />

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
