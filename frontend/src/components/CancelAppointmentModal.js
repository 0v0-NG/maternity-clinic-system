'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentAPI } from '../lib/api';
import { getErrorMessage, getErrorCode } from '../lib/errorMessages';
import { formatDate, formatTimeRange } from '../lib/dateTime';
import Button from './Button';

export default function CancelAppointmentModal({
  appointment,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !appointment) return null;

  const handleCancel = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      await appointmentAPI.cancel(appointment.id, {
        reason: reason.trim() || undefined,
      });
      toast.success('Appointment cancelled successfully.');
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'CUTOFF_PASSED') {
        setErrorMessage(
          'Appointments cannot be cancelled within 4 hours of the start time. Please contact the front desk.'
        );
      } else {
        setErrorMessage(getErrorMessage(err, 'Failed to cancel appointment. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-status-emergency">
            <AlertTriangle size={24} />
            <h2 id="cancel-modal-title" className="text-lg font-bold text-body">
              Cancel Appointment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-body-muted hover:text-body p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Appointment Summary */}
        <div className="bg-clinic-50 border border-primary-100 rounded-xl p-3 text-xs text-body space-y-1">
          <p className="font-semibold text-clinic-dark text-sm">{appointment.clinic_name}</p>
          <p>
            <span className="text-body-muted">Date:</span> {formatDate(appointment.slot_date)}
          </p>
          <p>
            <span className="text-body-muted">Time:</span>{' '}
            {formatTimeRange(appointment.start_time, appointment.end_time)}
          </p>
        </div>

        {/* 4-hour rule notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          <strong className="block font-semibold mb-1">4-Hour Policy Notice:</strong>
          Hospital policy requires appointments to be cancelled at least 4 hours before your
          scheduled slot. Cancelling immediately releases this slot for another mother.
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-status-emergency text-xs rounded-xl p-3">
            {errorMessage}
          </div>
        )}

        {/* Optional reason */}
        <div>
          <label
            htmlFor="cancel-reason"
            className="block text-xs font-semibold text-body-muted mb-1"
          >
            Reason for cancellation (optional)
          </label>
          <textarea
            id="cancel-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Schedule conflict, feeling unwell..."
            className="w-full text-xs p-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-body-muted"
            disabled={loading}
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full"
          >
            Keep Visit
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleCancel}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Cancelling...' : 'Confirm Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
