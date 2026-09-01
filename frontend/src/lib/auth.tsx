'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth as authApi, setToken, removeToken, isAuthenticated } from '@/lib/api';
import type { AuthUser } from '@/lib/types';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    login: async () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing session
        if (isAuthenticated()) {
            const savedUser = localStorage.getItem('swat4_user');
            if (savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                } catch {
                    removeToken();
                    localStorage.removeItem('swat4_user');
                }
            }
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        const response = await authApi.login(username, password);
        setToken(response.access_token);
        const userData: AuthUser = response.user;
        setUser(userData);
        localStorage.setItem('swat4_user', JSON.stringify(userData));
    };

    const logout = () => {
        removeToken();
        localStorage.removeItem('swat4_user');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
