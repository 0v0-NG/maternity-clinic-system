'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, Baby, Plus, LogOut, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentAPI, motherAPI } from '../../lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored || stored === 'undefined' || stored === 'null') {
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== 'object') {
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
      setUser(parsed);
      loadData();
    } catch {
      localStorage.removeItem('user');
      router.push('/login');
    }
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, apptRes] = await Promise.all([
        motherAPI.getProfile(),
        appointmentAPI.list({ upcoming: 'true' }),
      ]);
      setProfile(profileRes.data.data);
      setAppointments(apptRes.data.data);
    } catch (error) {
      toast.error('Failed to load data.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-primary-700">🏥 My Clinic</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link href="/book" className="card flex flex-col items-center gap-1.5 hover:shadow-md transition-shadow text-center !p-4">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <Plus className="text-primary-600" size={20} />
            </div>
            <span className="font-bold text-xs">Book Appointment</span>
          </Link>
          <Link href="/queue" className="card flex flex-col items-center gap-1.5 hover:shadow-md transition-shadow text-center !p-4">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="text-blue-600" size={20} />
            </div>
            <span className="font-bold text-xs">Live Queue</span>
          </Link>
          <Link href="/profile" className="card flex flex-col items-center gap-1.5 hover:shadow-md transition-shadow text-center !p-4">
            <div className="w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
              <User className="text-accent-600" size={20} />
            </div>
            <span className="font-bold text-xs">My Profile</span>
          </Link>
        </div>

        {/* Baby Profiles */}
        {profile?.babies?.length > 0 && (
          <div className="card">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Baby size={18} /> My Babies
            </h2>
            <div className="space-y-2">
              {profile.babies.map((baby) => (
                <div key={baby.id} className="flex justify-between items-center py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{baby.name}</p>
                    <p className="text-xs text-gray-500">DOB: {baby.date_of_birth} · {baby.sex}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Appointments */}
        <div className="card">
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar size={18} /> Upcoming Appointments
          </h2>

          {appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar size={48} className="mx-auto mb-2 opacity-50" />
              <p>No upcoming appointments</p>
              <Link href="/book" className="text-primary-600 font-semibold text-sm hover:underline mt-2 inline-block">
                Book one now →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div key={appt.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-primary-700">{appt.clinic_name}</p>
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Calendar size={14} /> {appt.slot_date}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Clock size={14} /> {appt.start_time} - {appt.end_time}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        For: {appt.booking_type} · Staff: {appt.staff_name || 'TBD'}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      appt.status === 'booked' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                      appt.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Emergency Notice */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-800 text-sm font-medium">
            ⚠️ For emergencies, go directly to the Emergency Unit
          </p>
        </div>
      </main>
    </div>
  );
}
