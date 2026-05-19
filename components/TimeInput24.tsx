import React from 'react';
import { formatTime24, parseTime24 } from '../utils/time24';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45]; // تغییر از ۶۰ دقیقه به ۴ مقدار

interface TimeInput24Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

const selectClass =
  'p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-[#c0392b] focus:border-[#c0392b] disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed min-w-[4.5rem]';

const TimeInput24: React.FC<TimeInput24Props> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
}) => {
  const parsed = parseTime24(value);
  const hourValue = parsed !== null ? String(parsed.hour) : '';
  const minuteValue = parsed !== null ? String(parsed.minute) : '';

  const update = (hour: number | null, minute: number | null) => {
    if (hour === null || minute === null) {
      onChange('');
      return;
    }
    onChange(formatTime24(hour, minute));
  };

  return (
    <div className={`flex items-center gap-2 ${className}`} dir="ltr">
      <select
        value={hourValue}
        onChange={(e) => {
          const h = e.target.value === '' ? null : parseInt(e.target.value, 10);
          const m = parsed?.minute ?? (h !== null ? 0 : null);
          update(h, m);
        }}
        disabled={disabled}
        required={required && !hourValue}
        className={selectClass}
        aria-label="ساعت (۲۴ ساعته)"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="text-gray-600 font-bold" aria-hidden>
        :
      </span>
      <select
        value={minuteValue}
        onChange={(e) => {
          const m = e.target.value === '' ? null : parseInt(e.target.value, 10);
          const h = parsed?.hour ?? (m !== null ? 0 : null);
          update(h, m);
        }}
        disabled={disabled}
        required={required && !minuteValue}
        className={selectClass}
        aria-label="دقیقه"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeInput24;