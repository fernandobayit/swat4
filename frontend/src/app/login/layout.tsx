'use client';

import React from 'react';
import { I18nProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            <AuthProvider>
                <ToastProvider>
                {children}
            </AuthProvider>
                </ToastProvider>
        </I18nProvider>
    );
}
