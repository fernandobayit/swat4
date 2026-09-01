'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { dns as dnsApi } from '@/lib/api';
import { ShieldAlert, Globe, Server, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DnsPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [zones, setZones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadZones();
    }, []);

    const loadZones = async () => {
        setLoading(true);
        try {
            const data = await dnsApi.listZones();
            setZones(data);
        } catch (error) {
            console.error('Failed to load DNS zones', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-heading text-accent tracking-tight flex items-center gap-3">
                        <Globe className="text-primary" size={28} />
                        {t('dns.title') || t('nav.dns')}
                    </h1>
                    <p className="text-accent/60 mt-1">{t('dns.subtitle')}</p>
                </div>
                <button onClick={loadZones} className="px-4 py-2 bg-primary/10 text-primary-dark rounded-xl text-sm font-medium hover:bg-primary/20 active:scale-95 transition-all">
                    {t('dns.refreshZones')}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
            ) : zones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center mb-4">
                        <ShieldAlert className="text-accent/30" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-accent mb-1">{t('dns.noZones')}</h3>
                    <p className="text-accent/50 text-sm max-w-sm">{t('dns.noZonesHelper')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {zones.map((zone, idx) => (
                        <div
                            key={idx}
                            onClick={() => router.push(`/dashboard/dns/${zone.name}`)}
                            className="bg-white rounded-3xl p-6 border border-border/40 shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all cursor-pointer group flex flex-col"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:scale-105 group-hover:bg-primary group-hover:text-white transition-all text-primary">
                                    <Server size={24} />
                                </div>
                                <span className="px-2.5 py-1 bg-surface rounded-lg text-xs font-semibold text-accent/60 uppercase tracking-wider">
                                    {zone.type === 'DNS_ZONE_TYPE_PRIMARY' ? t('dns.primary') : zone.type}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold font-heading text-accent mb-1 group-hover:text-primary transition-colors">{zone.name}</h3>
                            <p className="text-sm text-accent/50 line-clamp-1 mb-6">{t('dns.integratedZone')}</p>

                            <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-accent/60 font-medium">
                                    <Activity size={16} className="text-accent/30" />
                                    <span>{t('dns.records')} {zone.recordsCount ?? '?'}</span>
                                </div>
                                <div className="text-primary text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                    {t('dns.manage')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
