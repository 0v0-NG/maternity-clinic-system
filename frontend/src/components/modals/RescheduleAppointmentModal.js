'use client';

import { useState, useRef } from 'react';
import { X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentAPI } from '../../lib/api';
import { getErrorMessage, getErrorCode } from '../../lib/errorMessages';
import { formatDate, formatTimeRange, formatTime12 } from '../../lib/dateTime';
import SlotPicker from '../clinic/SlotPicker';
import Button from '../ui/Button';

export default function RescheduleAppointmentModal({
  appointment,
  isOpen,
  onClose,
  onSuccess,
}) {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const slotPickerRef = useRef(null);

  if (!isOpen || !appointment) return null;

  const handleReschedule = async () => {
    if (!selectedSlot) {
      setErrorMessage('Please select a new appointment slot.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await appointmentAPI.reschedule(appointment.id, {
        new_slot_id: selectedSlot.id,
      });
      toast.success('Appointment rescheduled successfully.');
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      const code = getErrorCode(err);
      if (code === 'SLOT_TAKEN') {
        setErrorMessage('Another patient just took this slot. Please choose another time.');
        // Refresh available slots and clear selected slot
        setSelectedSlot(null);
        if (slotPickerRef.current && slotPickerRef.current.reload) {
          slotPickerRef.current.reload();
        }
      } else if (code === 'CUTOFF_PASSED') {
        setErrorMessage(
          'Appointments cannot be cancelled or rescheduled within 4 hours of the start time. Please contact the front desk.'
        );
      } else {
        setErrorMessage(getErrorMessage(err, 'Failed to reschedule appointment. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 my-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-primary-600">
            <Calendar size={24} />
            <h2 id="reschedule-modal-title" className="text-lg font-bold text-body">
              Reschedule Appointment
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

        {/* Current Booking Summary */}
        <div className="bg-clinic-50 border border-primary-100 rounded-xl p-3 text-xs space-y-1">
          <p className="font-semibold text-clinic-dark text-sm">{appointment.clinic_name}</p>
          <p className="text-body">
            <span className="text-body-muted">Current Slot:</span>{' '}
            {formatDate(appointment.slot_date)} at{' '}
            {formatTimeRange(appointment.start_time, appointment.end_time)}
          </p>
        </div>

        {/* 4-Hour Policy Notice */}
        <p className="text-[11px] text-body-muted">
          Note: Appointments cannot be rescheduled within 4 hours of the scheduled start time.
        </p>

        {/* Error message alert */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-status-emergency text-xs rounded-xl p-3">
            {errorMessage}
          </div>
        )}

        {/* Slot Picker */}
        <SlotPicker
          ref={slotPickerRef}
          clinicId={appointment.clinic_id}
          selectedSlotId={selectedSlot?.id}
          onSelectSlot={setSelectedSlot}
          excludeSlotId={appointment.slot_id}
          initialDate={appointment.slot_date}
        />

        {/* Selected Slot preview */}
        {selectedSlot && (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 text-xs text-clinic-dark font-medium">
            New slot selected:{' '}
            <span className="font-bold">{formatTime12(selectedSlot.start_time)}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleReschedule}
            disabled={!selectedSlot || loading}
            className="w-full"
          >
            {loading ? 'Rescheduling...' : 'Confirm Reschedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
