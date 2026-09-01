'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dns as dnsApi } from '@/lib/api';
import { ArrowLeft, Plus, Search, Trash2, Globe, Activity, Pencil, X } from 'lucide-react';

export default function DnsZonePage({ params }: { params: { zoneName: string } }) {
    const { zoneName } = params;
    const router = useRouter();

    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [newRecord, setNewRecord] = useState({ name: '', type: 'A', data: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editRecord, setEditRecord] = useState<{ name: string, type: string, old_data: string, new_data: string } | null>(null);

    useEffect(() => {
        loadRecords();
    }, [zoneName]);

    const loadRecords = async () => {
        setLoading(true);
        try {
            const data = await dnsApi.listRecords(zoneName);
            setRecords(data);
        } catch (error) {
            console.error('Failed to load DNS records', error);
            alert('Failed to load DNS records for zone ' + zoneName);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (record: any) => {
        if (!confirm(`Are you sure you want to delete the ${record.type} record for ${record.name}?`)) return;

        try {
            await dnsApi.deleteRecord(zoneName, record.name, record.type, record.data);
            await loadRecords();
        } catch (error: any) {
            alert('Failed to delete record: ' + error.message);
        }
    };

    const handleAddRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await dnsApi.addRecord(zoneName, newRecord);
            setIsAddModalOpen(false);
            setNewRecord({ name: '', type: 'A', data: '' });
            await loadRecords();
        } catch (error: any) {
            alert('Failed to add record: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editRecord) return;
        setIsSubmitting(true);
        try {
            await dnsApi.updateRecord(zoneName, editRecord.name, editRecord.type, {
                old_data: editRecord.old_data,
                new_data: editRecord.new_data
            });
            setIsEditModalOpen(false);
            setEditRecord(null);
            await loadRecords();
        } catch (error: any) {
            alert('Failed to update record: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredRecords = records.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.data.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const recordTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'SRV', 'MX', 'PTR'];

    return (
        <div className="animate-fade-in">
            <button
                onClick={() => router.push('/dashboard/dns')}
                className="flex items-center text-accent/60 hover:text-primary mb-6 transition-colors text-sm font-medium"
            >
                <ArrowLeft size={16} className="mr-1" />
                Back to Zones
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-accent tracking-tight flex items-center gap-3">
                        <Globe className="text-primary" size={28} />
                        {zoneName}
                    </h1>
                    <p className="text-accent/60 mt-1 flex items-center gap-2">
                        <Activity size={14} /> Manage DNS Records
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/40" size={18} />
                        <input
                            type="text"
                            placeholder="Search records..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-border/50 rounded-xl text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 w-full md:w-64 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm shadow-primary/20 whitespace-unwrap"
                    >
                        <Plus size={18} /> Add Record
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center flex-col items-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-accent/50 text-sm animate-pulse">Scanning Zone Records...</p>
                </div>
            ) : (
                <div className="bg-white border border-border/40 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/40 bg-surface/50">
                                    <th className="py-4 px-6 font-semibold text-sm text-accent/60">Name</th>
                                    <th className="py-4 px-6 font-semibold text-sm text-accent/60 w-24">Type</th>
                                    <th className="py-4 px-6 font-semibold text-sm text-accent/60">Data</th>
                                    <th className="py-4 px-6 font-semibold text-sm text-accent/60 w-24 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-12 text-center text-accent/50">
                                            No records found matching your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record, i) => (
                                        <tr key={i} className="border-b border-border/20 hover:bg-surface/50 transition-colors group">
                                            <td className="py-4 px-6 font-medium text-accent">
                                                {record.name}
                                                {record.name !== '@' && <span className="text-accent/40 font-normal ml-1">.{zoneName}</span>}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className="px-2 py-1 text-xs font-bold rounded-md bg-accent/5 text-accent/70 border border-border/50">
                                                    {record.type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-accent/80 font-mono text-sm">
                                                {record.data}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditRecord({ name: record.name, type: record.type, old_data: record.data, new_data: record.data });
                                                            setIsEditModalOpen(true);
                                                        }}
                                                        className="p-2 text-primary/70 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        title="Edit record"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(record)}
                                                        className="p-2 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                        title="Delete record"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )
            }

            {/* Add Record Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-border/40 flex justify-between items-center bg-surface/30">
                                <h2 className="text-xl font-bold text-accent font-heading">Add DNS Record</h2>
                            </div>
                            <form onSubmit={handleAddRecord} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-accent/80 mb-1">Record Type</label>
                                        <select
                                            className="w-full px-4 py-2.5 bg-surface border border-border/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                            value={newRecord.type}
                                            onChange={e => setNewRecord({ ...newRecord, type: e.target.value })}
                                        >
                                            {recordTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-accent/80 mb-1">Name / Host</label>
                                        <div className="flex">
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g., www, mail, or @"
                                                className="w-full px-4 py-2.5 bg-surface border border-border/60 rounded-l-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                                value={newRecord.name}
                                                onChange={e => setNewRecord({ ...newRecord, name: e.target.value })}
                                            />
                                            <div className="bg-surface/50 border border-l-0 border-border/60 rounded-r-xl px-3 py-2.5 flex items-center justify-center text-accent/40 text-sm whitespace-nowrap">
                                                .{zoneName}
                                            </div>
                                        </div>
                                        <p className="text-xs text-accent/50 mt-1">Use <code>@</code> for the root domain.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-accent/80 mb-1">Data / Target</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., 10.0.0.5 or target.domain.com"
                                            className="w-full px-4 py-2.5 bg-surface border border-border/60 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                            value={newRecord.data}
                                            onChange={e => setNewRecord({ ...newRecord, data: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="px-5 py-2.5 text-sm font-medium text-accent/70 hover:text-accent hover:bg-surface rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-md shadow-primary/20 ${isSubmitting ? 'opacity-70 cursor-wait' : ''}`}
                                    >
                                        {isSubmitting ? 'Adding...' : 'Add Record'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Edit Record Modal */}
            {
                isEditModalOpen && editRecord && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-border/40 flex justify-between items-center bg-surface/30">
                                <h2 className="text-xl font-bold text-accent font-heading">Edit DNS Record</h2>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 rounded-lg hover:bg-surface transition-smooth">
                                    <X size={20} className="text-accent/60" />
                                </button>
                            </div>
                            <form onSubmit={handleEditRecord} className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-accent/80 mb-1">Record Type</label>
                                        <input
                                            type="text"
                                            disabled
                                            className="w-full px-4 py-2.5 bg-surface/50 border border-border/60 rounded-xl text-sm focus:outline-none"
                                            value={editRecord.type}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-accent/80 mb-1">Name / Host</label>
                                        <div className="flex">
                                            <input
                                                type="text"
                                                disabled
                                                className="w-full px-4 py-2.5 bg-surface/50 border border-border/60 rounded-l-xl text-sm focus:outline-none"
                                                value={editRecord.name}
                                            />
                                            <div className="bg-surface/50 border border-l-0 border-border/60 rounded-r-xl px-3 py-2.5 flex items-center justify-center text-accent/40 text-sm whitespace-nowrap">
                                                .{zoneName}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-accent/80 mb-1">Data / Target</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., 10.0.0.5 or target.domain.com"
                                            className="w-full px-4 py-2.5 bg-surface border border-border/60 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                            value={editRecord.new_data}
                                            onChange={e => setEditRecord({ ...editRecord, new_data: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-5 py-2.5 text-sm font-medium text-accent/70 hover:text-accent hover:bg-surface rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || editRecord.new_data === editRecord.old_data || editRecord.new_data.trim() === ''}
                                        className={`px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-all shadow-md shadow-primary/20 ${isSubmitting || editRecord.new_data === editRecord.old_data || editRecord.new_data.trim() === '' ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
