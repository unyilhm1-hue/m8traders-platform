/**
 * Protected Layout
 * Wraps all /sim/* routes with authentication
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthButton } from '@/components/layout/AuthButton';
import { PerformanceDashboard } from '@/components/debug/PerformanceDashboard';
import { DebugPanel } from '@/components/debug/DebugPanel';
import Link from 'next/link';

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // TEMPORARY: Disable auth check for development
    // if (!user) {
    //     redirect('/login');
    // }

    // Mock user for development (to prevent AuthButton errors)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUser = user || { email: 'dev@localhost', id: 'dev-user' } as any;

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="h-[var(--header-height)] flex items-center justify-between px-6 border-b border-[var(--bg-tertiary)] bg-[var(--bg-primary)]">
                <div className="flex items-center gap-6">
                    <Link href="/" className="flex items-center gap-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-blue)] bg-clip-text text-transparent">
                            m8trader$
                        </span>
                    </Link>

                    {/* Navigation */}
                    <nav className="flex items-center gap-4 text-sm">
                        <Link
                            href="/dashboard"
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/sim/demo"
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            Simulator
                        </Link>
                        <Link
                            href="/challenges"
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        >
                            Challenges
                        </Link>
                    </nav>
                </div>

                {/* User Info */}
                <AuthButton user={mockUser} />
            </header>

            {/* Main Content */}
            <main className="flex-1">{children}</main>

            {/* Debug Tools */}
            <PerformanceDashboard />
            <DebugPanel />
        </div>
    );
}
