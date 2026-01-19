import { useEffect, useState } from 'react';
import { useSimulationStore } from '@/stores/useSimulationStore';

export function ChartStatusOverlay() {
    const baseInterval = useSimulationStore(s => s.baseInterval);
    const [status, setStatus] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Track interval changes to show feedback
    useEffect(() => {
        // 0-200ms: Debounce (fast switch feels instant)
        // 200ms-2.5s: "Switching to X..."
        // >2.5s: "Syncing data..." (Escalation)

        let t1: NodeJS.Timeout;
        let t2: NodeJS.Timeout;
        let t3: NodeJS.Timeout;

        // Reset initially
        setIsVisible(false);
        setStatus(null);

        t1 = setTimeout(() => {
            setStatus(`Switching to ${baseInterval}...`);
            setIsVisible(true);
        }, 200);

        t2 = setTimeout(() => {
            setStatus('Syncing data...'); // Escalation message
        }, 2500);

        // Fail-safe hide after 5s
        t3 = setTimeout(() => {
            setIsVisible(false);
        }, 5000);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [baseInterval]);

    if (!isVisible || !status) return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="bg-[var(--bg-secondary)] border border-[var(--bg-subtle-border)] 
                          shadow-lg rounded-full px-4 py-1.5 flex items-center gap-2 
                          animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="w-3 h-3 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {status}
                </span>
            </div>
        </div>
    );
}
