
import React, { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainApp from './pages/MainApp';

const App: React.FC = () => {
    const { user, loading } = useAuth();
    const [authView, setAuthView] = useState<'login' | 'register'>('login');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-600">در حال بارگذاری...</p>
            </div>
        );
    }

    if (!user) {
        return authView === 'login' 
            ? <LoginPage onSwitchView={() => setAuthView('register')} />
            : <RegisterPage onSwitchView={() => setAuthView('login')} />
    }
    
    return <MainApp />;
};

export default App;
