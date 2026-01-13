/**
 * AuthButton Component
 * Displays user info and logout button
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

interface AuthButtonProps {
    user: User;
}

export function AuthButton({ user }: AuthButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        setLoading(true);

        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Logout error:', error);
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center gap-4">
            {/* User Email */}
            <span className="text-sm text-[var(--text-secondary)]">
                {user.email}
            </span>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                disabled={loading}
                className="px-4 py-2 text-sm border border-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] text-[var(--text-primary)] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Logging out...' : 'Logout'}
            </button>
        </div>
    );
}
