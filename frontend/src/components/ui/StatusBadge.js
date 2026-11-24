import { Clock2, CheckCircle2, X, AlertCircle } from 'lucide-react';

// Status colours per DESIGN:
// amber = waiting, teal = in consultation, soft green = booked/completed,
// red = cancelled / no-show / emergency. Amber = late badge.
const STATUS_CONFIG = {
  booked: { label: 'Booked', color: 'bg-status-booked text-white', dot: 'status-booked' },
  completed: { label: 'Completed', color: 'bg-status-completed text-white', dot: 'status-completed' },
  checked_in: { label: 'Checked In', color: 'bg-status-consultation text-white', dot: 'status-consultation' },
  waiting: { label: 'Waiting', color: 'bg-status-waiting text-white', dot: 'status-waiting' },
  in_consultation: { label: 'In Consultation', color: 'bg-status-consultation text-white', dot: 'status-consultation' },
  cancelled: { label: 'Cancelled', color: 'bg-status-cancelled text-white', dot: 'status-cancelled' },
  no_show: { label: 'No Show', color: 'bg-status-no-show text-white', dot: 'status-no-show' },
};

const ICONS = {
  booked: Clock2,
  completed: CheckCircle2,
  checked_in: CheckCircle2,
  waiting: Clock2,
  in_consultation: CheckCircle2,
  cancelled: X,
  no_show: AlertCircle,
};

export default function StatusBadge({ status, late_arrival = false, className = '', size = 'small' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.booked;
  const pad = size === 'large' ? 'px-3 py-1.5' : 'px-2.5 py-1';
  const textSize = size === 'large' ? 'text-sm' : 'text-xs';
  const Icon = ICONS[status] || Clock2;

  return (
    <div className={`inline-flex items-center gap-1.5 ${pad} rounded-full border ${config.color} ${textSize} font-semibold ${className}`}>
      <Icon size={size === 'large' ? 14 : 12} className="opacity-90" />
      <span>{config.label}</span>
      {late_arrival && (
        <span className="bg-status-late text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Late</span>
      )}
    </div>
  );
}
