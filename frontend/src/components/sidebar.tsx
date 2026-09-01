'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation, localeNames, localeFlags } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { roles as rolesApi } from '@/lib/api';
import {
    LayoutDashboard,
    Users,
    Shield,
    HardDrive,
    FileText,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Globe,
    Activity,
    Settings,
    ChevronDown,
    HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import HelpModal from './help-modal';

interface RolePermissions {
    can_manage_users: boolean;
    can_manage_groups: boolean;
    can_manage_shares: boolean;
    can_view_dns: boolean;
    [key: string]: boolean | string | string[];
}

const menuItems = [
    { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { key: 'users', href: '/dashboard/users', icon: Users, labelKey: 'nav.users', permission: 'can_manage_users' },
    { key: 'groups', href: '/dashboard/groups', icon: Shield, labelKey: 'nav.groups', permission: 'can_manage_groups' },
    { key: 'shares', href: '/dashboard/shares', icon: HardDrive, labelKey: 'nav.shares', permission: 'can_manage_shares' },
    { key: 'logs', href: '/dashboard/logs', icon: FileText, labelKey: 'nav.logs' },
    { key: 'dns', href: '/dashboard/dns', icon: Globe, labelKey: 'nav.dns', requiredRole: 'Domain Admins' },
    { key: 'activity', href: '/dashboard/activity', icon: Activity, labelKey: 'nav.activity', requiredRole: 'Domain Admins' },
    { key: 'settings', href: '/dashboard/settings', icon: Settings, labelKey: 'nav.settings', requiredRole: 'Domain Admins' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { t, locale, setLocale } = useTranslation();
    const { user, logout } = useAuth();
    const [collapsed, setCollapsed] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);

    const isDomainAdmin = user?.groups?.includes('Domain Admins') ?? false;
    const isAccountOperator = user?.groups?.includes('Account Operators') ?? false;

    useEffect(() => {
        if (isAccountOperator && !isDomainAdmin) {
            rolesApi.getSettings('Account Operators')
                .then((data: RolePermissions) => setRolePermissions(data))
                .catch(() => setRolePermissions(null));
        }
    }, [isAccountOperator, isDomainAdmin]);

    const isItemVisible = (item: typeof menuItems[number]) => {
        if (item.requiredRole && !isDomainAdmin) {
            return false;
        }
        if (item.permission && !isDomainAdmin) {
            if (isAccountOperator && rolePermissions) {
                return !!rolePermissions[item.permission];
            }
            return false;
        }
        return true;
    };

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    return (
        <aside
            className={cn(
                'h-screen flex flex-col bg-white border-r border-border/60 transition-all duration-300 relative group',
                collapsed ? 'w-[72px]' : 'w-[260px]'
            )}
        >
            {/* Logo area */}
            <div className={cn(
                'h-16 flex items-center border-b border-border/40 px-4',
                collapsed ? 'justify-center' : 'gap-3'
            )}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-white overflow-hidden">
                    <img src="/saxis-icon.png" alt="Saxis Logo" className="w-full h-full object-cover" />
                </div>
                {!collapsed && (
                    <div className="animate-fade-in">
                        <h1 className="text-base font-bold font-heading text-accent tracking-tight leading-none">SWAT4</h1>
                        <p className="text-[10px] text-accent/40 font-medium tracking-wider uppercase">AD Manager</p>
                    </div>
                )}
            </div>

            {/* Toggle button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-accent/40 hover:text-accent hover:border-accent/30 transition-smooth shadow-sm z-10"
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            {/* Nav items */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const active = isActive(item.href);

                    if (!isItemVisible(item)) {
                        return null;
                    }

                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth',
                                collapsed ? 'justify-center' : '',
                                active
                                    ? 'bg-primary/8 text-primary-dark border-l-[3px] border-primary ml-0'
                                    : 'text-accent/60 hover:text-accent hover:bg-surface/80'
                            )}
                            title={collapsed ? t(item.labelKey) : undefined}
                        >
                            <item.icon size={20} className={cn(
                                'flex-shrink-0 transition-smooth',
                                active ? 'text-primary' : 'text-accent/40'
                            )} />
                            {!collapsed && (
                                <span className="animate-fade-in truncate">{t(item.labelKey)}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Language selector */}
            <div className="px-2 pb-2">
                <div className="relative">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className={cn(
                            'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-accent/50 hover:text-accent hover:bg-surface/80 transition-smooth',
                            collapsed ? 'justify-center' : ''
                        )}
                    >
                        <Globe size={18} className="flex-shrink-0" />
                        {!collapsed && (
                            <>
                                <span className="text-xs">{localeFlags[locale]} {localeNames[locale]}</span>
                                <ChevronDown size={12} className={`ml-auto transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                            </>
                        )}
                    </button>

                    {showLangMenu && (
                        <div className={cn(
                            'absolute bottom-full mb-1 rounded-xl bg-white shadow-modal border border-border overflow-hidden animate-fade-in z-30',
                            collapsed ? 'left-full ml-2 bottom-0' : 'left-0 right-0'
                        )}>
                            {(Object.keys(localeNames) as Array<keyof typeof localeNames>).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => { setLocale(l); setShowLangMenu(false); }}
                                    className={cn(
                                        'w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-surface transition-smooth',
                                        locale === l ? 'bg-primary/5 text-primary-dark font-semibold' : 'text-accent/70'
                                    )}
                                >
                                    <span>{localeFlags[l]}</span>
                                    <span>{localeNames[l]}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* User & Logout */}
            <div className={cn(
                'border-t border-border/40 p-3',
                collapsed ? 'flex flex-col items-center gap-2' : ''
            )}>
                {!collapsed && user && (
                    <div className="flex items-center gap-3 px-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary-dark">
                                {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-accent truncate">{user.display_name}</p>
                            <p className="text-[10px] text-accent/40 truncate">{user.username}</p>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-1 w-full">
                    <button
                        onClick={() => setHelpOpen(true)}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-accent/60 hover:text-accent hover:bg-surface/80 transition-smooth w-full',
                            collapsed ? 'justify-center' : ''
                        )}
                        title={collapsed ? t('help.title') : undefined}
                    >
                        <HelpCircle size={18} className="flex-shrink-0" />
                        {!collapsed && <span className="text-xs font-medium">{t('help.title') || 'Ajuda'}</span>}
                    </button>

                    <button
                        onClick={logout}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-600 hover:bg-red-50 transition-smooth w-full',
                            collapsed ? 'justify-center' : ''
                        )}
                        title={collapsed ? t('auth.logout') : undefined}
                    >
                        <LogOut size={18} className="flex-shrink-0" />
                        {!collapsed && <span className="text-xs font-medium">{t('auth.logout')}</span>}
                    </button>
                </div>
            </div>

            <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
        </aside>
    );
}