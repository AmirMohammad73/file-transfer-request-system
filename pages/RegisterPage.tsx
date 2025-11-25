
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import AuthLayout from '../layouts/AuthLayout';
import { Role } from '../types';
import { ROLE_NAMES } from '../constants';

interface RegisterPageProps {
    onSwitchView: () => void;
}

const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchView }) => {
    const [formData, setFormData] = useState({ name: '', department: '', username: '', password: '', role: Role.REQUESTER });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const { register } = useAuth();
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            await register(formData);
            setSuccess('ثبت نام با موفقیت انجام شد! اکنون می‌توانید وارد شوید.');
            setTimeout(onSwitchView, 2000);
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <AuthLayout title="ایجاد حساب کاربری جدید">
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
                {success && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">{success}</div>}

                {Object.entries({name: 'نام و نام خانوادگی', department: 'واحد سازمانی', username: 'نام کاربری', password: 'رمز عبور'}).map(([name, label]) => (
                    <div key={name}>
                        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
                        <input
                            type={name === 'password' ? 'password' : 'text'}
                            id={name}
                            name={name}
                            value={formData[name as keyof typeof formData] as string}
                            onChange={handleChange}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#3498db] focus:border-[#3498db] sm:text-sm bg-white"
                        />
                    </div>
                ))}
                
                 <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">نقش</label>
                    <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-[#3498db] focus:border-[#3498db] sm:text-sm rounded-md bg-white"
                    >
                        {Object.entries(ROLE_NAMES).map(([roleKey, roleName]) => (
                            <option key={roleKey} value={roleKey}>{roleName}</option>
                        ))}
                    </select>
                </div>
                
                <div>
                    <button type="submit" className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#2ecc71] hover:bg-[#27ae60] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2ecc71] transition cursor-pointer">
                        ثبت نام
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
};

export default RegisterPage;
