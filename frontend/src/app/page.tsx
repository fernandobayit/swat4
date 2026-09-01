'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated()) {
            router.replace('/dashboard');
        } else {
            router.replace('/login');
        }
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20" />
                <p className="text-sm text-accent/50 font-medium">SWAT4</p>
            </div>
        </div>
    );
}
