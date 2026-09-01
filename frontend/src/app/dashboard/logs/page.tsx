'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { logs as logsApi } from '@/lib/api';
import { FileText, Search, RefreshCw, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogEntry } from '@/lib/types';

export default function LogsPage() {
    const { t } = useTranslation();
    const [logFiles, setLogFiles] = useState<string[]>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [lines, setLines] = useState(200);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [showFileDropdown, setShowFileDropdown] = useState(false);
    const logEndRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadFiles();
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    useEffect(() => {
        if (selectedFile) loadLogs();
    }, [selectedFile, lines]);

    useEffect(() => {
        if (autoRefresh && selectedFile) {
            intervalRef.current = setInterval(loadLogs, 5000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [autoRefresh, selectedFile]);

    const loadFiles = async () => {
        try {
            const files = await logsApi.files();
            setLogFiles(files);
            if (files.length > 0 && !selectedFile) setSelectedFile(files[0]);
        } catch (e) { console.error(e); }
    };

    const loadLogs = async () => {
        if (!selectedFile) return;
        try {
            setLoading(true);
            const data = await logsApi.read(selectedFile, lines, undefined, search || undefined);
            setEntries(data.entries || []);
            setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const getLevelColor = (level?: string) => {
        if (!level) return 'text-accent/50';
        const n = parseInt(level);
        if (n <= 0) return 'text-red-500';
        if (n <= 1) return 'text-amber-500';
        if (n <= 3) return 'text-blue-500';
        return 'text-accent/40';
    };

    return (
        <div className="animate-fade-in h-[calc(100vh-48px)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold font-heading text-accent">{t('logs.title')}</h1>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* File selector */}
                <div className="relative">
                    <button onClick={() => setShowFileDropdown(!showFileDropdown)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border/40 rounded-xl text-sm hover:border-primary/30 transition-smooth min-w-[200px]">
                        <FileText size={15} className="text-accent/40" />
                        <span className="text-accent/70 truncate">{selectedFile || t('logs.selectFile')}</span>
                        <ChevronDown size={14} className={`ml-auto text-accent/30 transition-transform ${showFileDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showFileDropdown && (
                        <div className="absolute top-full mt-1 left-0 w-full bg-white border border-border rounded-xl shadow-modal z-20 max-h-60 overflow-y-auto animate-fade-in">
                            {logFiles.map((f) => (
                                <button key={f} onClick={() => { setSelectedFile(f); setShowFileDropdown(false); }}
                                    className={cn('w-full text-left px-4 py-2.5 text-sm hover:bg-surface transition-smooth',
                                        f === selectedFile ? 'text-primary-dark font-semibold bg-primary/5' : 'text-accent/60')}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/30" />
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-border/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-smooth"
                        placeholder={t('common.search') + '...'} />
                </div>

                {/* Lines selector */}
                <select value={lines} onChange={(e) => setLines(Number(e.target.value))}
                    className="px-3 py-2.5 bg-white border border-border/40 rounded-xl text-sm text-accent/60 focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value={100}>100 {t('logs.lines')}</option>
                    <option value={200}>200 {t('logs.lines')}</option>
                    <option value={500}>500 {t('logs.lines')}</option>
                    <option value={1000}>1000 {t('logs.lines')}</option>
                </select>

                {/* Auto refresh */}
                <button onClick={() => setAutoRefresh(!autoRefresh)}
                    className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth border',
                        autoRefresh ? 'border-primary bg-primary/5 text-primary-dark' : 'border-border/40 bg-white text-accent/50 hover:text-accent hover:border-accent/30')}>
                    <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
                    {t('logs.autoRefresh')}
                </button>

                {/* Refresh button */}
                <button onClick={loadLogs}
                    className="p-2.5 bg-white border border-border/40 rounded-xl text-accent/50 hover:text-accent hover:border-accent/30 transition-smooth">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* Log viewer */}
            <div className="flex-1 bg-accent rounded-2xl overflow-hidden shadow-card flex flex-col">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
                    <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-400/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                        <span className="w-3 h-3 rounded-full bg-green-400/80" />
                    </div>
                    <span className="text-[11px] text-white/30 font-mono ml-2">{selectedFile}</span>
                    <span className="text-[11px] text-white/20 ml-auto">{entries.length} entries</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 font-mono">
                    {loading && entries.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-white/20 text-sm">
                            {t('logs.noLogs')}
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {entries.map((entry, i) => (
                                <div key={i} className="log-line text-white/70 hover:text-white/90 px-2 py-0.5 rounded transition-smooth">
                                    {entry.timestamp && (
                                        <span className="text-white/30 mr-2">{entry.timestamp}</span>
                                    )}
                                    {entry.level && (
                                        <span className={cn('mr-2 font-semibold', getLevelColor(entry.level))}>[{entry.level}]</span>
                                    )}
                                    {entry.source && (
                                        <span className="text-blue-300/60 mr-2">{entry.source}</span>
                                    )}
                                    <span>{entry.message}</span>
                                </div>
                            ))}
                            <div ref={logEndRef} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
