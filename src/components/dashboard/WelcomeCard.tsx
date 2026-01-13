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
        <div className="relative p-6 rounded-lg bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)] border border-[var(--bg-tertiary)] overflow-hidden">
            {/* Decorative gradient overlay */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-primary)] opacity-5 rounded-full blur-3xl" />

            <div className="relative z-10">
                {/* Greeting */}
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
                    Selamat datang, {userName}! 👋
                </h1>

                {/* Quote */}
                <div className="mb-6">
                    <p className="text-sm text-[var(--text-tertiary)] mb-1">Quote hari ini:</p>
                    <blockquote className="text-base md:text-lg italic text-[var(--text-secondary)] border-l-4 border-[var(--accent-primary)] pl-4">
                        "{quote}"
                    </blockquote>
                </div>

                {/* CTA */}
                <a
                    href="/challenges"
                    className="inline-block px-6 py-3 bg-[var(--accent-primary)] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                    Mulai Belajar →
                </a>
            </div>
        </div>
    );
}
