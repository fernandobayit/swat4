'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { users as usersApi, bulk as bulkApi } from '@/lib/api';
import OUTree from '@/components/ou-tree';
import { Plus, Pencil, Trash2, Search, UserCheck, UserX, X, FileUp } from 'lucide-react';
import type { User } from '@/lib/types';
import { cn } from '@/lib/utils';

const generateAutoUsername = (firstName: string, lastName: string) => {
    const f = firstName.trim().split(/\s+/)[0] || '';
    const l = lastName.trim().split(/\s+/).pop() || '';

    const cleanF = f.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const cleanL = l.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

    if (cleanF && cleanL) return `${cleanF}.${cleanL}`;
    return cleanF || cleanL;
};

export default function UsersPage() {
    const { t } = useTranslation();
    const [userList, setUserList] = useState<User[]>([]);
    const [selectedOU, setSelectedOU] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({ username: '', password: '', givenName: '', sn: '', email: '', ou: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [fileOptions, setFileOptions] = useState<File | null>(null);
    const [isUsernameEdited, setIsUsernameEdited] = useState(false); // Track if user manually changed it

    useEffect(() => { loadUsers(); }, [selectedOU]);

    const loadUsers = async (background = false) => {
        try {
            if (!background) setLoading(true);
            const data = await usersApi.list(selectedOU || undefined);
            setUserList(data);
        } catch (e) { console.error(e); }
        finally { if (!background) setLoading(false); }
    };

    const filtered = userList.filter((u) =>
        !search || u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async () => {
        setSaving(true); setError('');
        try {
            await usersApi.create(formData);
            await loadUsers(true);
            setShowCreateForm(false);
            setFormData({ username: '', password: '', givenName: '', sn: '', email: '', ou: '' });
            setIsUsernameEdited(false);
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const [deletingUser, setDeletingUser] = useState<string | null>(null);

    const handleDelete = async (username: string) => {
        if (deletingUser !== username) {
            setDeletingUser(username);
            setTimeout(() => setDeletingUser(null), 3000); // auto-cancel after 3s
            return;
        }
        try {
            await usersApi.delete(username);
            await loadUsers(true);
            setDeletingUser(null);
        } catch (e: any) { setError(e.message); }
    };

    const handleToggleEnable = async (user: User) => {
        try {
            await usersApi.update(user.username, { enabled: !user.enabled });
            await loadUsers(true);
        } catch (e: any) { setError(e.message); }
    };

    const [editFormData, setEditFormData] = useState({ givenName: '', sn: '', displayName: '', email: '', password: '' });

    const openEditModal = (user: User) => {
        setEditFormData({
            givenName: user.given_name || '',
            sn: user.surname || '',
            displayName: user.display_name || '',
            email: user.email || '',
            password: '',
        });
        setEditingUser(user);
    };

    const handleUpdate = async () => {
        if (!editingUser) return;
        setSaving(true); setError('');
        try {
            const data: any = {};
            if (editFormData.givenName) data.givenName = editFormData.givenName;
            if (editFormData.sn) data.sn = editFormData.sn;
            if (editFormData.displayName) data.displayName = editFormData.displayName;
            if (editFormData.email) data.email = editFormData.email;
            if (editFormData.password) data.password = editFormData.password;
            await usersApi.update(editingUser.username, data);
            await loadUsers(true);
            setEditingUser(null);
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold font-heading text-accent">{t('users.title')}</h1>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowBulkForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-surface text-accent rounded-xl text-sm font-semibold hover:bg-surface/80 active:scale-95 transition-smooth shadow-sm border border-border/40">
                        <FileUp size={16} /> {t('common.bulkImport')}
                    </button>
                    <button onClick={() => {
                        setShowCreateForm(true);
                        setFormData({ username: '', password: '', givenName: '', sn: '', email: '', ou: '' });
                        setIsUsernameEdited(false);
                    }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 transition-smooth shadow-sm">
                        <Plus size={16} /> {t('users.addUser')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center animate-fade-in">
                    <span>{error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}

            <div className="flex gap-5">
                {/* OU Tree */}
                <div className="w-[280px] flex-shrink-0">
                    <OUTree onSelect={setSelectedOU} selectedOU={selectedOU} />
                </div>

                {/* Users List */}
                <div className="flex-1 min-w-0">
                    {/* Search */}
                    <div className="mb-4 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent/30" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-smooth"
                            placeholder={t('common.search') + '...'} />
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-border/40 shadow-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-border/30 bg-surface/30">
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('users.username')}</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('users.displayName')}</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('users.email')}</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('common.status')}</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-border/10">
                                                {Array.from({ length: 5 }).map((_, j) => (
                                                    <td key={j} className="px-4 py-3"><div className="h-4 bg-surface rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-accent/40">{t('common.noData')}</td></tr>
                                    ) : (
                                        filtered.map((user) => (
                                            <tr key={user.dn} className="border-b border-border/10 hover:bg-surface/30 transition-smooth">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-[10px] font-bold text-primary-dark">{user.username.charAt(0).toUpperCase()}</span>
                                                        </div>
                                                        <span className="text-sm font-medium text-accent">{user.username}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-accent/70">{user.display_name || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-accent/50">{user.email || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold',
                                                        user.enabled ? 'bg-primary/8 text-primary-dark' : 'bg-red-50 text-red-500')}>
                                                        <span className={cn('w-1.5 h-1.5 rounded-full', user.enabled ? 'bg-primary' : 'bg-red-400')} />
                                                        {user.enabled ? t('common.enabled') : t('common.disabled')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => handleToggleEnable(user)} title={user.enabled ? t('users.disableAccount') : t('users.enableAccount')}
                                                            className="p-1.5 rounded-lg hover:bg-surface transition-smooth text-accent/40 hover:text-accent">
                                                            {user.enabled ? <UserX size={15} /> : <UserCheck size={15} />}
                                                        </button>
                                                        <button onClick={() => openEditModal(user)} title={t('common.edit')}
                                                            className="p-1.5 rounded-lg hover:bg-surface transition-smooth text-accent/40 hover:text-blue-500">
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button onClick={() => handleDelete(user.username)} title={t('common.delete')}
                                                            className={cn("p-1.5 rounded-lg transition-smooth",
                                                                deletingUser === user.username
                                                                    ? "bg-red-500 text-white hover:bg-red-600"
                                                                    : "hover:bg-red-50 text-accent/40 hover:text-red-500")}>
                                                            {deletingUser === user.username
                                                                ? <span className="text-[10px] font-bold px-1">Confirmar?</span>
                                                                : <Trash2 size={15} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-2.5 border-t border-border/20 bg-surface/20">
                            <p className="text-[11px] text-accent/40">{filtered.length} {t('nav.users').toLowerCase()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowCreateForm(false)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 animate-slide-up mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-accent">{t('users.addUser')}</h2>
                            <button onClick={() => setShowCreateForm(false)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.firstName')}</label>
                                    <input value={formData.givenName} onChange={(e) => {
                                        const newGivenName = e.target.value;
                                        const newFormData = { ...formData, givenName: newGivenName };
                                        if (!isUsernameEdited) {
                                            newFormData.username = generateAutoUsername(newFormData.givenName, newFormData.sn);
                                        }
                                        setFormData(newFormData);
                                    }}
                                        className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.lastName')}</label>
                                    <input value={formData.sn} onChange={(e) => {
                                        const newSn = e.target.value;
                                        const newFormData = { ...formData, sn: newSn };
                                        if (!isUsernameEdited) {
                                            newFormData.username = generateAutoUsername(newFormData.givenName, newFormData.sn);
                                        }
                                        setFormData(newFormData);
                                    }}
                                        className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.username')} *</label>
                                <input value={formData.username}
                                    onChange={(e) => {
                                        setIsUsernameEdited(true);
                                        setFormData({ ...formData, username: e.target.value });
                                    }}
                                    onFocus={() => {
                                        if (!isUsernameEdited && formData.username) {
                                            setIsUsernameEdited(true);
                                            setFormData({ ...formData, username: '' });
                                        }
                                    }}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.email')}</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.password')} *</label>
                                <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowCreateForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-accent/60 hover:bg-surface transition-smooth">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleCreate} disabled={saving || !formData.username || !formData.password}
                                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 disabled:opacity-50 transition-smooth">
                                {saving ? t('common.loading') : t('common.create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingUser && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setEditingUser(null)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 animate-slide-up mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-accent">{t('common.edit')}: {editingUser.username}</h2>
                            <button onClick={() => setEditingUser(null)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.firstName')}</label>
                                    <input value={editFormData.givenName} onChange={(e) => setEditFormData({ ...editFormData, givenName: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.lastName')}</label>
                                    <input value={editFormData.sn} onChange={(e) => setEditFormData({ ...editFormData, sn: e.target.value })}
                                        className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.displayName')}</label>
                                <input value={editFormData.displayName} onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.email')}</label>
                                <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('users.password')} <span className="text-accent/30">({t('common.optional')})</span></label>
                                <input type="password" value={editFormData.password} onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Deixe vazio para manter a senha atual" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-accent/60 hover:bg-surface transition-smooth">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleUpdate} disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 disabled:opacity-50 transition-smooth">
                                {saving ? t('common.loading') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {showBulkForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowBulkForm(false)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 animate-slide-up mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-accent">{t('common.bulkImport')}</h2>
                            <button onClick={() => setShowBulkForm(false)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-accent/60">
                                Upload a CSV file with the following headers:<br />
                                <code className="block mt-2 bg-surface text-accent p-2 rounded text-xs">username, password, givenName, surname, email, ou</code>
                            </p>
                            <div>
                                <input type="file" accept=".csv" onChange={(e) => setFileOptions(e.target.files ? e.target.files[0] : null)}
                                    className="w-full text-sm text-accent/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary-dark hover:file:bg-primary/20 transition-all border border-border/40 rounded-xl p-2" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowBulkForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-accent/60 hover:bg-surface transition-smooth">
                                {t('common.cancel')}
                            </button>
                            <button onClick={async () => {
                                if (!fileOptions) return;
                                setSaving(true); setError('');
                                try {
                                    const result = await bulkApi.users(fileOptions);
                                    await loadUsers(true);
                                    alert(result.message);
                                    setShowBulkForm(false);
                                    setFileOptions(null);
                                } catch (e: any) { setError(e.message); }
                                finally { setSaving(false); }
                            }} disabled={saving || !fileOptions}
                                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 disabled:opacity-50 transition-smooth">
                                {saving ? t('common.loading') : t('common.uploadCSV')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
