'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  Phone,
  Mail,
  Clock,
  Calendar,
  AlertTriangle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicInfoAPI } from '../../lib/api';
import { getErrorMessage } from '../../lib/errorMessages';
import EmergencyNotice from '../../components/clinic/EmergencyNotice';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import MotherBottomNav from '../../components/clinic/MotherBottomNav';

export default function ClinicInfoPage() {
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

    loadClinicInfo();
  }, [router]);

  const loadClinicInfo = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await clinicInfoAPI.get();
      setInfo(res?.data?.data || null);
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to load clinic information.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
            <h1 className="text-base font-bold text-body">
              Hospital & Clinic Information
            </h1>
          </div>
          <button
            type="button"
            onClick={loadClinicInfo}
            disabled={loading}
            aria-label="Refresh information"
            className="text-body-muted hover:text-primary-600 p-1 rounded-lg transition-colors"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-5 space-y-5">
        {loading ? (
          <div className="space-y-4">
            <Skeleton height={140} className="w-full rounded-xl" />
            <Skeleton height={120} className="w-full rounded-xl" />
            <Skeleton height={180} className="w-full rounded-xl" />
          </div>
        ) : error || !info ? (
          <Card className="p-6 text-center space-y-3">
            <AlertTriangle size={36} className="text-amber-500 mx-auto" />
            <h2 className="text-base font-bold text-body">Unable to Load Clinic Info</h2>
            <p className="text-xs text-body-muted">{error || 'Please check your connection.'}</p>
            <div className="pt-2">
              <Button variant="primary" onClick={loadClinicInfo} className="w-full text-xs">
                Retry
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Hospital Overview & Location Card */}
            <Card className="p-5 space-y-4 border-primary-200 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <Building2 size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                    Medical Facility
                  </span>
                  <h2 className="text-base font-bold text-clinic-dark leading-tight mt-0.5">
                    {info.hospitalName}
                  </h2>
                </div>
              </div>

              <div className="bg-clinic-50 rounded-xl p-3.5 space-y-2.5 border border-primary-100 text-xs text-body">
                <div className="flex items-start gap-2.5">
                  <MapPin size={16} className="text-primary-600 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{info.address}</span>
                </div>

                {info.clinicPhone && (
                  <div className="flex items-center gap-2.5 pt-1 border-t border-primary-100/70">
                    <Phone size={15} className="text-primary-600 flex-shrink-0" />
                    <a
                      href={`tel:${info.clinicPhone.replace(/[^\d+]/g, '')}`}
                      className="font-semibold text-primary-700 hover:underline"
                    >
                      {info.clinicPhone}
                    </a>
                  </div>
                )}

                {info.clinicEmail && (
                  <div className="flex items-center gap-2.5">
                    <Mail size={15} className="text-primary-600 flex-shrink-0" />
                    <a
                      href={`mailto:${info.clinicEmail}`}
                      className="font-semibold text-primary-700 hover:underline"
                    >
                      {info.clinicEmail}
                    </a>
                  </div>
                )}
              </div>

              {info.googleMapsUrl && (
                <a
                  href={info.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full text-xs gap-1.5 h-10">
                    <ExternalLink size={14} /> Open in Google Maps
                  </Button>
                </a>
              )}
            </Card>

            {/* Emergency Notice Card */}
            <Card className="p-5 space-y-2.5 border-red-200 shadow-sm bg-red-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-status-emergency flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <h2 className="text-base font-bold text-red-950">
                  Emergency Notice
                </h2>
              </div>
              <p className="text-xs text-red-900 font-semibold leading-relaxed">
                For emergencies, please go directly to the Emergency Unit. This system is for scheduled clinic appointments only.
              </p>
            </Card>

            {/* Clinic Operating Days & Hours */}
            {info.clinicDaysAndHours && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-body-muted">
                  Clinic Operating Schedule
                </h3>

                {/* Antenatal Clinic */}
                {info.clinicDaysAndHours.antenatal && (
                  <Card className="p-4 space-y-3">
                    <div className="flex items-start justify-between border-b border-border pb-2.5">
                      <div>
                        <h4 className="font-bold text-sm text-clinic-dark">
                          Antenatal Clinic
                        </h4>
                        <span className="text-[11px] text-body-muted">
                          For pregnant mothers
                        </span>
                      </div>
                      {info.clinicDaysAndHours.antenatal.slotDurationMinutes && (
                        <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-0.5 rounded-full">
                          {info.clinicDaysAndHours.antenatal.slotDurationMinutes} min slots
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-body">
                        <Clock size={14} className="text-primary-600 flex-shrink-0" />
                        <span className="font-semibold">
                          Hours: {info.clinicDaysAndHours.antenatal.hours} (Lagos Time)
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-body">
                          <Calendar size={14} className="text-primary-600 flex-shrink-0" />
                          <span className="font-semibold">Clinic Days:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {info.clinicDaysAndHours.antenatal.days?.map((day) => (
                            <span
                              key={day}
                              className="text-[11px] bg-clinic-50 border border-primary-200 text-clinic-dark font-medium px-2 py-0.5 rounded-md"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>

                      {info.clinicDaysAndHours.antenatal.description && (
                        <p className="text-[11px] text-body-muted pt-1">
                          {info.clinicDaysAndHours.antenatal.description}
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                {/* Postnatal Clinic */}
                {info.clinicDaysAndHours.postnatal && (
                  <Card className="p-4 space-y-3">
                    <div className="flex items-start justify-between border-b border-border pb-2.5">
                      <div>
                        <h4 className="font-bold text-sm text-clinic-dark">
                          Postnatal Clinic
                        </h4>
                        <span className="text-[11px] text-body-muted">
                          For mothers and newborns
                        </span>
                      </div>
                      {info.clinicDaysAndHours.postnatal.slotDurationMinutes && (
                        <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-0.5 rounded-full">
                          {info.clinicDaysAndHours.postnatal.slotDurationMinutes} min slots
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-body">
                        <Clock size={14} className="text-primary-600 flex-shrink-0" />
                        <span className="font-semibold">
                          Hours: {info.clinicDaysAndHours.postnatal.hours} (Lagos Time)
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-body">
                          <Calendar size={14} className="text-primary-600 flex-shrink-0" />
                          <span className="font-semibold">Clinic Days:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-5">
                          {info.clinicDaysAndHours.postnatal.days?.map((day) => (
                            <span
                              key={day}
                              className="text-[11px] bg-clinic-50 border border-primary-200 text-clinic-dark font-medium px-2 py-0.5 rounded-md"
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </div>

                      {info.clinicDaysAndHours.postnatal.description && (
                        <p className="text-[11px] text-body-muted pt-1">
                          {info.clinicDaysAndHours.postnatal.description}
                        </p>
                      )}
                    </div>
                  </Card>
                )}

                {info.sessionNote && (
                  <div className="bg-clinic-50 border border-primary-200 rounded-xl p-3 text-xs text-clinic-dark leading-relaxed">
                    <strong className="block font-semibold mb-0.5">Other Clinic Days:</strong>
                    {info.sessionNote}
                  </div>
                )}
              </div>
            )}

            {/* Indicative Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
              <strong className="block font-semibold mb-0.5">Please Note:</strong>
              Clinic days and operating hours shown above are indicative schedules. Live appointment booking availability is strictly decided by available time slots in the booking calendar.
            </div>

            {/* Book Appointment CTA */}
            <div className="pt-2 flex justify-center">
              <Link href="/book" className="w-full sm:w-auto sm:max-w-xs block">
                <Button variant="primary" className="w-full sm:w-auto sm:max-w-xs sm:px-8 text-sm gap-1.5">
                  <Plus size={16} /> Book Appointment
                </Button>
              </Link>
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <MotherBottomNav />
    </div>
  );
}
