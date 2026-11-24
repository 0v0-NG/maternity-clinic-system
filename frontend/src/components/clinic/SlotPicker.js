'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { clinicAPI } from '../../lib/api';
import { getNextDays, formatTime12 } from '../../lib/dateTime';
import Skeleton from '../ui/Skeleton';

const SlotPicker = forwardRef(function SlotPicker(
  {
    clinicId,
    selectedSlotId = null,
    onSelectSlot,
    onDateChange,
    excludeSlotId = null,
    initialDate = null,
    allowWalkin = false,
    className = '',
  },
  ref
) {
  const dates = getNextDays(14);
  const [selectedDate, setSelectedDate] = useState(initialDate || dates[0]?.date);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSlots = async (cid, dateStr) => {
    if (!cid || !dateStr) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clinicAPI.getSlots(cid, dateStr);
      const available = res?.data?.data?.availableSlots || [];
      const filtered = available
        .filter((slot) => {
          if (!allowWalkin && slot.is_walkin) return false;
          if (excludeSlotId && slot.id === excludeSlotId) return false;
          return true;
        })
        .map((slot) => ({ ...slot, date: dateStr }));
      setSlots(filtered);
    } catch (err) {
      setError('Could not load slots for this date. Please try another.');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    reload: () => {
      if (clinicId && selectedDate) {
        loadSlots(clinicId, selectedDate);
      }
    },
    getSelectedDate: () => selectedDate,
  }));

  useEffect(() => {
    if (clinicId && selectedDate) {
      loadSlots(clinicId, selectedDate);
    }
  }, [clinicId, selectedDate]);

  const handleDateClick = (dateStr) => {
    setSelectedDate(dateStr);
    onDateChange && onDateChange(dateStr);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Date Carousel / Pills */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-body-muted mb-2">
          Select Date (Next 14 Days)
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {dates.map((d) => {
            const isSelected = selectedDate === d.date;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => handleDateClick(d.date)}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl border text-xs transition-colors min-w-[70px] ${
                  isSelected
                    ? 'bg-primary-500 text-white border-primary-500 font-bold shadow-sm'
                    : 'bg-white text-body border-border hover:border-primary-300 hover:bg-clinic-50 font-medium'
                }`}
              >
                <span className="uppercase text-[10px] tracking-wide opacity-80">
                  {d.isToday ? 'Today' : d.weekday}
                </span>
                <span className="font-semibold text-sm mt-0.5">{d.dayMonth}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots Section */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-body-muted mb-2">
          Available Times
        </label>

        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={44} className="rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-xs text-status-emergency bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </div>
        ) : slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-clinic-50 p-6 text-center text-sm text-body-muted font-medium">
            No available slots on this day, please try another date
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
            {slots.map((slot) => {
              const isSelected = selectedSlotId === slot.id;
              const formattedTime = formatTime12(slot.start_time);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => onSelectSlot && onSelectSlot(slot)}
                  className={`h-11 px-3 rounded-xl border text-xs font-medium flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-primary-500 text-white border-primary-500 font-bold shadow-sm ring-2 ring-primary-300'
                      : 'bg-white text-clinic-dark border-primary-200 hover:border-primary-500 hover:bg-primary-50'
                  }`}
                >
                  {formattedTime}
                  {slot.is_walkin && (
                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ml-1 ${isSelected ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
                      Walk-in
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default SlotPicker;
