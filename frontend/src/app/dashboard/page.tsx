'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { users, groups, shares } from '@/lib/api';
import { Users, Shield, HardDrive, Activity, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [stats, setStats] = useState({ users: 0, groups: 0, shares: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const [u, g, s] = await Promise.allSettled([
                users.list(), groups.list(), shares.list(),
            ]);
            setStats({
                users: u.status === 'fulfilled' ? u.value.length : 0,
                groups: g.status === 'fulfilled' ? g.value.length : 0,
                shares: s.status === 'fulfilled' ? s.value.length : 0,
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const allStatCards = [
        { key: 'users', label: t('dashboard.totalUsers'), value: stats.users, icon: Users, href: '/dashboard/users', color: 'from-primary to-primary-dark' },
        { key: 'groups', label: t('dashboard.totalGroups'), value: stats.groups, icon: Shield, href: '/dashboard/groups', color: 'from-emerald-500 to-emerald-700' },
        { key: 'shares', label: t('dashboard.totalShares'), value: stats.shares, icon: HardDrive, href: '/dashboard/shares', color: 'from-violet-500 to-violet-700', requiredRole: 'Domain Admins' },
    ];

    const statCards = allStatCards.filter(card => !card.requiredRole || user?.groups?.includes(card.requiredRole));

    return (
        <div className="animate-fade-in">
            {/* Welcome header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold font-heading text-accent">
                    {t('dashboard.welcome')} 👋
                </h1>
                <p className="text-sm text-accent/50 mt-1">
                    {user?.display_name && `${user.display_name} • `}
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                {statCards.map((card) => (
                    <Link
                        key={card.key}
                        href={card.href}
                        className="group bg-white rounded-2xl border border-border/30 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
                    >
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-sm`}>
                                    <card.icon size={20} className="text-white" />
                                </div>
                                <ArrowUpRight size={16} className="text-accent/20 group-hover:text-primary transition-smooth" />
                            </div>
                            <div>
                                {loading ? (
                                    <div className="h-8 w-16 bg-surface rounded-lg animate-pulse" />
                                ) : (
                                    <p className="text-3xl font-bold font-heading text-accent">{card.value}</p>
                                )}
                                <p className="text-xs text-accent/50 mt-1 font-medium">{card.label}</p>
                            </div>
                        </div>
                        <div className={`h-1 bg-gradient-to-r ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </Link>
                ))}
            </div>

            {/* Quick info card */}
            <div className="bg-white rounded-2xl border border-border/30 shadow-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Activity size={18} className="text-primary" />
                    </div>
                    <h2 className="text-sm font-semibold text-accent">Active Directory Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-surface/50 rounded-xl p-4">
                        <p className="text-[10px] uppercase tracking-wider text-accent/40 font-semibold mb-1">Domain</p>
                        <p className="text-sm font-medium text-accent">SWAT.LOCAL</p>
                    </div>
                    <div className="bg-surface/50 rounded-xl p-4">
                        <p className="text-[10px] uppercase tracking-wider text-accent/40 font-semibold mb-1">Domain Controller</p>
                        <p className="text-sm font-medium text-accent">DC1</p>
                    </div>
                    <div className="bg-surface/50 rounded-xl p-4">
                        <p className="text-[10px] uppercase tracking-wider text-accent/40 font-semibold mb-1">Logged in as</p>
                        <p className="text-sm font-medium text-accent">{user?.username || '—'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
