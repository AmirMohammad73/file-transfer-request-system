
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authAPI } from '../utils/api';

interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<User>;
    logout: () => void;
    register: (details: Omit<User, 'id'>) => Promise<User>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Check if user is already logged in (via cookie)
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const currentUser = await authAPI.getCurrentUser();
                setUser(currentUser);
            } catch (error) {
                // User is not authenticated
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (username: string, password: string): Promise<User> => {
        try {
            const loggedInUser = await authAPI.login(username, password);
            setUser(loggedInUser);
            return loggedInUser;
        } catch (error: any) {
            throw new Error(error.message || 'نام کاربری یا رمز عبور نامعتبر است');
        }
    };

    const register = async (details: Omit<User, 'id' | 'password'> & {password: string}): Promise<User> => {
        try {
            const newUser = await authAPI.register({
                name: details.name,
                username: details.username,
                password: details.password,
                role: details.role,
                department: details.department,
            });
            setUser(newUser);
            return newUser;
        } catch (error: any) {
            throw new Error(error.message || 'خطا در ثبت نام');
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
        }
    };
    
    return (
        <AuthContext.Provider value={{ user, login, logout, register, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
