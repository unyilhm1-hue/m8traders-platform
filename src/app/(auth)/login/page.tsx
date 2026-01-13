/**
 * Login Page
 * Email magic link authentication with whitelist check
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // Check whitelist first
            const checkResponse = await fetch('/api/auth/check-whitelist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const checkData = await checkResponse.json();

            if (!checkData.allowed) {
                setMessage({
                    type: 'error',
                    text: 'Email tidak terdaftar. Hubungi admin untuk akses.',
                });
                setLoading(false);
                return;
            }

            // Send magic link
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) throw error;

            setMessage({
                type: 'success',
                text: 'Magic link terkirim! Cek email Anda.',
            });
            setEmail('');
        } catch (error: unknown) {
            console.error('Login error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
            setMessage({
                type: 'error',
                text: errorMessage,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center px-6 bg-[var(--bg-primary)]">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <Link href="/">
                        <h1 className="text-4xl font-bold mb-2">
                            <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-blue)] bg-clip-text text-transparent">
                                m8trader$
                            </span>
                        </h1>
                    </Link>
                    <p className="text-[var(--text-secondary)]">Sekolah Pasar Modal</p>
                </div>

                {/* Login Card */}
                <div className="bg-card rounded-2xl p-8 border border-[var(--bg-tertiary)]">
                    <h2 className="text-2xl font-semibold mb-6">Login</h2>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Email Input */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="nama@example.com"
                                required
                                disabled={loading}
                                className="w-full px-4 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition-all disabled:opacity-50"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-3 bg-[var(--accent-purple)] hover:bg-[var(--accent-purple)]/80 text-white rounded-lg font-medium transition-all glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Mengirim...' : 'Kirim Magic Link'}
                        </button>
                    </form>

                    {/* Message */}
                    {message && (
                        <div
                            className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success'
                                    ? 'bg-[var(--emotion-calm)]/10 text-[var(--emotion-calm)] border border-[var(--emotion-calm)]/20'
                                    : 'bg-[var(--emotion-fear)]/10 text-[var(--emotion-fear)] border border-[var(--emotion-fear)]/20'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {/* Info */}
                    <p className="mt-6 text-xs text-[var(--text-tertiary)] text-center">
                        Kami akan mengirim link login ke email Anda.
                        <br />
                        Tidak perlu password.
                    </p>
                </div>

                {/* Back to Home */}
                <div className="text-center mt-6">
                    <Link
                        href="/"
                        className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        ← Kembali ke Beranda
                    </Link>
                </div>
            </div>
        </main>
    );
}
