'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  User,
  PlusCircle,
  Plus,
  LogOut,
  ChevronRight,
  Heart,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { appointmentAPI } from '../../lib/api';
import { formatDate, formatTimeRange, formatWhoFor } from '../../lib/dateTime';
import EmergencyNotice from '../../components/EmergencyNotice';
import Card from '../../components/Card';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import MotherBottomNav from '../../components/MotherBottomNav';

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [nextAppointment, setNextAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Access control: only mothers may see this page
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

    loadDashboardData();
  }, [router]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const apptRes = await appointmentAPI.list({ view: 'upcoming' });
      const appointments = apptRes?.data?.data || [];
      // Pick earliest upcoming appointment
      if (appointments.length > 0) {
        const sorted = [...appointments].sort((a, b) => {
          const dtA = `${a.slot_date} ${a.start_time}`;
          const dtB = `${b.slot_date} ${b.start_time}`;
          return dtA.localeCompare(dtB);
        });
        setNextAppointment(sorted[0]);
      } else {
        setNextAppointment(null);
      }
    } catch (err) {
      toast.error('Failed to load upcoming appointments.');
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.name ? user.name.split(' ')[0] : 'Mother';

  return (
    <div className="min-h-screen bg-clinic-50 pb-24">
      {/* Emergency Notice Banner */}
      <EmergencyNotice />

      {/* Top Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-clinic-dark uppercase tracking-wider">
              Maternity Clinic
            </span>
            <h1 className="text-base font-bold text-body">
              Hello, {displayName} 👋
            </h1>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            className="text-body-muted hover:text-status-emergency p-2 rounded-xl hover:bg-clinic-50 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-6">
        {/* Next Appointment Card */}
        <section aria-labelledby="next-appointment-heading">
          <div className="flex items-center justify-between mb-2">
            <h2
              id="next-appointment-heading"
              className="text-xs font-bold uppercase tracking-wider text-body-muted"
            >
              Next Appointment
            </h2>
            {nextAppointment && (
              <Link
                href="/appointments"
                className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-0.5"
              >
                All Visits <ChevronRight size={14} />
              </Link>
            )}
          </div>

          {loading ? (
            <Card className="p-5 space-y-3">
              <div className="flex justify-between">
                <Skeleton height={20} className="w-1/2" />
                <Skeleton height={20} className="w-20 rounded-full" />
              </div>
              <Skeleton height={16} className="w-3/4" />
              <Skeleton height={16} className="w-1/3" />
              <Skeleton height={44} className="w-full rounded-xl mt-2" />
            </Card>
          ) : nextAppointment ? (
            <div className="space-y-3">
              <Card className="p-5 border-primary-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-clinic-dark text-base">
                      {nextAppointment.clinic_name}
                    </h3>
                    <p className="text-xs text-body-muted mt-0.5">
                      For: {formatWhoFor(nextAppointment.booking_type, nextAppointment.babies)}
                    </p>
                  </div>
                  <StatusBadge
                    status={nextAppointment.status}
                    late_arrival={nextAppointment.late_arrival}
                  />
                </div>

                <div className="bg-clinic-50 rounded-xl p-3 text-xs space-y-1.5 border border-primary-100">
                  <div className="flex items-center gap-2 text-body">
                    <Calendar size={14} className="text-primary-600 flex-shrink-0" />
                    <span className="font-semibold">{formatDate(nextAppointment.slot_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-body">
                    <Clock size={14} className="text-primary-600 flex-shrink-0" />
                    <span>
                      {formatTimeRange(nextAppointment.start_time, nextAppointment.end_time)}
                    </span>
                  </div>
                </div>

                <Link href={`/appointments/${nextAppointment.id}`} className="block pt-1">
                  <Button variant="secondary" className="w-full text-xs">
                    View Appointment Details
                  </Button>
                </Link>
              </Card>

              {/* Centered Book appointment button below the card */}
              <div className="flex justify-center pt-1">
                <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                  <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                    <Plus size={16} /> Book Appointment
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <Card className="p-6">
              <EmptyState
                icon={Calendar}
                title="No Upcoming Appointment"
                description="You have no visits scheduled right now. Book your next visit with the clinic easily."
                action={
                  <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                    <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                      <Plus size={16} /> Book Appointment
                    </Button>
                  </Link>
                }
              />
            </Card>
          )}
        </section>

        {/* Quick Actions */}
        <section aria-labelledby="quick-actions-heading">
          <h2
            id="quick-actions-heading"
            className="text-xs font-bold uppercase tracking-wider text-body-muted mb-3"
          >
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/book" className="block">
              <Card className="p-4 flex flex-col items-center justify-center text-center gap-2 hover:border-primary-400 hover:shadow-md transition-all h-28">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
                  <PlusCircle size={22} />
                </div>
                <span className="font-semibold text-xs text-body leading-tight">
                  Book Appointment
                </span>
              </Card>
            </Link>

            <Link href="/appointments" className="block">
              <Card className="p-4 flex flex-col items-center justify-center text-center gap-2 hover:border-primary-400 hover:shadow-md transition-all h-28">
                <div className="w-10 h-10 rounded-xl bg-clinic-100 text-clinic-700 flex items-center justify-center">
                  <Calendar size={22} />
                </div>
                <span className="font-semibold text-xs text-body leading-tight">
                  My Appointments
                </span>
              </Card>
            </Link>

            <Link href="/queue" className="block">
              <Card className="p-4 flex flex-col items-center justify-center text-center gap-2 hover:border-primary-400 hover:shadow-md transition-all h-28">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Clock size={22} />
                </div>
                <span className="font-semibold text-xs text-body leading-tight">
                  Live Queue
                </span>
              </Card>
            </Link>

            <Link href="/profile" className="block">
              <Card className="p-4 flex flex-col items-center justify-center text-center gap-2 hover:border-primary-400 hover:shadow-md transition-all h-28">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <User size={22} />
                </div>
                <span className="font-semibold text-xs text-body leading-tight">
                  My Profile
                </span>
              </Card>
            </Link>

            <Link href="/clinic-info" className="block col-span-2">
              <Card className="p-3.5 flex items-center justify-between hover:border-primary-400 hover:shadow-sm transition-all bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-xs text-body block">
                      Hospital & Clinic Information
                    </span>
                    <span className="text-[11px] text-body-muted block">
                      Operating hours, location & emergency triage
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-body-muted" />
              </Card>
            </Link>
          </div>
        </section>

        {/* Informational Tip */}
        <div className="bg-white rounded-xl border border-border p-4 text-xs text-body-muted flex items-center gap-3">
          <Heart size={20} className="text-primary-500 flex-shrink-0" />
          <p>
            Please arrive at least 15 minutes before your consultation time to check in at the front desk.
          </p>
        </div>
      </main>

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
