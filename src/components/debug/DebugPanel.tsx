'use client';

import { useState, useRef, useEffect } from 'react';
import { useDebugStore } from '@/stores/useDebugStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Activity, Terminal, Copy, X, Wifi, Cpu, Monitor } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

export function DebugPanel() {
    const {
        isOpen,
        setPanelOpen,
        logs,
        workerStatus,
        browserInfo,
        hasCriticalError,
        generateReport,
        clearLogs,
        captureBrowserInfo
    } = useDebugStore();

    const [activeTab, setActiveTab] = useState<'status' | 'logs'>('status');
    const [sourceFilter, setSourceFilter] = useState<'ALL' | 'UI' | 'STORE' | 'NETWORK' | 'WORKER'>('ALL');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Capture browser info on first open
    useEffect(() => {
        if (isOpen && !browserInfo?.userAgent) { // Check for userAgent to see if info is captured
            captureBrowserInfo();
        }
    }, [isOpen, browserInfo?.userAgent, captureBrowserInfo]);

    // Auto-scroll logs
    useEffect(() => {
        if (isOpen && activeTab === 'logs') {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, isOpen, activeTab]);

    const handleCopy = () => {
        const report = generateReport();
        navigator.clipboard.writeText(report);
        alert('Debug Report copied to clipboard!')
    };

    // Calculate overall system health
    const systemHealth = () => {
        if (hasCriticalError) return 'critical';
        if (workerStatus.physics.status === 'error' || workerStatus.physics.status === 'hung') return 'error';
        if (workerStatus.admin.status === 'error' || workerStatus.admin.status === 'hung') return 'error';
        if (workerStatus.physics.status === 'working' || workerStatus.admin.status === 'working') return 'working';
        return 'idle';
    };

    const health = systemHealth();

    return (
        <>
            {/* The Panic Button */}
            <button
                onClick={() => setPanelOpen(!isOpen)}
                className={`
                    fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-xl transition-all hover:scale-110
                    ${hasCriticalError ? 'bg-red-500 animate-pulse' : 'bg-gray-800 hover:bg-gray-700'}
                    text-white border border-white/10
                `}
                title="Open Flight Recorder"
            >
                <Bug size={24} />
            </button>

            {/* The Panel */}
            <AnimatePresence>
                {isOpen && (
                    <Portal>
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.95 }}
                            className="fixed bottom-20 right-4 z-50 w-[450px] h-[550px] bg-[#0f1115] border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/50">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-gray-200">Omniscient Flight Recorder</span>
                                    {hasCriticalError && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-500 rounded">CRITICAL</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                                        title="Copy Full Report"
                                    >
                                        <Copy size={16} />
                                    </button>
                                    <button
                                        onClick={() => setPanelOpen(false)}
                                        className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Traffic Light Status Bar */}
                            <div className="px-3 py-2 bg-gray-900/30 border-b border-gray-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <TrafficLight label="System" status={health} />
                                        <TrafficLight label="Network" status="working" icon={Wifi} />
                                        <TrafficLight label="UI" status="working" icon={Monitor} />
                                        <TrafficLight
                                            label="Workers"
                                            status={workerStatus.physics.status === 'working' ? 'working' : workerStatus.physics.status}
                                            icon={Cpu}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b border-gray-800">
                                <button
                                    onClick={() => setActiveTab('status')}
                                    className={`flex-1 p-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'status' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Activity size={14} /> System Status
                                </button>
                                <button
                                    onClick={() => setActiveTab('logs')}
                                    className={`flex-1 p-2 text-xs font-medium flex items-center justify-center gap-2 ${activeTab === 'logs' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Terminal size={14} /> Live Logs ({logs.length})
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto bg-[#0a0c10] p-3">
                                {activeTab === 'status' ? (
                                    <div className="space-y-4">
                                        {/* Browser Info */}
                                        {browserInfo && (
                                            <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/50">
                                                <h4 className="text-xs font-bold text-gray-400 mb-2">BROWSER ENVIRONMENT</h4>
                                                <div className="text-[10px] text-gray-500 space-y-1">
                                                    <div>Viewport: {browserInfo.viewport.width}x{browserInfo.viewport.height}</div>
                                                    {browserInfo.memory && (
                                                        <div>Memory: {browserInfo.memory.used}MB / {browserInfo.memory.limit}MB</div>
                                                    )}
                                                    {browserInfo.connection && (
                                                        <div>Connection: {browserInfo.connection}</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <StatusCard
                                            name="Worker Physics"
                                            status={workerStatus.physics}
                                        />
                                        <StatusCard
                                            name="Worker Admin"
                                            status={workerStatus.admin}
                                        />

                                        <div className="pt-4 border-t border-gray-800">
                                            <h4 className="text-xs font-bold text-gray-500 mb-2">ACTIONS</h4>
                                            <button
                                                onClick={clearLogs}
                                                className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs rounded border border-red-500/20"
                                            >
                                                Clear All Logs
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Logs Tab */
                                    <div className="font-mono text-[10px] space-y-1">
                                        {/* Filter Buttons */}
                                        <div className="flex gap-1 p-2 border-b border-gray-700">
                                            {(['ALL', 'UI', 'STORE', 'NETWORK', 'WORKER'] as const).map(src => (
                                                <button
                                                    key={src}
                                                    onClick={() => setSourceFilter(src)}
                                                    className={`px-2 py-1 text-[9px] rounded ${sourceFilter === src ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-400'
                                                        }`}
                                                >
                                                    {src}
                                                </button>
                                            ))}
                                        </div>


                                        {/* Logs */}
                                        {logs
                                            .filter(log => {
                                                if (sourceFilter === 'ALL') return true;
                                                const match = log.message.match(/^\[(UI|STORE|NETWORK|WORKER)\]/);
                                                return match && match[1] === sourceFilter;
                                            })
                                            .map((log) => (
                                                <div key={log.id} className="flex gap-2 break-all opacity-80 hover:opacity-100">
                                                    <span className="text-gray-600 shrink-0">
                                                        {new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}
                                                    </span>
                                                    <span className={`
                                                font-bold shrink-0 w-20
                                                ${log.level === 'info' ? 'text-blue-400' : ''}
                                                ${log.level === 'warn' ? 'text-yellow-400' : ''}
                                                ${log.level === 'error' ? 'text-red-500' : ''}
                                                ${log.level === 'debug' ? 'text-gray-500' : ''}
                                            `}>
                                                        [{log.source}]
                                                        [{log.source}]
                                                    </span>
                                                    <span className="text-gray-300">{log.message}</span>
                                                </div>
                                            ))}
                                        <div ref={logsEndRef} />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </Portal >
                )
                }
            </AnimatePresence >
        </>
    );
}

function TrafficLight({ label, status, icon: Icon }: { label: string, status: string, icon?: any }) {
    const colorMap: Record<string, string> = {
        idle: 'bg-gray-500',
        working: 'bg-green-500',
        error: 'bg-red-500',
        critical: 'bg-red-600',
        offline: 'bg-gray-700',
        hung: 'bg-orange-500'
    };

    const color = colorMap[status] || 'bg-gray-500';

    return (
        <div className="flex items-center gap-1.5">
            {Icon && <Icon size={12} className="text-gray-500" />}
            <div className={`w-2 h-2 rounded-full ${color} ${status === 'working' ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] text-gray-500">{label}</span>
        </div>
    );
}

function StatusCard({ name, status }: { name: string, status: any }) {
    const colorMap: Record<string, string> = {
        idle: 'bg-gray-500',
        working: 'bg-green-500',
        error: 'bg-red-500',
        offline: 'bg-gray-700',
        hung: 'bg-orange-500'
    };

    const color = colorMap[status.status as string] || 'bg-gray-500';

    return (
        <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-gray-300">{name}</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${color} ${status.status === 'working' ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] uppercase text-gray-500">{status.status}</span>
                </div>
            </div>
            <div className="text-[10px] text-gray-600">
                Last Heartbeat: {new Date(status.lastHeartbeat).toLocaleTimeString()}
            </div>
        </div>
    );
}
