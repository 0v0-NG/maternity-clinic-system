'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Users, CalendarX, AlertTriangle, LogOut, RefreshCw, Plus, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI, clinicAPI } from '../../lib/api';

export default function AdminDashboardPage() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'staff', 'sessions'
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState('');
  const [clinicLoad, setClinicLoad] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [noShowReport, setNoShowReport] = useState([]);
  const [blockForm, setBlockForm] = useState({ clinic_id: '', date: '', reason: '' });
  const [cancelSessionForm, setCancelSessionForm] = useState({ clinic_id: '', date: '', reason: '' });
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
      if (!parsed || parsed.role !== 'admin') {
        toast.error('Admin privileges required.');
        router.push('/dashboard');
        return;
      }
      setUser(parsed);
      loadAllData();
    } catch {
      localStorage.removeItem('user');
      router.push('/login');
    }
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [clinicsRes, loadRes, staffRes, noShowRes] = await Promise.all([
        clinicAPI.list(),
        adminAPI.getClinicLoad(),
        adminAPI.listStaff(),
        adminAPI.getNoShowReport(),
      ]);

      setClinics(clinicsRes.data.data || []);
      if (clinicsRes.data.data.length > 0) {
        setSelectedClinic(clinicsRes.data.data[0].id);
        setBlockForm((f) => ({ ...f, clinic_id: clinicsRes.data.data[0].id }));
        setCancelSessionForm((f) => ({ ...f, clinic_id: clinicsRes.data.data[0].id }));
      }
      setClinicLoad(loadRes.data.data.clinics || []);
      setStaffList(staffRes.data.data || []);
      setNoShowReport(noShowRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load admin metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockDate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await adminAPI.blockDate(blockForm);
      toast.success(data.message || 'Date blocked successfully.');
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to block date.');
    }
  };

  const handleCancelSession = async (e) => {
    e.preventDefault();
    if (!confirm('This will CANCEL all booked appointments and send SMS alerts to affected mothers. Continue?')) {
      return;
    }
    try {
      const { data } = await adminAPI.cancelSession(cancelSessionForm);
      toast.success(`Session cancelled! ${data.data?.cancelledCount || 0} mothers notified via SMS.`);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel session.');
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
            <span className="text-xl">📊</span>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight">Admin & Clinic Management</h1>
              <p className="text-xs text-primary-700 font-semibold">{user?.name} · System Administrator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              className="p-2 text-gray-500 hover:text-primary-600 rounded-lg border bg-white"
              title="Refresh Data"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleLogout}
              className="text-xs flex items-center gap-1 text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg border bg-white font-medium"
            >
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-6xl mx-auto px-4 flex gap-3 border-t">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 size={16} /> Clinic Load & No-Show Reports
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${
              activeTab === 'staff'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} /> Staff Management ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 px-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 ${
              activeTab === 'sessions'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <CalendarX size={16} /> Block Dates & Session Cancellation
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading administrative metrics...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: REPORTS & CLINIC LOAD */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card">
                    <span className="text-xs font-bold text-gray-500 uppercase">Configured Clinics</span>
                    <p className="text-3xl font-extrabold text-primary-800 mt-1">{clinics.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Antenatal & Postnatal Outpatient</p>
                  </div>
                  <div className="card">
                    <span className="text-xs font-bold text-gray-500 uppercase">Assigned Staff</span>
                    <p className="text-3xl font-extrabold text-primary-800 mt-1">{staffList.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Doctors, Midwives & Records Officers</p>
                  </div>
                  <div className="card">
                    <span className="text-xs font-bold text-gray-500 uppercase">Emergency Protocol</span>
                    <p className="text-sm font-bold text-green-700 mt-2">Active</p>
                    <p className="text-xs text-gray-500 mt-1">Direct walk-in routing for urgent cases</p>
                  </div>
                </div>

                {/* Clinic Occupancy Load Table */}
                <div className="card !p-0 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b">
                    <h2 className="font-bold text-gray-800 text-sm">Today&apos;s Clinic Load & Occupancy</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase border-b">
                        <tr>
                          <th className="p-3">Clinic</th>
                          <th className="p-3">Total Slots</th>
                          <th className="p-3">Booked Slots</th>
                          <th className="p-3">Available</th>
                          <th className="p-3">Occupancy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {clinicLoad.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-500">
                              No slots scheduled for today.
                            </td>
                          </tr>
                        ) : (
                          clinicLoad.map((c, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="p-3 font-semibold text-gray-900">{c.clinic_name}</td>
                              <td className="p-3">{c.total_slots}</td>
                              <td className="p-3 font-semibold text-primary-700">{c.booked_slots}</td>
                              <td className="p-3 text-gray-600">{c.available_slots}</td>
                              <td className="p-3">
                                <span className="bg-primary-100 text-primary-800 font-bold px-2 py-1 rounded text-xs">
                                  {c.occupancy_pct || 0}%
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* No-Show Rates */}
                <div className="card !p-0 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b">
                    <h2 className="font-bold text-gray-800 text-sm">No-Show Rate by Clinic</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase border-b">
                        <tr>
                          <th className="p-3">Clinic</th>
                          <th className="p-3">Total Appointments</th>
                          <th className="p-3">No-Shows</th>
                          <th className="p-3">No-Show Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {noShowReport.map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3 font-semibold">{r.clinic_name}</td>
                            <td className="p-3">{r.total_appointments}</td>
                            <td className="p-3 text-red-600 font-semibold">{r.no_shows}</td>
                            <td className="p-3 font-bold text-gray-800">{r.no_show_rate || 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STAFF DIRECTORY */}
            {activeTab === 'staff' && (
              <div className="space-y-4">
                <div className="card !p-0 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h2 className="font-bold text-gray-800 text-sm">Authorized Hospital Personnel</h2>
                  </div>
                  <div className="divide-y">
                    {staffList.map((s) => (
                      <div key={s.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                        <div>
                          <p className="font-bold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            Phone: {s.phone} · Role: <span className="capitalize font-semibold text-primary-700">{s.role.replace('_', ' ')}</span>
                          </p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2.5 py-1 rounded-full uppercase">
                          {s.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: BLOCK DATES & DISRUPTIONS */}
            {activeTab === 'sessions' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Block Date */}
                <div className="card">
                  <h2 className="font-bold text-gray-900 text-base mb-2 flex items-center gap-2">
                    <CalendarX className="text-yellow-600" size={18} /> Block Clinic Date
                  </h2>
                  <p className="text-xs text-gray-500 mb-4">
                    Prevents mothers from booking any slots on this day (e.g. Doctor leave, public holiday).
                  </p>
                  <form onSubmit={handleBlockDate} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Clinic</label>
                      <select
                        className="input-field"
                        value={blockForm.clinic_id}
                        onChange={(e) => setBlockForm({ ...blockForm, clinic_id: e.target.value })}
                        required
                      >
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Date</label>
                      <input
                        type="date"
                        className="input-field"
                        value={blockForm.date}
                        onChange={(e) => setBlockForm({ ...blockForm, date: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="e.g. Midwife Training / Public Holiday"
                        value={blockForm.reason}
                        onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                      />
                    </div>

                    <button type="submit" className="btn-secondary w-full text-sm font-semibold !py-2.5">
                      Block Slots on this Date
                    </button>
                  </form>
                </div>

                {/* Cancel Session with Bulk SMS */}
                <div className="card border-red-200 bg-red-50/20">
                  <h2 className="font-bold text-red-900 text-base mb-2 flex items-center gap-2">
                    <AlertTriangle className="text-red-600" size={18} /> Cancel Session & Bulk SMS Alert
                  </h2>
                  <p className="text-xs text-red-700 mb-4">
                    Cancels all booked appointments on this date and dispatches automatic SMS rebooking notices to every affected patient.
                  </p>
                  <form onSubmit={handleCancelSession} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Clinic</label>
                      <select
                        className="input-field bg-white"
                        value={cancelSessionForm.clinic_id}
                        onChange={(e) => setCancelSessionForm({ ...cancelSessionForm, clinic_id: e.target.value })}
                        required
                      >
                        {clinics.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Session Date</label>
                      <input
                        type="date"
                        className="input-field bg-white"
                        value={cancelSessionForm.date}
                        onChange={(e) => setCancelSessionForm({ ...cancelSessionForm, date: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cancellation Reason (Included in SMS)</label>
                      <input
                        type="text"
                        className="input-field bg-white"
                        placeholder="e.g. Unforeseen staff emergency"
                        value={cancelSessionForm.reason}
                        onChange={(e) => setCancelSessionForm({ ...cancelSessionForm, reason: e.target.value })}
                        required
                      />
                    </div>

                    <button type="submit" className="btn-danger w-full text-sm font-semibold !py-2.5">
                      Cancel Session & Send Bulk SMS
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
