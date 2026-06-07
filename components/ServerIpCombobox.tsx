import React, { useState, useRef, useEffect, useId } from 'react';

interface ServerIpComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

const ServerIpCombobox: React.FC<ServerIpComboboxProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'انتخاب IP از لیست',
  required = false,
  className = '',
  id,
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((ip) => {
    const q = query.trim();
    return !q || ip.includes(q);
  });

  const handleSelect = (ip: string) => {
    onChange(ip);
    setOpen(false);
    setQuery('');
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (query.trim() && options.includes(query.trim())) {
        onChange(query.trim());
      }
      setOpen(false);
      setQuery('');
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        id={inputId}
        type="text"
        value={open ? query : value}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          if (options.includes(e.target.value.trim())) {
            onChange(e.target.value.trim());
          }
        }}
        onFocus={() => {
          if (!disabled) {
            setQuery(value);
            setOpen(true);
          }
        }}
        onBlur={handleBlur}
        placeholder={disabled ? 'ابتدا سامانه را انتخاب کنید' : placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
        className={`w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
        aria-expanded={open}
        aria-autocomplete="list"
        role="combobox"
      />
      {open && !disabled && filtered.length > 0 && (
        <ul
          className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg"
          role="listbox"
        >
          {filtered.map((ip) => (
            <li key={ip}>
              <button
                type="button"
                className={`w-full text-right px-3 py-2 text-sm font-mono hover:bg-teal-50 transition-colors ${
                  ip === value ? 'bg-teal-100 text-teal-900 font-semibold' : 'text-gray-800'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(ip)}
                role="option"
                aria-selected={ip === value}
              >
                {ip}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !disabled && query.trim() && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-lg text-sm text-gray-500">
          IP یافت نشد
        </div>
      )}
    </div>
  );
};

export default ServerIpCombobox;
