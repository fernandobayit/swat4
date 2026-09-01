'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTranslation, localeNames, localeFlags } from '@/lib/i18n';
import { Shield, Eye, EyeOff, Globe, ChevronDown } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const { t, locale, setLocale } = useTranslation();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await login(username, password);
            router.push('/dashboard');
        } catch (err: any) {
            if (err.status === 401) {
                setError(t('auth.invalidCredentials'));
            } else if (err.status === 403) {
                setError(t('auth.notAuthorized'));
            } else {
                setError(err.message || t('common.error'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-primary-dark relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-light/5 blur-3xl" />
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
                />
            </div>

            {/* Language selector */}
            <div className="absolute top-6 right-6 z-20">
                <div className="relative">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-smooth backdrop-blur-sm border border-white/10"
                    >
                        <Globe size={16} />
                        <span>{localeFlags[locale]} {localeNames[locale]}</span>
                        <ChevronDown size={14} className={`transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showLangMenu && (
                        <div className="absolute right-0 mt-2 w-44 rounded-xl bg-white shadow-modal border border-border overflow-hidden animate-fade-in">
                            {(Object.keys(localeNames) as Array<keyof typeof localeNames>).map((l) => (
                                <button
                                    key={l}
                                    onClick={() => { setLocale(l); setShowLangMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-surface transition-smooth ${locale === l ? 'bg-primary/5 text-primary-dark font-semibold' : 'text-accent'
                                        }`}
                                >
                                    <span className="text-lg">{localeFlags[l]}</span>
                                    <span>{localeNames[l]}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Login card */}
            <div className="relative z-10 w-full max-w-md mx-4">
                <div className="bg-white rounded-3xl shadow-modal p-8 md:p-10 animate-slide-up">
                    {/* Logo/Brand */}
                    <div className="flex flex-col items-center mb-8">
                        <img src="/saxis-2.png" alt="Saxis Logo" className="h-20 mb-2 object-contain" />
                    </div>

                    {/* Login title */}
                    <div className="text-center mb-6">
                        <h2 className="text-lg font-semibold text-accent">{t('auth.loginTitle')}</h2>
                        <p className="text-sm text-accent/50 mt-1">{t('auth.loginSubtitle')}</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm animate-fade-in">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-accent/70 mb-1.5">
                                {t('auth.username')}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-border bg-surface/50 text-accent placeholder:text-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-smooth text-sm"
                                placeholder="administrator"
                                required
                                autoFocus
                                autoComplete="username"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-accent/70 mb-1.5">
                                {t('auth.password')}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 rounded-xl border border-border bg-surface/50 text-accent placeholder:text-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-smooth text-sm"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-accent/30 hover:text-accent/60 transition-smooth"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !username || !password}
                            className="w-full py-3 px-4 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-smooth mt-2 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('common.loading')}
                                </>
                            ) : (
                                t('auth.login')
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 text-center">
                        <p className="text-xs text-accent/30">
                            Samba 4 Active Directory • LDAP Authentication
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
