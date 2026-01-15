/**
 * QuickAccessGrid Component
 * Quick links to main platform features
 */
'use client';

import Link from 'next/link';
import { PlayCircle, Target, LineChart, ArrowRight, Activity, Trophy } from 'lucide-react';

interface FeatureCard {
    icon: React.ElementType;
    title: string;
    description: string;
    href: string;
    badge?: string;
    color: string;
    gradient: string;
}

const FEATURES: FeatureCard[] = [
    {
        icon: PlayCircle,
        title: 'Replay System',
        description: 'Latih analisis teknikal dengan data historis real',
        href: '/sim/demo',
        badge: '3 Mode',
        color: '#3772FF',
        gradient: 'from-[#3772FF] to-[#9757FF]',
    },
    {
        icon: Trophy,
        title: 'Challenge Center',
        description: 'Selesaikan misi harian dan raih profit konsisten',
        href: '/challenges',
        badge: 'New!',
        color: '#00C9B7',
        gradient: 'from-[#00C9B7] to-[#4ECDC4]',
    },
    {
        icon: Activity,
        title: 'Trading Simulator',
        description: 'Simulasi trading real-time tanpa risiko loss',
        href: '/sim/demo',
        badge: 'Live Data',
        color: '#F0B90B',
        gradient: 'from-[#F0B90B] to-[#FF6B6B]',
    },
];

export function QuickAccessGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
                <Link
                    key={feature.title}
                    href={feature.href}
                    className="group relative p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] hover:border-[var(--bg-subtle-border)] overflow-hidden transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-2xl"
                >
                    {/* Hover Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />

                    {/* Top Section: Icon & Header */}
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div
                            className="p-3 rounded-xl bg-[var(--bg-tertiary)] group-hover:bg-white/10 transition-colors duration-300"
                            style={{ color: feature.color }}
                        >
                            <feature.icon size={28} />
                        </div>
                        {feature.badge && (
                            <span
                                className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border"
                                style={{
                                    color: feature.color,
                                    borderColor: `${feature.color}40`,
                                    backgroundColor: `${feature.color}10`
                                }}
                            >
                                {feature.badge}
                            </span>
                        )}
                    </div>

                    {/* Content Section */}
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2 group-hover:text-white transition-colors">
                            {feature.title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] mb-6 line-clamp-2 group-hover:text-[var(--text-primary)]/80 transition-colors">
                            {feature.description}
                        </p>

                        {/* Action Row */}
                        <div className="flex items-center text-sm font-semibold group/btn">
                            <span className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors mr-2">
                                Akses Fitur
                            </span>
                            <ArrowRight
                                size={16}
                                className="text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transform group-hover:translate-x-1 transition-all"
                            />
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
