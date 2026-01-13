/**
 * QuickAccessGrid Component
 * Quick links to main platform features
 */
'use client';

import Link from 'next/link';

interface FeatureCard {
    icon: string;
    title: string;
    description: string;
    href: string;
    badge?: string;
    color: string;
}

const FEATURES: FeatureCard[] = [
    {
        icon: '⏮️',
        title: 'Replay System',
        description: 'Latih analisis dengan data historis',
        href: '/sim/demo',
        badge: '3 Mode',
        color: '#2196F3',
    },
    {
        icon: '🎯',
        title: 'Challenge Center',
        description: 'Asah skill trading Anda',
        href: '/challenges',
        badge: 'New!',
        color: '#4CAF50',
    },
    {
        icon: '📈',
        title: 'Trading Simulator',
        description: 'Praktik trading tanpa risiko',
        href: '/sim/demo',
        badge: 'Live Data',
        color: '#FF9800',
    },
];

export function QuickAccessGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURES.map((feature) => (
                <Link
                    key={feature.title}
                    href={feature.href}
                    className="group relative p-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] transition-all duration-200 hover:shadow-lg"
                >
                    {/* Badge */}
                    {feature.badge && (
                        <div className="absolute top-3 right-3 px-2 py-1 text-xs font-semibold bg-[var(--accent-primary)] text-white rounded">
                            {feature.badge}
                        </div>
                    )}

                    {/* Icon */}
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-200">
                        {feature.icon}
                    </div>

                    {/* Content */}
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                        {feature.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-4">
                        {feature.description}
                    </p>

                    {/* CTA */}
                    <div className="flex items-center text-sm font-semibold group-hover:translate-x-1 transition-transform duration-200">
                        <span style={{ color: feature.color }}>Buka</span>
                        <span className="ml-1" style={{ color: feature.color }}>→</span>
                    </div>

                    {/* Decorative gradient */}
                    <div
                        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ backgroundColor: feature.color }}
                    />
                </Link>
            ))}
        </div>
    );
}
