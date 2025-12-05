
import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainApp from './pages/MainApp';
import { ToastProvider } from './components/ToastContainer';

const App: React.FC = () => {
    const { user, loading } = useAuth();
    const [authView, setAuthView] = useState<'login' | 'register'>('login');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">در حال بارگذاری...</p>
                </div>
            </div>
        );
    }

    return (
        <ToastProvider>
            {!user ? (
                authView === 'login' 
                    ? <LoginPage onSwitchView={() => setAuthView('register')} />
                    : <RegisterPage onSwitchView={() => setAuthView('login')} />
            ) : (
                <MainApp />
            )}
        </ToastProvider>
    );
};

export default App;
