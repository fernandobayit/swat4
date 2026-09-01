'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { groups as groupsApi, users as usersApi, bulk as bulkApi } from '@/lib/api';
import OUTree from '@/components/ou-tree';
import { Plus, Pencil, Trash2, Search, Users, X, UserPlus, UserMinus, FileUp } from 'lucide-react';
import type { Group, User } from '@/lib/types';

export default function GroupsPage() {
    const { t } = useTranslation();
    const [groupList, setGroupList] = useState<Group[]>([]);
    const [selectedOU, setSelectedOU] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '', ou: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showBulkForm, setShowBulkForm] = useState(false);
    const [fileOptions, setFileOptions] = useState<File | null>(null);

    useEffect(() => { loadGroups(); }, [selectedOU]);

    const loadGroups = async (background = false) => {
        try {
            if (!background) setLoading(true);
            const data = await groupsApi.list(selectedOU || undefined);
            setGroupList(data);
        } catch (e) { console.error(e); }
        finally { if (!background) setLoading(false); }
    };

    const filtered = groupList.filter((g) =>
        !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async () => {
        setSaving(true); setError('');
        try {
            await groupsApi.create({ ...formData, group_type: 'Security' });
            await loadGroups(true);
            setShowCreateForm(false); setFormData({ name: '', description: '', ou: '' });
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const [deletingGroup, setDeletingGroup] = useState<string | null>(null);

    const handleDelete = async (name: string) => {
        if (deletingGroup !== name) {
            setDeletingGroup(name);
            setTimeout(() => setDeletingGroup(null), 3000);
            return;
        }
        try {
            await groupsApi.delete(name);
            await loadGroups(true);
            setDeletingGroup(null);
        } catch (e: any) { setError(e.message); }
    };

    // ── Edit Group Modal State ──
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [editDescription, setEditDescription] = useState('');
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberError, setMemberError] = useState('');

    // Extract CN from a DN like "CN=john.doe,CN=Users,DC=swat,DC=local"
    const extractCN = (dn: string) => {
        const match = dn.match(/^CN=([^,]+)/i);
        return match ? match[1] : dn;
    };

    const openEditGroupModal = async (group: Group) => {
        setEditDescription(group.description || '');
        setMemberSearch('');
        setMemberError('');
        setEditingGroup(group);
        // Load all users for autocomplete
        try {
            const userList = await usersApi.list();
            setAllUsers(userList);
        } catch (e) { console.error(e); }
    };

    const handleUpdateGroup = async () => {
        if (!editingGroup) return;
        setSaving(true); setError('');
        try {
            await groupsApi.update(editingGroup.name, { description: editDescription });
            await loadGroups(true);
            setEditingGroup(null);
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    const handleAddMember = async (username: string) => {
        if (!editingGroup) return;
        setMemberError('');
        try {
            await groupsApi.addMembers(editingGroup.name, [username]);
            // Refresh the group data to get updated members
            const updatedGroup = await groupsApi.get(editingGroup.name);
            setEditingGroup(updatedGroup);
            setMemberSearch('');
            loadGroups(true);
        } catch (e: any) { setMemberError(e.message); }
    };

    const handleRemoveMember = async (memberDN: string) => {
        if (!editingGroup) return;
        setMemberError('');
        const username = extractCN(memberDN);
        try {
            await groupsApi.removeMembers(editingGroup.name, [username]);
            const updatedGroup = await groupsApi.get(editingGroup.name);
            setEditingGroup(updatedGroup);
            loadGroups(true);
        } catch (e: any) { setMemberError(e.message); }
    };

    // Filter available users: those not already in this group
    const currentMemberCNs = editingGroup?.members?.map(extractCN) || [];
    const availableUsers = allUsers.filter(u =>
        !currentMemberCNs.includes(u.username) &&
        (memberSearch ? u.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
            (u.display_name || '').toLowerCase().includes(memberSearch.toLowerCase()) : false)
    );

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold font-heading text-accent">{t('groups.title')}</h1>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowBulkForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-surface text-accent rounded-xl text-sm font-semibold hover:bg-surface/80 active:scale-95 transition-smooth shadow-sm border border-border/40">
                        <FileUp size={16} /> {t('common.bulkImport')}
                    </button>
                    <button onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 transition-smooth shadow-sm">
                        <Plus size={16} /> {t('groups.addGroup')}
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
                <div className="w-[280px] flex-shrink-0">
                    <OUTree onSelect={setSelectedOU} selectedOU={selectedOU} />
                </div>

                <div className="flex-1 min-w-0">
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
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('groups.groupName')}</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('common.description')}</th>
                                        <th className="text-left px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('groups.memberCount')}</th>
                                        <th className="text-right px-4 py-3 text-[11px] font-semibold text-accent/50 uppercase tracking-wider">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <tr key={i} className="border-b border-border/10">
                                                {Array.from({ length: 4 }).map((_, j) => (
                                                    <td key={j} className="px-4 py-3"><div className="h-4 bg-surface rounded animate-pulse" /></td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-accent/40">{t('common.noData')}</td></tr>
                                    ) : (
                                        filtered.map((group) => (
                                            <tr key={group.dn} className="border-b border-border/10 hover:bg-surface/30 transition-smooth">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/8 flex items-center justify-center flex-shrink-0">
                                                            <Users size={14} className="text-emerald-600" />
                                                        </div>
                                                        <span className="text-sm font-medium text-accent">{group.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-accent/50">{group.description || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-surface text-accent/60">
                                                        <Users size={12} /> {group.member_count}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button onClick={() => openEditGroupModal(group)} title={t('common.edit')}
                                                            className="p-1.5 rounded-lg hover:bg-surface transition-smooth text-accent/40 hover:text-blue-500">
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button onClick={() => handleDelete(group.name)} title={t('common.delete')}
                                                            className={deletingGroup === group.name
                                                                ? "p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-smooth"
                                                                : "p-1.5 rounded-lg hover:bg-red-50 transition-smooth text-accent/40 hover:text-red-500"}>
                                                            {deletingGroup === group.name
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
                            <p className="text-[11px] text-accent/40">{filtered.length} {t('nav.groups').toLowerCase()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateForm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowCreateForm(false)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 animate-slide-up mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-accent">{t('groups.addGroup')}</h2>
                            <button onClick={() => setShowCreateForm(false)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('groups.groupName')} *</label>
                                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" required />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-accent/60 mb-1">{t('common.description')}</label>
                                <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowCreateForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-accent/60 hover:bg-surface transition-smooth">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleCreate} disabled={saving || !formData.name}
                                className="flex-1 px-4 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent-light active:scale-95 disabled:opacity-50 transition-smooth">
                                {saving ? t('common.loading') : t('common.create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingGroup && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in" onClick={() => setEditingGroup(null)}>
                    <div className="bg-white rounded-2xl shadow-modal w-full max-w-xl p-6 animate-slide-up mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-lg font-semibold text-accent">{t('common.edit')}: {editingGroup.name}</h2>
                            <button onClick={() => setEditingGroup(null)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth"><X size={18} /></button>
                        </div>

                        {memberError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex justify-between items-center animate-fade-in">
                                <span>{memberError}</span>
                                <button onClick={() => setMemberError('')}><X size={14} /></button>
                            </div>
                        )}

                        {/* Description */}
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-accent/60 mb-1">{t('common.description')}</label>
                            <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                                className="w-full px-3 py-2.5 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                        </div>

                        {/* Members Section */}
                        <div className="border-t border-border/20 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-accent flex items-center gap-2">
                                    <Users size={16} className="text-emerald-600" />
                                    {t('groups.members')} ({editingGroup.members?.length || 0})
                                </h3>
                            </div>

                            {/* Add Member Search */}
                            <div className="relative mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/30" />
                                        <input
                                            type="text"
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                            placeholder={t('groups.addMemberPlaceholder')}
                                        />
                                    </div>
                                </div>

                                {/* Autocomplete Dropdown */}
                                {memberSearch && availableUsers.length > 0 && (
                                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border/40 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                        {availableUsers.slice(0, 8).map((user) => (
                                            <button
                                                key={user.username}
                                                onClick={() => handleAddMember(user.username)}
                                                className="w-full text-left px-4 py-2 hover:bg-surface/50 transition-smooth flex items-center gap-3 text-sm"
                                            >
                                                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary uppercase flex-shrink-0">
                                                    {user.username[0]}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-accent truncate">{user.username}</div>
                                                    {user.display_name && <div className="text-[11px] text-accent/40 truncate">{user.display_name}</div>}
                                                </div>
                                                <UserPlus size={14} className="ml-auto text-emerald-500 flex-shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {memberSearch && availableUsers.length === 0 && (
                                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-border/40 rounded-xl shadow-lg p-3 text-sm text-accent/40 text-center">
                                        {t('groups.noUsersFound')}
                                    </div>
                                )}
                            </div>

                            {/* Current Members List */}
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                                {(!editingGroup.members || editingGroup.members.length === 0) ? (
                                    <p className="text-sm text-accent/40 text-center py-4">{t('groups.noMembers')}</p>
                                ) : (
                                    editingGroup.members.map((memberDN) => {
                                        const cn = extractCN(memberDN);
                                        return (
                                            <div key={memberDN} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-surface/40 transition-smooth group">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-600 uppercase flex-shrink-0">
                                                        {cn[0]}
                                                    </div>
                                                    <span className="text-sm text-accent truncate">{cn}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveMember(memberDN)}
                                                    title={t('groups.removeMember')}
                                                    className="p-1 rounded-lg hover:bg-red-50 transition-smooth text-accent/30 hover:text-red-500"
                                                >
                                                    <UserMinus size={14} />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6 pt-4 border-t border-border/20">
                            <button onClick={() => setEditingGroup(null)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm text-accent/60 hover:bg-surface transition-smooth">
                                {t('common.cancel')}
                            </button>
                            <button onClick={handleUpdateGroup} disabled={saving}
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
                                <code className="block mt-2 bg-surface text-accent p-2 rounded text-xs">name, description, ou, groupType</code>
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
                                    const result = await bulkApi.groups(fileOptions);
                                    await loadGroups(true);
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
