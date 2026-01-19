/**
 * WelcomeCard Component
 * Personalized greeting with motivational quote
 */
'use client';

import { useState, useEffect } from 'react';

const TRADING_QUOTES = [
    'Plan the trade, trade the plan.',
    'Disiplin adalah jembatan antara tujuan dan pencapaian.',
    'Trading yang profitable dimulai dari pikiran yang tenang.',
    'Cut your losses short, let your profits run.',
    'Pasar selalu benar. Ego kita yang salah.',
    'Kesabaran adalah kunci dalam trading.',
    'Risk management > Profit target.',
    'The trend is your friend until the end.',
    'Analisis yang baik + Eksekusi yang disiplin = Profit konsisten.',
    'Bukan berapa banyak Anda trade, tapi seberapa baik Anda trade.',
];

interface WelcomeCardProps {
    userName?: string;
}

export function WelcomeCard({ userName = 'Trader' }: WelcomeCardProps) {
    const [quote, setQuote] = useState('');

    useEffect(() => {
        // Random quote on mount
        const randomQuote = TRADING_QUOTES[Math.floor(Math.random() * TRADING_QUOTES.length)];
        setQuote(randomQuote);
    }, []);

    return (
        <div className="relative p-6 rounded-2xl bg-gradient-to-br from-[var(--bg-secondary)]/90 to-[var(--bg-tertiary)]/50 border border-[var(--bg-tertiary)] overflow-hidden shadow-2xl group h-full flex flex-col justify-center">
            {/* Ambient Background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--accent-primary)] opacity-10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-opacity duration-700" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--accent-purple)] opacity-10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/3" />

            <div className="relative z-10 flex flex-col items-start gap-4">
                {/* Header Section */}
                <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-[10px] font-semibold mb-2 border border-[var(--accent-primary)]/20">
                        <span className="animate-pulse">●</span> Ready to Trade
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                        Selamat datang, <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-purple)]">{userName}</span>! 👋
                    </h1>
                </div>

                {/* Quote Section */}
                <div className="max-w-xl">
                    <blockquote className="text-sm text-[var(--text-secondary)] italic font-light leading-relaxed">
                        "{quote}"
                    </blockquote>
                </div>

                {/* CTA Button */}
                <div className="mt-2">
                    <a
                        href="/challenges"
                        className="group/btn relative inline-flex items-center gap-2 px-5 py-2 bg-[var(--accent-primary)] text-white font-bold rounded-lg overflow-hidden hover:shadow-[0_0_20px_rgba(0,201,183,0.4)] transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        <span className="relative z-10 text-sm tracking-wide">MULAI SESI HARI INI</span>
                        <span className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full bg-white/20 group-hover/btn:translate-x-1 transition-transform">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.5 6H9.5M9.5 6L6 2.5M9.5 6L6 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-[200%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
                    </a>
                </div>
            </div>
        </div>
    );
}
