import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'm8traders - Sekolah Pasar Modal',
  description:
    'Platform edukasi trading interaktif. Belajar analisis teknikal, fundamental, dan kontrol emosi dalam trading dengan simulasi real-time.',
  keywords: [
    'trading',
    'saham',
    'edukasi',
    'pasar modal',
    'analisis teknikal',
    'candlestick',
    'Indonesia',
  ],
  authors: [{ name: 'm8traders' }],
  openGraph: {
    title: 'm8traders - Sekolah Pasar Modal',
    description: 'Platform edukasi trading interaktif dengan simulasi real-time',
    url: 'https://m8traders.vercel.app',
    siteName: 'm8traders',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'm8traders - Sekolah Pasar Modal',
    description: 'Platform edukasi trading interaktif dengan simulasi real-time',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
