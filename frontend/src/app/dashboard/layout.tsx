'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isAuthenticated } from '@/lib/api';
import Sidebar from '@/components/sidebar';

function DashboardShell({ children }: { children: React.ReactNode }) {
    const { isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated()) {
            router.replace('/login');
        }
    }, [isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm text-accent/40">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-surface overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <div className="p-6 max-w-[1600px] mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <AuthProvider>
                <DashboardShell>{children}</DashboardShell>
            </AuthProvider>
        </I18nProvider>
    );
}
