import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import AuthLayout from '../layouts/AuthLayout';

interface LoginPageProps {
    onSwitchView: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSwitchView }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(username, password);
            // The App component will handle navigation on successful login
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <AuthLayout title="ورود به سیستم">
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">نام کاربری</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#3498db] focus:border-[#3498db] sm:text-sm bg-white"
                    />
                </div>
                <div>
                    <label htmlFor="password"  className="block text-sm font-medium text-gray-700">رمز عبور</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#3498db] focus:border-[#3498db] sm:text-sm bg-white"
                    />
                </div>
                <div>
                    <button
                        type="submit"
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#3498db] hover:bg-[#2980b9] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3498db] transition cursor-pointer"
                    >
                        ورود
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
};

export default LoginPage;