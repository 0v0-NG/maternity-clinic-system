'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Baby,
  Ticket,
  AlertCircle,
  RefreshCw,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentAPI } from '../../../lib/api';
import {
  formatDate,
  formatTimeRange,
  formatDateTime,
  formatWhoFor,
} from '../../../lib/dateTime';
import EmergencyNotice from '../../../components/clinic/EmergencyNotice';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import StatusBadge from '../../../components/ui/StatusBadge';
import Skeleton from '../../../components/ui/Skeleton';
import MotherBottomNav from '../../../components/clinic/MotherBottomNav';
import CancelAppointmentModal from '../../../components/modals/CancelAppointmentModal';
import RescheduleAppointmentModal from '../../../components/modals/RescheduleAppointmentModal';

export default function AppointmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params?.id;

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);

  const checkAuth = useCallback(() => {
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

  const loadAppointment = useCallback(async () => {
    if (!appointmentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await appointmentAPI.get(appointmentId);
      setAppointment(res?.data?.data || null);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError('You do not have permission to view this appointment.');
      } else if (err?.response?.status === 404) {
        setError('Appointment not found.');
      } else {
        setError('Failed to load appointment details.');
      }
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    const ok = checkAuth();
    if (ok) {
      loadAppointment();
    }
  }, [checkAuth, loadAppointment]);

  const canModify = appointment?.status === 'booked';

  return (
    <div className="min-h-screen bg-clinic-50 pb-24">
      {/* Emergency Notice */}
      <EmergencyNotice />

      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/appointments"
            className="text-body-muted hover:text-body p-1 -ml-1 rounded-lg"
            aria-label="Back to appointments"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base font-bold text-body">Appointment Details</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <Card className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <Skeleton height={24} className="w-1/2" />
              <Skeleton height={24} className="w-24 rounded-full" />
            </div>
            <Skeleton height={16} className="w-3/4" />
            <Skeleton height={16} className="w-2/3" />
            <Skeleton height={60} className="w-full rounded-xl" />
            <Skeleton height={48} className="w-full rounded-xl" />
          </Card>
        ) : error ? (
          <Card className="p-8 text-center space-y-3">
            <AlertCircle size={40} className="mx-auto text-status-emergency" />
            <h2 className="text-base font-bold text-body">{error}</h2>
            <Link href="/appointments" className="inline-block pt-2">
              <Button variant="primary" className="px-6 text-xs">
                Back to Appointments
              </Button>
            </Link>
          </Card>
        ) : appointment ? (
          <div className="space-y-4">
            {/* Main Card */}
            <Card className="p-5 space-y-4 shadow-sm">
              {/* Header with clinic & status */}
              <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                    Clinic Session
                  </span>
                  <h2 className="font-bold text-clinic-dark text-lg">
                    {appointment.clinic_name}
                  </h2>
                </div>
                <StatusBadge
                  status={appointment.status}
                  late_arrival={appointment.late_arrival}
                  size="large"
                />
              </div>

              {/* Schedule Box */}
              <div className="bg-clinic-50 rounded-xl p-3.5 space-y-2 border border-primary-100">
                <div className="flex items-center gap-2 text-xs text-body">
                  <Calendar size={15} className="text-primary-600 flex-shrink-0" />
                  <span className="font-bold">{formatDate(appointment.slot_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-body">
                  <Clock size={15} className="text-primary-600 flex-shrink-0" />
                  <span>
                    {formatTimeRange(appointment.start_time, appointment.end_time)} (12-Hour Lagos Time)
                  </span>
                </div>
              </div>

              {/* Queue Number / Arrival Status */}
              <div className="rounded-xl border border-border p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-body-muted flex items-center gap-1.5">
                    <Ticket size={14} className="text-primary-600" /> Queue Ticket
                  </span>
                  {appointment.queue_number ? (
                    <span className="text-sm font-extrabold text-clinic-dark bg-primary-100 px-2.5 py-0.5 rounded-lg">
                      {appointment.queue_number}
                    </span>
                  ) : (
                    <span className="text-xs text-body-muted italic">Not checked in</span>
                  )}
                </div>
                <p className="text-[11px] text-body-muted">
                  {appointment.queue_number
                    ? 'Assigned upon check-in. Proceed to the waiting area.'
                    : 'Your queue ticket will be issued when you check in at the clinic desk.'}
                </p>
                {appointment.queue_number && (
                  <Link
                    href="/queue"
                    className="inline-block text-xs font-semibold text-primary-600 hover:text-primary-700 pt-1"
                  >
                    View Live Queue Status →
                  </Link>
                )}
              </div>

              {/* Details Breakdown */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-body-muted">Attending Staff</span>
                  <span className="font-semibold text-body">
                    {appointment.staff_name || 'Assigned on arrival'}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-body-muted">Visit Type</span>
                  <span className="font-semibold text-body">
                    {formatWhoFor(appointment.booking_type, appointment.babies)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-body-muted">Booked On</span>
                  <span className="text-body">
                    {formatDateTime(appointment.booked_at || appointment.created_at)}
                  </span>
                </div>

                {appointment.checked_in_at && (
                  <div className="flex justify-between py-1 border-b border-border">
                    <span className="text-body-muted">Checked In At</span>
                    <span className="text-body font-medium">
                      {formatDateTime(appointment.checked_in_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Linked Babies if present */}
              {appointment.babies && appointment.babies.length > 0 && (
                <div className="bg-white rounded-xl border border-border p-3 space-y-2">
                  <h3 className="text-xs font-bold text-body flex items-center gap-1.5">
                    <Baby size={14} className="text-primary-600" /> Registered Baby Details
                  </h3>
                  <div className="space-y-1.5">
                    {appointment.babies.map((b) => {
                      const baby = typeof b === 'object' ? b : { name: b };
                      return (
                        <div
                          key={baby.id || baby.name}
                          className="flex items-center justify-between text-xs py-1 border-b last:border-0 border-dashed border-border"
                        >
                          <span className="font-semibold text-body">{baby.name}</span>
                          {baby.date_of_birth && (
                            <span className="text-body-muted text-[11px]">
                              DOB: {formatDate(baby.date_of_birth)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              {canModify && (
                <div className="pt-2 space-y-2">
                  <Button
                    variant="primary"
                    onClick={() => setIsRescheduleOpen(true)}
                    className="w-full text-xs gap-1.5"
                  >
                    <RefreshCw size={15} /> Reschedule Appointment
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setIsCancelOpen(true)}
                    className="w-full text-xs text-status-emergency hover:bg-red-50 gap-1.5"
                  >
                    <XCircle size={15} /> Cancel Appointment
                  </Button>
                </div>
              )}

              {appointment.status === 'completed' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  <span>This consultation was completed successfully.</span>
                </div>
              )}

              {appointment.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                  <span>This appointment was cancelled.</span>
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </main>

      {/* Modals */}
      <CancelAppointmentModal
        appointment={appointment}
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onSuccess={() => {
          loadAppointment();
          router.push('/appointments');
        }}
      />

      <RescheduleAppointmentModal
        appointment={appointment}
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        onSuccess={loadAppointment}
      />

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
