'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { X, HelpCircle, Users, Shield, HardDrive, Globe, Activity, Settings, Info } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    const { t } = useTranslation();
    const { user } = useAuth();

    if (!isOpen) return null;

    const isDomainAdmin = user?.groups?.includes('Domain Admins');

    const helpSections = [
        {
            key: 'general',
            icon: Info,
            title: t('help.general.title'),
            content: t('help.general.content'),
            color: 'text-blue-500 bg-blue-50',
            visible: true
        },
        {
            key: 'users',
            icon: Users,
            title: t('help.users.title'),
            content: t('help.users.content'),
            color: 'text-indigo-500 bg-indigo-50',
            visible: true
        },
        {
            key: 'groups',
            icon: Shield,
            title: t('help.groups.title'),
            content: t('help.groups.content'),
            color: 'text-emerald-500 bg-emerald-50',
            visible: true
        },
        {
            key: 'shares',
            icon: HardDrive,
            title: t('help.shares.title'),
            content: t('help.shares.content'),
            color: 'text-violet-500 bg-violet-50',
            visible: isDomainAdmin
        },
        {
            key: 'dns',
            icon: Globe,
            title: t('help.dns.title'),
            content: t('help.dns.content'),
            color: 'text-sky-500 bg-sky-50',
            visible: isDomainAdmin
        },
        {
            key: 'activity',
            icon: Activity,
            title: t('help.activity.title'),
            content: t('help.activity.content'),
            color: 'text-rose-500 bg-rose-50',
            visible: isDomainAdmin
        },
        {
            key: 'settings',
            icon: Settings,
            title: t('help.settings.title'),
            content: t('help.settings.content'),
            color: 'text-slate-500 bg-slate-50',
            visible: isDomainAdmin
        }
    ];

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-modal w-full max-w-2xl p-0 animate-slide-up mx-4 max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/40 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <HelpCircle className="text-primary" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-heading text-accent">{t('help.title') || 'Centro de Ajuda'}</h2>
                            <p className="text-sm text-accent/60 mt-0.5">{t('help.subtitle') || 'Guia de uso baseado no seu perfil'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface transition-smooth text-accent/50 hover:text-accent">
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area - Scrollable */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {helpSections.filter(section => section.visible).map((section) => (
                        <div key={section.key} className="flex gap-4 group">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${section.color}`}>
                                <section.icon size={20} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-accent mb-1 group-hover:text-primary transition-colors">{section.title}</h3>
                                <p className="text-sm text-accent/70 leading-relaxed">{section.content}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/40 bg-surface/30 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 transition-smooth">
                        {t('help.close') || 'Fechar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
