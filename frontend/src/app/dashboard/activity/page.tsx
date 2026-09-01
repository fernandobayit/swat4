'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { activities as activityApi } from '@/lib/api';
import { Activity, PlusCircle, FileEdit, Trash2, Edit3, ShieldAlert } from 'lucide-react';

export default function ActivityPage() {
    const { t } = useTranslation();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadActivities();
    }, []);

    const loadActivities = async () => {
        setLoading(true);
        try {
            const data = await activityApi.list(100, 0); // Recent 100 entries
            setActivities(data);
        } catch (error) {
            console.error('Failed to load activities', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action.toUpperCase()) {
            case 'CREATE': return <PlusCircle size={20} className="text-emerald-500" />;
            case 'UPDATE': return <Edit3 size={20} className="text-blue-500" />;
            case 'DELETE': return <Trash2 size={20} className="text-red-500" />;
            default: return <FileEdit size={20} className="text-accent/50" />;
        }
    };

    const getActionBadge = (action: string) => {
        switch (action.toUpperCase()) {
            case 'CREATE':
                return <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-xs font-bold tracking-wider">CREATE</span>;
            case 'UPDATE':
                return <span className="px-2.5 py-1 bg-blue-500/10 text-blue-600 rounded-lg text-xs font-bold tracking-wider">UPDATE</span>;
            case 'DELETE':
                return <span className="px-2.5 py-1 bg-red-500/10 text-red-600 rounded-lg text-xs font-bold tracking-wider">DELETE</span>;
            default:
                return <span className="px-2.5 py-1 bg-accent/10 text-accent/60 rounded-lg text-xs font-bold tracking-wider">{action}</span>;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(date);
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-accent tracking-tight flex items-center gap-3">
                        <Activity className="text-primary" size={28} />
                        {(t as any)('nav?.activity') || 'Activity Log'}
                    </h1>
                    <p className="text-accent/60 mt-1">Track changes and audit operations in the SWAT4 system</p>
                </div>
                <button onClick={loadActivities} className="px-5 py-2.5 bg-primary/10 text-primary-dark rounded-xl text-sm font-semibold hover:bg-primary/20 active:scale-95 transition-all">
                    Refresh Log
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-accent/50 text-sm animate-pulse">Loading Activity History...</p>
                </div>
            ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border border-border/40 rounded-3xl bg-white shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4 text-accent/30">
                        <ShieldAlert size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-accent mb-1">No Activity Found</h3>
                    <p className="text-accent/50 text-sm max-w-sm text-center">There are no operational records in the SQLite database yet. Perform actions like creating or deleting users to see them here.</p>
                </div>
            ) : (
                <div className="bg-white border border-border/40 rounded-3xl shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface/50 border-b border-border/50">
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent/50">Timestamp</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent/50">Actor</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent/50">Action</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent/50">Target</th>
                                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-accent/50">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activities.map((act) => (
                                <tr key={act.id} className="border-b border-border/20 hover:bg-surface/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-accent/60 font-medium font-mono">
                                        {formatDate(act.timestamp)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-accent">
                                        {act.username.toUpperCase()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            {getActionIcon(act.action)}
                                            {getActionBadge(act.action)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-accent/50 font-semibold">{act.entity_type}</span>
                                            <span className="text-sm font-bold text-accent">{act.entity_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-accent/80">
                                        {act.details}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
