'use client';

import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastItem {
    id: number;
    title: string;
    description?: string;
    variant: 'success' | 'error' | 'info';
    duration?: number;
}

interface ToastContextValue {
    showToast: (opts: { title: string; description?: string; variant?: ToastItem['variant']; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let toastCounter = 0;

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);

    const showToast = useCallback((opts: { title: string; description?: string; variant?: ToastItem['variant']; duration?: number }) => {
        const id = ++toastCounter;
        const item: ToastItem = {
            id,
            title: opts.title,
            description: opts.description,
            variant: opts.variant || 'info',
            duration: opts.duration,
        };
        setItems((prev) => [...prev, item]);
        window.setTimeout(() => {
            setItems((prev) => prev.filter((x) => x.id !== id));
        }, opts.duration ?? 5000);
    }, []);

    const value = useMemo(() => ({ showToast }), [showToast]);

    const iconFor = (v: ToastItem['variant']) => v === 'success' ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" /> : v === 'error' ? <AlertTriangle size={16} className="text-red-500 flex-shrink-0" /> : <Info size={16} className="text-blue-500 flex-shrink-0" />;

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastPrimitive.Provider
                swipeDirection="up"
                duration={5000}
                label="Notificação"
            >
                <ToastPrimitive.Viewport
                    className={cn(
                        'fixed top-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)]',
                        'flex flex-col gap-2 outline-none',
                    )}
                />
                {items.map((item) => (
                    <ToastPrimitive.Root
                        key={item.id}
                        open
                        duration={item.duration ?? 5000}
                        onOpenChange={(open) => { if (!open) setItems((prev) => prev.filter((x) => x.id !== item.id)); }}
                        className={cn(
                            'w-full rounded-xl border bg-white shadow-modal p-3.5 flex items-start gap-2.5',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            item.variant === 'error' ? 'border-red-200 bg-red-50' : undefined,
                            item.variant === 'success' ? 'border-emerald-200 bg-emerald-50' : undefined,
                            item.variant === 'info' ? 'border-border/50 bg-white' : undefined,
                        )}
                    >
                        {iconFor(item.variant)}
                        <div className="min-w-0 flex-1">
                            <ToastPrimitive.Title className="text-sm font-semibold text-accent">
                                {item.title}
                            </ToastPrimitive.Title>
                            {item.description && (
                                <ToastPrimitive.Description className="text-xs text-accent/60 mt-0.5">
                                    {item.description}
                                </ToastPrimitive.Description>
                            )}
                        </div>
                        <ToastPrimitive.Close asChild>
                            <button className="p-0.5 rounded hover:bg-black/5 text-accent/30 hover:text-accent" aria-label="Fechar">
                                <X size={14} />
                            </button>
                        </ToastPrimitive.Close>
                    </ToastPrimitive.Root>
                ))}
            </ToastPrimitive.Provider>
        </ToastContext.Provider>
    );
}
