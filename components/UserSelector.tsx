
import React from 'react';
import { USERS, ROLE_NAMES } from '../constants';
import { User } from '../types';
import { UserIcon } from './icons';

interface UserSelectorProps {
  currentUser: User;
  onUserChange: (user: User) => void;
}

const UserSelector: React.FC<UserSelectorProps> = ({ currentUser, onUserChange }) => {
  return (
    <div className="fixed top-4 left-4 z-50 bg-white shadow-lg rounded-lg p-2 flex items-center gap-4 border border-gray-200">
       <div className="flex items-center gap-2 text-sm text-gray-700">
         <UserIcon className="w-5 h-5 text-[#3498db]"/>
         <span>کاربر فعلی:</span>
         <span className="font-bold">{currentUser.name} ({ROLE_NAMES[currentUser.role]})</span>
       </div>
       <div className="h-6 border-l border-gray-300"></div>
       <div className="flex items-center gap-2">
         <label htmlFor="user-select" className="text-sm">تغییر کاربر:</label>
         <select
            id="user-select"
            value={currentUser.id}
            onChange={(e) => {
                const selectedUser = USERS.find(u => u.id === parseInt(e.target.value));
                if (selectedUser) {
                    onUserChange(selectedUser);
                }
            }}
            className="p-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#3498db] focus:border-[#3498db]"
         >
             {USERS.map(user => (
                 <option key={user.id} value={user.id}>{user.name}</option>
             ))}
         </select>
       </div>
    </div>
  );
};

export default UserSelector;
