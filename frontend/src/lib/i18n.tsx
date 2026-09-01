'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import pt from '../../messages/pt.json';
import en from '../../messages/en.json';
import es from '../../messages/es.json';

type Locale = 'pt' | 'en' | 'es';

const messages: Record<Locale, any> = { pt, en, es };

interface I18nContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
    locale: 'pt',
    setLocale: () => { },
    t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('pt');

    useEffect(() => {
        const saved = localStorage.getItem('swat4_locale') as Locale;
        if (saved && messages[saved]) {
            setLocaleState(saved);
        }
    }, []);

    const setLocale = (l: Locale) => {
        setLocaleState(l);
        localStorage.setItem('swat4_locale', l);
        document.documentElement.lang = l;
    };

    const t = (key: string): string => {
        const keys = key.split('.');
        let value: any = messages[locale];
        for (const k of keys) {
            value = value?.[k];
        }
        return typeof value === 'string' ? value : key;
    };

    return (
        <I18nContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    return useContext(I18nContext);
}

export const localeNames: Record<Locale, string> = {
    pt: 'Português',
    en: 'English',
    es: 'Español',
};

export const localeFlags: Record<Locale, string> = {
    pt: '🇧🇷',
    en: '🇺🇸',
    es: '🇪🇸',
};
