import React from 'react';
import DatePicker from 'react-multi-date-picker';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import gregorian from 'react-date-object/calendars/gregorian';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import DateObject from 'react-date-object';
import 'react-multi-date-picker/styles/colors/teal.css';

interface PersianDatePickerProps {
  value: string; // تاریخ میلادی به فرمت YYYY-MM-DD
  onChange: (value: string) => void; // تاریخ میلادی را برمی‌گرداند
  placeholder?: string;
  label?: string;
  className?: string;
}

const PersianDatePicker: React.FC<PersianDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ',
  label,
  className = '',
}) => {
  // تبدیل تاریخ میلادی به شمسی برای نمایش در datepicker
  const getPersianDate = (): DateObject | null => {
    if (!value) return null;
    
    try {
      const [year, month, day] = value.split('-').map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
      
      // ایجاد یک DateObject میلادی
      const gregorianDate = new DateObject({
        year,
        month,
        day,
        calendar: gregorian,
        locale: gregorian_en,
      });
      
      // تبدیل به شمسی
      const persianDate = gregorianDate.convert(persian, persian_fa);
      
      return persianDate;
    } catch (error) {
      console.error('خطا در تبدیل تاریخ:', error);
      return null;
    }
  };

  // تبدیل تاریخ شمسی انتخاب شده به میلادی
  const handleDateChange = (date: DateObject | null) => {
    if (!date) {
      onChange('');
      return;
    }

    try {
      // تبدیل از شمسی به میلادی
      const gregorianDate = date.convert(gregorian, gregorian_en);
      
      const year = String(gregorianDate.year).padStart(4, '0');
      const month = String(gregorianDate.month).padStart(2, '0');
      const day = String(gregorianDate.day).padStart(2, '0');
      
      const gregorianDateString = `${year}-${month}-${day}`;
      onChange(gregorianDateString);
    } catch (error) {
      console.error('خطا در تبدیل تاریخ:', error);
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          {label}
        </label>
      )}
      <DatePicker
        value={getPersianDate()}
        onChange={handleDateChange}
        calendar={persian}
        locale={persian_fa}
        calendarPosition="bottom-right"
        placeholder={placeholder}
        format="YYYY/MM/DD"
        className="rmdp-input w-full"
        inputClass="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db] text-left cursor-pointer"
        containerClassName="w-full"
        editable={false}
      />
    </div>
  );
};

export default PersianDatePicker;
