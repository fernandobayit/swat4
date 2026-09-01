'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { domain as domainApi } from '@/lib/api';
import { ShieldAlert, Save, X } from 'lucide-react';

export default function SettingsPage() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [policy, setPolicy] = useState({
        complexity_enabled: true,
        store_plaintext: false,
        history_length: 24,
        min_pwd_length: 7,
        min_pwd_age_days: 1,
        max_pwd_age_days: 42,
        lockout_duration_mins: 30,
        lockout_threshold: 0,
        reset_lockout_after_mins: 30
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await domainApi.getPasswordPolicy();
            setPolicy(data);
        } catch (e: any) {
            setError(e.message || 'Error loading settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await domainApi.updatePasswordPolicy(policy);
            setSuccess(t('common.success') || 'Settings saved');
        } catch (e: any) {
            setError(e.message || 'Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="animate-fade-in space-y-4">
                <div className="h-8 w-48 bg-surface rounded-lg animate-pulse"></div>
                <div className="h-64 bg-surface rounded-2xl animate-pulse"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-4xl">
            <div className="mb-6">
                <h1 className="text-xl font-bold font-heading text-accent">{(t as any)('settings.title') || 'Global Settings'}</h1>
                <p className="text-sm text-accent/60 mt-1">{t('settings.subtitle')}</p>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center">
                    <span className="flex items-center gap-2"><ShieldAlert size={16} /> {error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}

            {success && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex justify-between items-center">
                    <span>{success}</span>
                    <button onClick={() => setSuccess('')}><X size={14} /></button>
                </div>
            )}

            <form onSubmit={handleSave} className="bg-white rounded-2xl border border-border/40 shadow-card overflow-hidden">
                <div className="p-6 border-b border-border/20">
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ShieldAlert size={16} className="text-primary-dark" />
                        </div>
                        <h2 className="text-lg font-semibold text-accent">{(t as any)('settings.passwordPolicy') || 'Password Policies'}</h2>
                    </div>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Complexity */}
                    <div className="flex items-center justify-between col-span-1 md:col-span-2 p-4 bg-surface/30 rounded-xl border border-border/40">
                        <div>
                            <p className="font-medium text-sm text-accent">{(t as any)('settings.complexity') || 'Require Password Complexity'}</p>
                            <p className="text-xs text-accent/50 mt-1">{t('settings.complexitySubtitle')}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={policy.complexity_enabled}
                                onChange={(e) => setPolicy({ ...policy, complexity_enabled: e.target.checked })} />
                            <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border/40 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-sm border border-border/40"></div>
                        </label>
                    </div>

                    {/* Min Length */}
                    <div>
                        <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.minPwdLength') || 'Minimum Password Length'}</label>
                        <input type="number" min="0" max="14" value={policy.min_pwd_length}
                            onChange={(e) => setPolicy({ ...policy, min_pwd_length: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    {/* History */}
                    <div>
                        <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.historyLength') || 'Password History Length'}</label>
                        <input type="number" min="0" max="24" value={policy.history_length}
                            onChange={(e) => setPolicy({ ...policy, history_length: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    {/* Min Age */}
                    <div>
                        <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.minPwdAge') || 'Minimum Password Age (Days)'}</label>
                        <input type="number" min="0" max="998" value={policy.min_pwd_age_days}
                            onChange={(e) => setPolicy({ ...policy, min_pwd_age_days: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    {/* Max Age */}
                    <div>
                        <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.maxPwdAge') || 'Maximum Password Age (Days)'}</label>
                        <input type="number" min="0" max="999" value={policy.max_pwd_age_days}
                            onChange={(e) => setPolicy({ ...policy, max_pwd_age_days: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    </div>

                    <div className="col-span-1 md:col-span-2 border-t border-border/20 pt-6 mt-2">
                        <h3 className="text-sm font-semibold text-accent mb-4">Account Lockout Policy</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Lockout Threshold */}
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.lockoutThreshold') || 'Lockout Threshold'}</label>
                                <input type="number" min="0" max="999" value={policy.lockout_threshold}
                                    onChange={(e) => setPolicy({ ...policy, lockout_threshold: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                <p className="text-[10px] text-accent/40 mt-1">{t('settings.neverLockout')}</p>
                            </div>

                            {/* Lockout Duration */}
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.lockoutDuration') || 'Lockout Duration (Mins)'}</label>
                                <input type="number" min="0" max="99999" value={policy.lockout_duration_mins}
                                    onChange={(e) => setPolicy({ ...policy, lockout_duration_mins: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>

                            {/* Reset after */}
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-2">{(t as any)('settings.resetLockout') || 'Reset Lockout After (Mins)'}</label>
                                <input type="number" min="0" max="99999" value={policy.reset_lockout_after_mins}
                                    onChange={(e) => setPolicy({ ...policy, reset_lockout_after_mins: parseInt(e.target.value) || 0 })}
                                    className="w-full px-4 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-surface/20 border-t border-border/20 flex justify-end">
                    <button type="submit" disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 disabled:opacity-50 transition-all shadow-sm">
                        <Save size={16} /> {saving ? t('common.loading') : t('common.save')}
                    </button>
                </div>
            </form>
        </div>
    );
}