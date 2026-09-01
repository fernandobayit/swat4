import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#0ABF16',
                    dark: '#027333',
                    light: '#C7FF9B',
                    50: '#E8FFE9',
                    100: '#C7FF9B',
                    200: '#7AE882',
                    300: '#3DD946',
                    400: '#0ABF16',
                    500: '#089B12',
                    600: '#027333',
                    700: '#025A28',
                    800: '#01421D',
                    900: '#002912',
                },
                accent: {
                    DEFAULT: '#262626',
                    light: '#404040',
                    dark: '#1a1a1a',
                },
                surface: {
                    DEFAULT: '#F5F5F5',
                    dark: '#E8E8E8',
                    light: '#FAFAFA',
                },
                border: {
                    DEFAULT: '#D9D9D9',
                    dark: '#BFBFBF',
                    light: '#E8E8E8',
                },
                gradient: {
                    start: '#C7FF9B',
                    end: '#FFF6A7',
                },
            },
            fontFamily: {
                sans: ['Lexend', 'Urbanist', 'system-ui', 'sans-serif'],
                heading: ['Urbanist', 'Lexend', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                xl: '16px',
                '2xl': '24px',
                '3xl': '32px',
            },
            boxShadow: {
                card: '0 2px 8px rgba(0, 0, 0, 0.06)',
                elevated: '0 4px 16px rgba(0, 0, 0, 0.08)',
                modal: '0 8px 32px rgba(0, 0, 0, 0.12)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideInRight: {
                    '0%': { opacity: '0', transform: 'translateX(-10px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
