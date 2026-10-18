'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { shares as sharesApi } from '@/lib/api';
import { Plus, Pencil, Trash2, Search, HardDrive, X, FolderPlus, Folder, FolderMinus } from 'lucide-react';
import type { Share } from '@/lib/types';

interface ShareFolderRow {
    folder: string;
    created_by: string;
    created_at: string;
}

export default function SharesPage() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isDomainAdmin = (user?.groups || []).includes('Domain Admins');

    const [shareList, setShareList] = useState<Share[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '', path: '', comment: '', veto_files: '', write_list: '',
    });
    const [editingShare, setEditingShare] = useState<Share | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Subpastas por compartilhamento
    const [foldersShare, setFoldersShare] = useState<string | null>(null);
    const [foldersList, setFoldersList] = useState<ShareFolderRow[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [newFolder, setNewFolder] = useState('');
    const [folderError, setFolderError] = useState('');
    const [folderSaving, setFolderSaving] = useState(false);
    const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

    useEffect(() => { loadShares(); }, []);

    const loadShares = async (background = false) => {
        try { if (!background) setLoading(true); setShareList(await sharesApi.list()); }
        catch (e) { console.error(e); }
        finally { if (!background) setLoading(false); }
    };

    const filtered = shareList.filter((s) =>
        !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.path?.toLowerCase().includes(search.toLowerCase()) ||
        s.comment?.toLowerCase().includes(search.toLowerCase())
    );

    const openFolders = async (shareName: string) => {
        setFoldersShare(shareName);
        setFoldersLoading(true);
        setFolderError('');
        setNewFolder('');
        try {
            setFoldersList(await sharesApi.folders(shareName));
        } catch (e: any) {
            setFolderError(e.message || 'Error');
            setFoldersList([]);
        } finally {
            setFoldersLoading(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!foldersShare || !newFolder.trim()) return;
        setFolderSaving(true); setFolderError('');
        try {
            await sharesApi.createFolder(foldersShare, newFolder.trim());
            setNewFolder('');
            setFoldersList(await sharesApi.folders(foldersShare));
        } catch (e: any) {
            setFolderError(e.message || 'Error');
        } finally {
            setFolderSaving(false);
        }
    };

    const handleDeleteFolder = async (folder: string) => {
        if (!foldersShare) return;
        if (deletingFolder !== folder) {
            setDeletingFolder(folder);
            setTimeout(() => setDeletingFolder(null), 3000);
            return;
        }
        try {
            await sharesApi.deleteFolder(foldersShare, folder);
            setDeletingFolder(null);
            setFoldersList(await sharesApi.folders(foldersShare));
        } catch (e: any) {
            setFolderError(e.message || 'Error');
        }
    };

    const handleEdit = (share: Share) => {
        setEditingShare(share);
        setFormData({
            name: share.name,
            path: share.path || '',
            comment: share.comment || '',
            veto_files: share.veto_files || '',
            write_list: share.write_list || '',
        });
        setShowCreateForm(true);
    };

    const handleSave = async () => {
        setSaving(true); setError('');
        try {
            if (editingShare) {
                await sharesApi.update(editingShare.name, formData);
            } else {
                await sharesApi.create(formData);
            }
            await loadShares(true);
            setShowCreateForm(false);
            setEditingShare(null);
            setFormData({ name: '', path: '', comment: '', veto_files: '', write_list: '' });
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const [deletingShare, setDeletingShare] = useState<string | null>(null);

    const handleDelete = async (name: string) => {
        if (deletingShare !== name) {
            setDeletingShare(name);
            setTimeout(() => setDeletingShare(null), 3000);
            return;
        }
        try { await sharesApi.delete(name); await loadShares(true); setDeletingShare(null); }
        catch (e: any) { setError(e.message); }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold font-heading text-accent">{t('shares.title')}</h1>
                {isDomainAdmin && (
                    <button onClick={() => {
                        setEditingShare(null);
                        setFormData({ name: '', path: '', comment: '', veto_files: '', write_list: '' });
                        setShowCreateForm(true);
                    }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 transition-smooth shadow-sm">
                        <Plus size={16} /> {t('shares.addShare')}
                    </button>
                )}
            </div>

            {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center animate-fade-in">
                    <span>{error}</span>
                    <button onClick={() => setError('')}><X size={14} /></button>
                </div>
            )}

            <div className="mb-4 relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent/30" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-smooth"
                    placeholder={t('common.search') + '...'} />
            </div>

            <div className="bg-white rounded-2xl border border-border/40 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border/30 bg-surface/30">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('shares.shareName')}</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('common.path')}</th>
                                <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('shares.comment')}</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="border-b border-border/10">
                                        {Array.from({ length: 4 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-surface rounded animate-pulse" /></td>
                                        ))}
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-accent/40">{t('common.noData')}</td></tr>
                            ) : (
                                filtered.map((share) => (
                                    <tr key={share.name} className="border-b border-border/10 hover:bg-surface/30 transition-smooth group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-violet-500/8 flex items-center justify-center flex-shrink-0">
                                                    <HardDrive size={14} className="text-violet-600" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-accent">{share.name}</span>
                                                    <div className="flex items-center gap-1 mt-0.5">
                                                        <button onClick={() => share.name === foldersShare ? setFoldersShare(null) : openFolders(share.name)}
                                                            title={t('shares.folders')}
                                                            className="text-[11px] text-primary hover:underline flex items-center gap-1">
                                                            <Folder size={11} /> {t('shares.folders')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-accent/50 font-mono text-xs">{share.path || '—'}</td>
                                        <td className="px-4 py-3 text-sm text-accent/50">{share.comment || '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {isDomainAdmin && (
                                                    <>
                                                        <button onClick={() => handleEdit(share)} title={t('common.edit')}
                                                            className="p-1.5 rounded-lg hover:bg-surface transition-smooth text-accent/40 hover:text-blue-500">
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button onClick={() => handleDelete(share.name)} title={t('common.delete')}
                                                            className={deletingShare === share.name
                                                                ? "p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-smooth"
                                                                : "p-1.5 rounded-lg hover:bg-red-50 transition-smooth text-accent/40 hover:text-red-500"}>
                                                            {deletingShare === share.name
                                                                ? <span className="text-[10px] font-bold px-1">Confirmar?</span>
                                                                : <Trash2 size={15} />}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 py-2.5 border-t border-border/20 bg-surface/20">
                    <p className="text-[11px] text-accent/40">{filtered.length} {t('nav.shares').toLowerCase()}</p>
                </div>
            </div>

            {/* Folders Panel */}
            {foldersShare && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setFoldersShare(null)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 animate-slide-up mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <FolderPlus size={18} className="text-primary" />
                                <h2 className="text-lg font-semibold text-accent">{t('shares.folders')}: {foldersShare}</h2>
                            </div>
                            <button onClick={() => setFoldersShare(null)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>

                        {folderError && (
                            <div className="mb-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center">
                                <span>{folderError}</span>
                                <button onClick={() => setFolderError('')}><X size={14} /></button>
                            </div>
                        )}

                        <div className="flex gap-2 mb-4">
                            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)}
                                placeholder={t('shares.newFolder')}
                                className="flex-1 px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            <button onClick={handleCreateFolder} disabled={folderSaving || !newFolder.trim()}
                                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark active:scale-95 disabled:opacity-50 transition-smooth flex items-center gap-1.5">
                                <FolderPlus size={14} /> {folderSaving ? t('common.loading') : t('shares.addFolder')}
                            </button>
                        </div>

                        {foldersLoading ? (
                            <div className="py-8 flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : foldersList.length === 0 ? (
                            <p className="py-6 text-center text-sm text-accent/40">{t('shares.noFolders')}</p>
                        ) : (
                            <div className="space-y-1.5">
                                {foldersList.map((row) => (
                                    <div key={row.folder} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border/30 hover:bg-surface/30 transition-smooth">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Folder size={15} className="text-violet-600 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-accent truncate">{row.folder}</p>
                                                <p className="text-[10px] text-accent/40">{row.created_by} · {row.created_at}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteFolder(row.folder)} title={t('common.delete')}
                                            className={deletingFolder === row.folder
                                                ? "p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-smooth"
                                                : "p-1.5 rounded-lg hover:bg-red-50 transition-smooth text-accent/40 hover:text-red-500"}>
                                            {deletingFolder === row.folder
                                                ? <span className="text-[10px] font-bold px-1">Confirmar?</span>
                                                : <FolderMinus size={15} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <p className="mt-3 text-[11px] text-accent/40">{t('shares.foldersHint')}</p>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal (Domain Admins only) */}
            {showCreateForm && isDomainAdmin && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowCreateForm(false)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 animate-slide-up mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-accent">{editingShare ? t('shares.editShare') : t('shares.addShare')}</h2>
                            <button onClick={() => setShowCreateForm(false)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('shares.shareName')} *</label>
                                <input value={formData.name} disabled={!!editingShare} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('shares.comment')}</label>
                                <input value={formData.comment} onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">Veto Files</label>
                                <input value={formData.veto_files} onChange={(e) => setFormData({ ...formData, veto_files: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" placeholder="/*.exe/*.bat/" />
                            </div>

                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowCreateForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-accent/60 hover:bg-surface transition-smooth">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleSave} disabled={saving || (!editingShare && !formData.name)}
                                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 disabled:opacity-50 transition-smooth">
                                {saving ? t('common.loading') : t('common.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
