import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authAPI } from '../utils/api';

interface UserSelectorProps {
  value: number[];
  onChange: (userIds: number[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const UserSelector: React.FC<UserSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'انتخاب کاربران همگروه برای اطلاع‌رسانی'
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      if (disabled) return;
      
      try {
        setLoading(true);
        const sameGroupUsers = await authAPI.getSameGroupUsers();
        setUsers(sameGroupUsers);
      } catch (error) {
        console.error('Error fetching same group users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [disabled]);

  const filteredUsers = users.filter(user => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    
    return (
      user.name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.department.toLowerCase().includes(q)
    );
  });

  const handleToggleUser = (userId: number) => {
    const newValue = value.includes(userId)
      ? value.filter(id => id !== userId)
      : [...value, userId];
    
    onChange(newValue);
  };

  const selectedUsers = users.filter(user => value.includes(user.id));

  return (
    <div className={`relative ${className}`}>
      <div 
        className={`w-full p-2 border border-gray-300 rounded-md bg-white cursor-pointer ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
      >
        {selectedUsers.length === 0 ? (
          <div className="text-gray-500">
            {disabled ? 'در حال بارگذاری...' : placeholder}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedUsers.map(user => (
              <span 
                key={user.id}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
              >
                {user.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleUser(user.id);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجو در کاربران..."
              className="w-full p-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Users list */}
          <div className="py-1">
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">در حال بارگذاری...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {query ? 'کاربری یافت نشد' : 'هیچ کاربر همگروهی یافت نشد'}
              </div>
            ) : (
              filteredUsers.map(user => (
                <div
                  key={user.id}
                  className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 cursor-pointer ${value.includes(user.id) ? 'bg-blue-50' : ''}`}
                  onClick={() => handleToggleUser(user.id)}
                >
                  <input
                    type="checkbox"
                    checked={value.includes(user.id)}
                    onChange={() => handleToggleUser(user.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{user.name}</div>
                    <div className="text-xs text-gray-500">
                      {user.department} • {user.role}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
            {selectedUsers.length} کاربر انتخاب شده
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {open && !disabled && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
};

export default UserSelector;