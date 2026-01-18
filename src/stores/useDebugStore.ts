import { create } from 'zustand';
import { produce } from 'immer';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogSource = 'Main' | 'WorkerA' | 'WorkerB' | 'System' | 'GlobalObserver' | 'Console' | 'ErrorBoundary';

export interface LogEntry {
    id: string;
    timestamp: number;
    source: LogSource;
    level: LogLevel;
    message: string;
    data?: any;
}

export interface WorkerStatus {
    status: 'idle' | 'working' | 'error' | 'offline' | 'hung';
    lastHeartbeat: number;
    currentTask?: string;
}

export interface BrowserInfo {
    userAgent: string;
    viewport: { width: number; height: number };
    memory?: {
        used: number;
        total: number;
        limit: number;
    };
    connection?: string;
}

interface DebugState {
    logs: LogEntry[];
    workerStatus: {
        admin: WorkerStatus;
        physics: WorkerStatus;
    };
    snapshots: Record<string, any>; // Flexible snapshot storage
    browserInfo?: BrowserInfo;
    hasCriticalError: boolean;
    isOpen: boolean; // UI panel state

    // Actions
    addLog: (source: LogSource, level: LogLevel, message: string, data?: any) => void;
    updateWorkerStatus: (worker: 'admin' | 'physics', status: Partial<WorkerStatus>) => void;
    captureSnapshot: (key: string, data: any) => void;
    captureBrowserInfo: () => void;
    setPanelOpen: (isOpen: boolean) => void;
    clearLogs: () => void;
    generateReport: () => string;
}

const MAX_LOGS = 500;

export const useDebugStore = create<DebugState>((set, get) => ({
    logs: [],
    workerStatus: {
        admin: { status: 'idle', lastHeartbeat: Date.now() },
        physics: { status: 'idle', lastHeartbeat: Date.now() },
    },
    snapshots: {},
    hasCriticalError: false,
    isOpen: false,

    addLog: (source, level, message, data) => set(produce((state: DebugState) => {
        const entry: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            source,
            level,
            message,
            data
        };

        state.logs.unshift(entry);

        // Log rotation (max 500 entries)
        if (state.logs.length > MAX_LOGS) {
            state.logs.pop();
        }

        // Auto-snapshot on critical errors
        if (level === 'error') {
            state.hasCriticalError = true;

            // Automatically capture browser info on first critical error
            if (!state.browserInfo) {
                get().captureBrowserInfo();
            }
        }
    })),

    updateWorkerStatus: (worker, status) => set(produce((state: DebugState) => {
        state.workerStatus[worker] = {
            ...state.workerStatus[worker],
            ...status,
            lastHeartbeat: Date.now()
        };
    })),

    captureSnapshot: (key, data) => set(produce((state: DebugState) => {
        state.snapshots[key] = {
            data,
            capturedAt: Date.now()
        };
    })),

    captureBrowserInfo: () => set(produce((state: DebugState) => {
        if (typeof window === 'undefined') return;

        const info: BrowserInfo = {
            userAgent: navigator.userAgent,
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        };

        // Capture memory info if available (Chromium browsers)
        if ('memory' in performance && (performance as any).memory) {
            const mem = (performance as any).memory;
            info.memory = {
                used: Math.round(mem.usedJSHeapSize / 1048576), // MB
                total: Math.round(mem.totalJSHeapSize / 1048576),
                limit: Math.round(mem.jsHeapSizeLimit / 1048576)
            };
        }

        // Capture connection type if available
        if ('connection' in navigator && (navigator as any).connection) {
            info.connection = (navigator as any).connection.effectiveType;
        }

        state.browserInfo = info;
    })),

    setPanelOpen: (isOpen) => set({ isOpen }),

    clearLogs: () => set({ logs: [], hasCriticalError: false }),

    generateReport: () => {
        const s = get();
        const time = new Date().toISOString();

        return `
# 🐞 BUG REPORT [${time}]

## 1. Browser Environment
- **User Agent**: ${s.browserInfo?.userAgent || 'N/A'}
- **Viewport**: ${s.browserInfo?.viewport.width}x${s.browserInfo?.viewport.height}
- **Memory Usage**: ${s.browserInfo?.memory ? `${s.browserInfo.memory.used}MB / ${s.browserInfo.memory.limit}MB` : 'N/A'}
- **Connection**: ${s.browserInfo?.connection || 'N/A'}

## 2. System Status
- **Worker Admin**: ${s.workerStatus.admin.status} (Last: ${new Date(s.workerStatus.admin.lastHeartbeat).toLocaleTimeString()})
- **Worker Physics**: ${s.workerStatus.physics.status} (Last: ${new Date(s.workerStatus.physics.lastHeartbeat).toLocaleTimeString()})
- **Critical Error**: ${s.hasCriticalError ? '🔴 YES' : '🟢 NO'}

## 3. Data Snapshots
${Object.keys(s.snapshots).length > 0 ? Object.entries(s.snapshots).map(([key, snapshot]) => `
### ${key}
\`\`\`json
${JSON.stringify((snapshot as any).data, null, 2)}
\`\`\`
Captured at: ${new Date((snapshot as any).capturedAt).toLocaleString()}
`).join('\n') : 'No snapshots captured'}

## 4. Recent Logs (Last 50)
${s.logs.slice(0, 50).map(l => `- [${new Date(l.timestamp).toLocaleTimeString()}] **[${l.source}]** [${l.level.toUpperCase()}] ${l.message}${l.data ? `\n  \`\`\`json\n  ${JSON.stringify(l.data, null, 2).slice(0, 200)}...\n  \`\`\`` : ''}`).join('\n')}

---
*Generated by Omniscient Flight Recorder v2.0*
        `.trim();
    }
}));
