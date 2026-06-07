
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLE_NAMES } from '../constants';
import { ClockIcon, UserIcon } from './icons';
import { useNotification } from '../hooks/useNotification';
import ChangePasswordModal from './ChangePasswordModal';

interface HeaderProps {
    onShowHistory: () => void;
    onShowSystemManagement: () => void;
}

const Header: React.FC<HeaderProps> = ({ onShowHistory, onShowSystemManagement }) => {
    const { user, logout } = useAuth();
    const { permission, requestPermission } = useNotification();
    const [isRequesting, setIsRequesting] = useState(false);
    const [showChangePassword, setShowChangePassword] = useState(false);
    
    if (!user) return null;

    const handleEnableNotifications = async () => {
        // بررسی permission فعلی
        if (typeof window !== 'undefined' && 'Notification' in window) {
            const currentPermission = Notification.permission;
            
            // اگر قبلاً denied شده باشد، راهنمایی نمایش بده
            if (currentPermission === 'denied') {
                const userAgent = navigator.userAgent.toLowerCase();
                let instructions = '';
                
                if (userAgent.includes('chrome') || userAgent.includes('edge')) {
                    instructions = 'برای فعال کردن اعلان‌ها در Chrome/Edge:\n1. روی آیکون قفل یا اطلاعات در نوار آدرس کلیک کنید\n2. در بخش "اعلان‌ها" گزینه "اجازه" را انتخاب کنید\n3. صفحه را رفرش کنید';
                } else if (userAgent.includes('firefox')) {
                    instructions = 'برای فعال کردن اعلان‌ها در Firefox:\n1. روی آیکون قفل در نوار آدرس کلیک کنید\n2. در بخش "اعلان‌ها" گزینه "اجازه" را انتخاب کنید\n3. صفحه را رفرش کنید';
                } else if (userAgent.includes('safari')) {
                    instructions = 'برای فعال کردن اعلان‌ها در Safari:\n1. Safari > Settings > Websites > Notifications\n2. این سایت را پیدا کرده و "Allow" را انتخاب کنید\n3. صفحه را رفرش کنید';
                } else {
                    instructions = 'لطفاً از تنظیمات مرورگر خود، مجوز اعلان‌ها را برای این سایت فعال کنید.';
                }
                
                alert(`مجوز ارسال اعلان قبلاً رد شده است.\n\n${instructions}`);
                setIsRequesting(false);
                return;
            }
        }
        
        setIsRequesting(true);
        try {
            const result = await requestPermission();
            if (result === 'granted') {
                alert('اعلان‌ها با موفقیت فعال شدند! حالا می‌توانید حتی وقتی مرورگر بسته است هم اعلان‌ها را دریافت کنید.');
            } else if (result === 'denied') {
                const userAgent = navigator.userAgent.toLowerCase();
                let instructions = '';
                
                if (userAgent.includes('chrome') || userAgent.includes('edge')) {
                    instructions = 'برای فعال کردن اعلان‌ها در Chrome/Edge:\n1. روی آیکون قفل یا اطلاعات در نوار آدرس کلیک کنید\n2. در بخش "اعلان‌ها" گزینه "اجازه" را انتخاب کنید\n3. صفحه را رفرش کنید';
                } else if (userAgent.includes('firefox')) {
                    instructions = 'برای فعال کردن اعلان‌ها در Firefox:\n1. روی آیکون قفل در نوار آدرس کلیک کنید\n2. در بخش "اعلان‌ها" گزینه "اجازه" را انتخاب کنید\n3. صفحه را رفرش کنید';
                } else if (userAgent.includes('safari')) {
                    instructions = 'برای فعال کردن اعلان‌ها در Safari:\n1. Safari > Settings > Websites > Notifications\n2. این سایت را پیدا کرده و "Allow" را انتخاب کنید\n3. صفحه را رفرش کنید';
                } else {
                    instructions = 'لطفاً از تنظیمات مرورگر خود، مجوز اعلان‌ها را برای این سایت فعال کنید.';
                }
                
                alert(`مجوز ارسال اعلان رد شد.\n\n${instructions}`);
            } else {
                // اگر کاربر پنجره را بست (default باقی ماند)
                alert('لطفاً برای دریافت اعلان‌ها، مجوز را تایید کنید.');
            }
        } catch (error) {
            console.error('خطا در درخواست مجوز:', error);
            alert('خطا در فعال کردن اعلان‌ها. لطفاً دوباره تلاش کنید.');
        } finally {
            setIsRequesting(false);
        }
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md p-3 flex flex-col md:flex-row justify-between items-center gap-3 border-b border-gray-200">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                 <button 
                    onClick={onShowHistory}
                    className="bg-[#2c3e50] text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-[#1a252f] transition-all text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2c3e50] focus:ring-offset-2 font-medium shadow-sm hover:shadow-md"
                    aria-label="مشاهده تاریخچه درخواست‌ها"
                >
                    <ClockIcon className="w-5 h-5"/>
                    <span className="hidden sm:inline">تاریخچه</span>
                 </button>
                 <button 
                    onClick={onShowSystemManagement}
                    className="bg-[#16a085] text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-[#138d75] transition-all text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#16a085] focus:ring-offset-2 font-medium shadow-sm hover:shadow-md"
                    aria-label="شناسنامه سامانه‌ها"
                >
                    <span className="text-lg">🖥️</span>
                    <span className="hidden sm:inline">شناسنامه سامانه‌ها</span>
                 </button>
                 {permission !== 'granted' && (
                    <button 
                        onClick={handleEnableNotifications}
                        disabled={isRequesting}
                        className="bg-[#3498db] text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-[#2980b9] transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3498db] focus:ring-offset-2 font-medium shadow-sm hover:shadow-md"
                        aria-label="فعال‌سازی اعلان‌ها"
                    >
                        {isRequesting ? (
                            <>
                                <div className="spinner"></div>
                                <span className="hidden sm:inline">در حال فعال‌سازی...</span>
                            </>
                        ) : (
                            <>
                                <span>🔔</span>
                                <span className="hidden sm:inline">فعال‌سازی اعلان‌ها</span>
                            </>
                        )}
                    </button>
                 )}
            </div>
            <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <UserIcon className="w-5 h-5 text-[#3498db]"/>
                    <span className="hidden md:inline">خوش آمدید،</span>
                    <span className="font-bold">{user.name}</span>
                    <span className="text-gray-500 hidden lg:inline">({ROLE_NAMES[user.role]})</span>
                </div>
                 <div className="h-6 border-l border-gray-300 hidden md:block"></div>
                 <button
                    onClick={() => setShowChangePassword(true)}
                    className="bg-[#9b59b6] text-white px-3 md:px-4 py-2 rounded-md hover:bg-[#8e44ad] transition-all text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#9b59b6] focus:ring-offset-2 shadow-sm hover:shadow-md"
                    aria-label="تغییر رمز عبور"
                >
                    <span className="hidden sm:inline">تغییر رمز عبور</span>
                    <span className="sm:hidden">رمز</span>
                </button>
                <button
                    onClick={logout}
                    className="bg-red-500 text-white px-3 md:px-4 py-2 rounded-md hover:bg-red-600 transition-all text-sm font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
                    aria-label="خروج از سیستم"
                >
                    خروج
                </button>
            </div>
            <ChangePasswordModal 
                isOpen={showChangePassword} 
                onClose={() => setShowChangePassword(false)} 
            />
        </header>
    );
};

export default Header;
