import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'SWAT4 - Samba 4 Web Administration Tool',
    description: 'Modern web panel for Samba 4 Active Directory management',
    icons: {
        icon: '/saxis-icon.png',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt" suppressHydrationWarning>
            <body className="antialiased">{children}</body>
        </html>
    );
}
