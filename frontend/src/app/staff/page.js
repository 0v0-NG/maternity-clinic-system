'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, Stethoscope, LogOut, CheckCircle, RefreshCw, Calendar, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { clinicAPI, appointmentAPI, queueAPI } from '../../lib/api';

export default function StaffPortalPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('front_desk'); // 'front_desk' or 'consultation'
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [queue, setQueue] = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    const parsed = JSON.parse(stored);
    setUser(parsed);
    if (parsed.role === 'midwife' || parsed.role === 'doctor') {
      setActiveTab('consultation');
    }
    loadClinics();
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      loadClinicData(selectedClinicId);
    }
  }, [selectedClinicId]);

  const loadClinics = async () => {
    try {
      const { data } = await clinicAPI.list();
      setClinics(data.data);
      if (data.data.length > 0) {
        setSelectedClinicId(data.data[0].id);
      }
    } catch (err) {
      toast.error('Failed to load clinics.');
    } finally {
      setLoading(false);
    }
  };

  const loadClinicData = async (clinicId) => {
    try {
      const [queueRes, apptRes] = await Promise.all([
        queueAPI.getToday(clinicId),
        appointmentAPI.list({ status: 'booked' }),
      ]);
      setQueue(queueRes.data.data.queue || []);
      setAllAppointments(apptRes.data.data || []);
    } catch (err) {
      //
    }
  };

  const handleCheckIn = async (appointmentId) => {
    try {
      const { data } = await appointmentAPI.checkIn(appointmentId);
      toast.success(`Patient Checked In! Queue Ticket: ${data.data.queueNumber}`);
      loadClinicData(selectedClinicId);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Check-in failed.');
    }
  };

  const handleStatusUpdate = async (appointmentId, newStatus) => {
    try {
      await appointmentAPI.updateStatus(appointmentId, { status: newStatus });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}.`);
      loadClinicData(selectedClinicId);
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏥</span>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">Staff Portal</h1>
              <p className="text-xs text-primary-700 font-semibold capitalize">
                {user?.name} · {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadClinicData(selectedClinicId)}
              className="p-2 text-gray-500 hover:text-primary-600 rounded-lg border bg-white"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleLogout}
              className="text-xs flex items-center gap-1 text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg border bg-white font-medium"
            >
              <LogOut size={14} /> Exit
            </button>
          </div>
        </div>

        {/* Tab & Clinic Switcher */}
        <div className="max-w-6xl mx-auto px-4 pt-2 flex flex-wrap justify-between items-center gap-2 border-t">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('front_desk')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${
                activeTab === 'front_desk'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <UserCheck size={16} /> Front Desk Check-In
            </button>
            <button
              onClick={() => setActiveTab('consultation')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${
                activeTab === 'consultation'
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Stethoscope size={16} /> Doctor / Midwife Queue ({queue.length})
            </button>
          </div>

          <div className="py-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Clinic:</span>
            <select
              className="text-xs font-semibold p-1.5 border rounded-lg bg-white"
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* TAB 1: FRONT DESK CHECK-IN */}
        {activeTab === 'front_desk' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-4">
              <input
                type="text"
                placeholder="Search mother by name or appointment..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field max-w-sm text-sm !py-2"
              />
              <button
                onClick={() => router.push('/book')}
                className="btn-primary text-xs !py-2 flex items-center gap-1"
              >
                <Plus size={14} /> Book Walk-In Patient
              </button>
            </div>

            <div className="card !p-0 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                <h2 className="font-bold text-gray-800 text-sm">
                  Booked Appointments Awaiting Arrival ({allAppointments.length})
                </h2>
              </div>

              {allAppointments.length === 0 ? (
                <p className="text-center py-12 text-sm text-gray-500">No pending booked appointments today.</p>
              ) : (
                <div className="divide-y overflow-x-auto">
                  {allAppointments
                    .filter((a) => !search || a.mother_name?.toLowerCase().includes(search.toLowerCase()))
                    .map((a) => (
                      <div key={a.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="font-bold text-gray-900">{a.mother_name || 'Patient'}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <span>🕒 {a.start_time} - {a.end_time}</span>
                            <span>•</span>
                            <span className="capitalize">For: {a.booking_type}</span>
                            <span>•</span>
                            <span>Clinic: {a.clinic_name}</span>
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCheckIn(a.id)}
                            className="bg-primary-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle size={14} /> Check In Patient
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CONSULTATION QUEUE */}
        {activeTab === 'consultation' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card text-center !p-4 bg-primary-50 border-primary-200">
                <span className="text-xs font-bold text-primary-800 uppercase">Total in Clinic Today</span>
                <p className="text-3xl font-extrabold text-primary-900 mt-1">{queue.length}</p>
              </div>

              <div className="card text-center !p-4 bg-yellow-50 border-yellow-200">
                <span className="text-xs font-bold text-yellow-800 uppercase">Waiting in Lounge</span>
                <p className="text-3xl font-extrabold text-yellow-900 mt-1">
                  {queue.filter((q) => q.status === 'checked_in' || q.status === 'waiting').length}
                </p>
              </div>

              <div className="card text-center !p-4 bg-green-50 border-green-200">
                <span className="text-xs font-bold text-green-800 uppercase">Currently In Room</span>
                <p className="text-3xl font-extrabold text-green-900 mt-1">
                  {queue.find((q) => q.status === 'in_consultation')?.queue_number || 'None'}
                </p>
              </div>
            </div>

            <div className="card !p-0 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="font-bold text-gray-800 text-sm">Consultation Queue (Call Next)</h2>
              </div>

              {queue.length === 0 ? (
                <p className="text-center py-12 text-sm text-gray-500">
                  No patients checked in yet for this clinic.
                </p>
              ) : (
                <div className="divide-y">
                  {queue.map((patient, idx) => (
                    <div
                      key={patient.id}
                      className={`p-4 flex flex-wrap justify-between items-center gap-3 ${
                        patient.status === 'in_consultation' ? 'bg-green-50/60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-black bg-primary-100 text-primary-800 px-3 py-1.5 rounded-lg">
                          {patient.queue_number}
                        </span>
                        <div>
                          <p className="font-bold text-gray-900">{patient.mother_name}</p>
                          <p className="text-xs text-gray-500">
                            Queue #{idx + 1} · Arrived: {patient.checked_in_at ? new Date(patient.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'} · <span className="capitalize">{patient.booking_type} visit</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {patient.status === 'in_consultation' ? (
                          <>
                            <span className="text-xs bg-green-200 text-green-800 font-bold px-3 py-1.5 rounded-full">
                              In Consultation
                            </span>
                            <button
                              onClick={() => handleStatusUpdate(patient.id, 'completed')}
                              className="btn-primary text-xs !py-2 !px-3"
                            >
                              ✓ Finish Consultation
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(patient.id, 'in_consultation')}
                              className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700"
                            >
                              📞 Call Patient In
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(patient.id, 'no_show')}
                              className="text-xs text-gray-500 hover:text-red-600 px-2 py-2"
                            >
                              No-Show
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
