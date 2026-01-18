/**
 * ScenarioSelector Component
 * Allows users to select and load frozen historical scenarios for practice trading
 */
'use client';

import { useState, useEffect } from 'react';
import { useChartStore } from '@/stores';
import { listScenarios, loadScenario } from '@/lib/scenario/scenarioManager';
import type { ScenarioDefinition } from '@/types/scenario';
import { useSimulationEngineContext } from '@/contexts/SimulationEngineContext';

interface ScenarioSelectorProps {
    className?: string;
}

export function ScenarioSelector({ className = '' }: ScenarioSelectorProps) {
    const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedScenario, setSelectedScenario] = useState<ScenarioDefinition | null>(null);

    const { setReplayMode, setReplayData, replayMode } = useChartStore();

    // ✅ Use Engine Context
    const { engine } = useSimulationEngineContext();

    // Load scenarios on mount
    useEffect(() => {
        loadScenarioList();
    }, []);

    const loadScenarioList = async () => {
        try {
            const list = await listScenarios();
            setScenarios(list);
        } catch (error) {
            console.error('[ScenarioSelector] Failed to load scenarios:', error);
        }
    };

    const handleSelectScenario = async (scenario: ScenarioDefinition) => {
        setLoading(true);
        try {
            console.log(`[ScenarioSelector] Selecting scenario: ${scenario.name} (${scenario.id})`);

            setReplayMode('scenario');
            setSelectedScenario(scenario);

            setReplayData([]);

            if (engine) {
                engine.loadScenario(scenario.id);
            } else {
                console.error('[ScenarioSelector] Engine not ready, cannot load scenario');
            }

        } catch (error) {
            console.error('[ScenarioSelector] Failed to select scenario:', error);
            setReplayMode('live'); // Revert
        } finally {
            setLoading(false);
            setIsOpen(false);
        }
    };

    const handleClearScenario = () => {
        setReplayMode('1y'); // Back to default mode
        setReplayData([]);   // 🔥 FIX: Clear replay data
        setSelectedScenario(null);
        // Optionally reset index if store exposes it, but clearing data usually suffices or chart handles it
    };

    // Always show the selector, even if empty, to allow users to see the feature exists
    // and potentially prompt them to create scenarios.

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedScenario
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] border border-[var(--bg-tertiary)]'
                    }`}
                disabled={loading}
            >
                {loading ? (
                    <span className="text-xs">Loading...</span>
                ) : selectedScenario ? (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="max-w-[120px] truncate">{selectedScenario.name}</span>
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>Scenarios</span>
                    </>
                )}
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Content */}
                    <div className="absolute top-full right-0 mt-1 w-96 bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] rounded-lg shadow-lg z-20 max-h-[500px] flex flex-col">
                        {/* Header */}
                        <div className="p-3 border-b border-[var(--bg-tertiary)]">
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                                Frozen Scenarios
                            </h3>
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                                Practice with historical data
                            </p>
                        </div>

                        {/* Scenario List */}
                        <div className="overflow-y-auto flex-1 p-2">
                            {scenarios.length === 0 ? (
                                <div className="p-4 text-center">
                                    <p className="text-sm text-[var(--text-tertiary)] mb-2">
                                        No scenarios available yet
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)]">
                                        Create scenarios via Batch Downloader
                                    </p>
                                </div>
                            ) : (
                                scenarios.map((scenario) => (
                                    <ScenarioItem
                                        key={scenario.id}
                                        scenario={scenario}
                                        isActive={selectedScenario?.id === scenario.id}
                                        onClick={() => handleSelectScenario(scenario)}
                                    />
                                ))
                            )}
                        </div>

                        {/* Footer Actions */}
                        {selectedScenario && (
                            <div className="p-2 border-t border-[var(--bg-tertiary)]">
                                <button
                                    onClick={handleClearScenario}
                                    className="w-full px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                                >
                                    Clear Scenario
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

interface ScenarioItemProps {
    scenario: ScenarioDefinition;
    isActive: boolean;
    onClick: () => void;
}

function ScenarioItem({ scenario, isActive, onClick }: ScenarioItemProps) {
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const getDifficultyColor = (difficulty?: string) => {
        switch (difficulty) {
            case 'easy': return 'bg-green-500/20 text-green-400';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400';
            case 'hard': return 'bg-red-500/20 text-red-400';
            default: return 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]';
        }
    };

    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 rounded-lg transition-colors ${isActive
                ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]'
                : 'hover:bg-[var(--bg-tertiary)] border border-transparent'
                }`}
        >
            {/* Name & Ticker */}
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-medium truncate ${isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                        }`}>
                        {scenario.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-[var(--text-secondary)]">
                            {scenario.ticker}
                        </span>
                        <span className="text-xs text-[var(--text-tertiary)]">•</span>
                        <span className="text-xs text-[var(--text-tertiary)]">
                            {scenario.interval}
                        </span>
                    </div>
                </div>
                {isActive && (
                    <svg className="w-5 h-5 text-[var(--accent-primary)] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                )}
            </div>

            {/* Date Range */}
            <div className="text-xs text-[var(--text-tertiary)] mb-2">
                {formatDate(scenario.startTimestamp)} → {formatDate(scenario.endTimestamp)}
            </div>

            {/* Tags & Stats */}
            <div className="flex items-center gap-2 flex-wrap">
                {scenario.metadata?.difficulty && (
                    <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyColor(scenario.metadata.difficulty)}`}>
                        {scenario.metadata.difficulty}
                    </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                    {scenario.totalCandles.toLocaleString()} candles
                </span>
                {scenario.metadata?.tags?.slice(0, 2).map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                        #{tag}
                    </span>
                ))}
            </div>

            {/* Description (if exists) */}
            {scenario.metadata?.description && (
                <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2">
                    {scenario.metadata.description}
                </p>
            )}
        </button>
    );
}
