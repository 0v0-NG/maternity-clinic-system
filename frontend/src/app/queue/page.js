'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Users, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { queueAPI, appointmentAPI } from '../../lib/api';

export default function QueueTrackerPage() {
  const [appointments, setAppointments] = useState([]);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [queueInfo, setQueueInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadTodayAppointments();
  }, []);

  useEffect(() => {
    if (selectedAppt) {
      loadPosition(selectedAppt.id);
    }
  }, [selectedAppt]);

  const loadTodayAppointments = async () => {
    try {
      const { data } = await appointmentAPI.list({ upcoming: 'true' });
      const checkedInOrBooked = data.data.filter((a) =>
        ['booked', 'checked_in', 'waiting', 'in_consultation'].includes(a.status)
      );
      setAppointments(checkedInOrBooked);
      if (checkedInOrBooked.length > 0) {
        setSelectedAppt(checkedInOrBooked[0]);
      }
    } catch (err) {
      toast.error('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  const loadPosition = async (appointmentId) => {
    setRefreshing(true);
    try {
      const { data } = await queueAPI.getPosition(appointmentId);
      setQueueInfo(data.data);
    } catch (err) {
      // not checked in yet
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-gray-500">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">Live Clinic Queue</h1>
          </div>
          {selectedAppt && (
            <button
              onClick={() => loadPosition(selectedAppt.id)}
              disabled={refreshing}
              className="text-primary-600 hover:text-primary-700"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Checking clinic queue...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="card text-center py-10">
            <Clock size={40} className="mx-auto text-gray-300 mb-3" />
            <h2 className="font-bold text-gray-800">No Active Appointments Today</h2>
            <p className="text-sm text-gray-500 mt-1">Book an appointment or check in at the clinic desk upon arrival.</p>
          </div>
        ) : (
          <>
            {/* Appointment Selector if multiple */}
            {appointments.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {appointments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAppt(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      selectedAppt?.id === a.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'
                    }`}
                  >
                    {a.clinic_name} ({a.start_time})
                  </button>
                ))}
              </div>
            )}

            {/* Queue Status Card */}
            <div className="card text-center p-8 bg-gradient-to-b from-white to-primary-50/30">
              <span className="text-xs font-bold uppercase tracking-wider text-primary-700 bg-primary-100 px-3 py-1 rounded-full inline-block mb-3">
                {selectedAppt?.clinic_name}
              </span>

              {selectedAppt?.status === 'booked' ? (
                <div className="py-6 space-y-3">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto text-yellow-600">
                    <AlertCircle size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">Not Checked In Yet</h3>
                  <p className="text-sm text-gray-600">
                    Scheduled for today at <span className="font-bold">{selectedAppt?.start_time}</span>.
                  </p>
                  <p className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                    Please notify the Front Desk / Records Officer upon arrival at the hospital to receive your queue ticket.
                  </p>
                </div>
              ) : selectedAppt?.status === 'in_consultation' ? (
                <div className="py-6 space-y-3">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 animate-pulse">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-green-700">It&apos;s Your Turn!</h3>
                  <p className="text-sm font-semibold text-gray-700">
                    Queue Ticket: <span className="text-lg text-primary-700">{selectedAppt?.queue_number}</span>
                  </p>
                  <p className="text-sm text-gray-600">Please proceed into the consultation room with the doctor / midwife.</p>
                </div>
              ) : (
                <div className="py-4 space-y-4">
                  <p className="text-sm text-gray-500">Your Queue Number</p>
                  <div className="text-5xl font-black text-primary-600 tracking-tight">
                    {selectedAppt?.queue_number || queueInfo?.queueNumber || '...'}
                  </div>

                  <div className="bg-white border rounded-xl p-4 shadow-sm flex justify-around items-center">
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase">Position in Line</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {queueInfo?.position ? `#${queueInfo.position}` : '1'}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-gray-200"></div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase">Est. Wait</p>
                      <p className="text-2xl font-bold text-gray-800">
                        {queueInfo?.position ? `${(queueInfo.position - 1) * 20}m` : '0m'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                    <Users size={14} /> You will be alerted when called.
                  </p>
                </div>
              )}
            </div>

            {/* General Advice */}
            <div className="bg-white rounded-lg p-4 border text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">Clinic Instructions:</p>
              <p>• Have your Hospital Folder number ready.</p>
              <p>• For postnatal visits, baby weight and checks will be taken together.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
