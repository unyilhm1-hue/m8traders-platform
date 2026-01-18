'use client';

import React, { Component, ReactNode } from 'react';
import { useDebugStore } from '@/stores/useDebugStore';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

/**
 * React Error Boundary
 * MODUL 2: Global Observer - React Component Crash Handler
 * 
 * Catches errors in React component tree and prevents blank screen.
 * Logs to Flight Recorder for forensic analysis.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log to Flight Recorder
        const { addLog, captureSnapshot } = useDebugStore.getState();

        addLog('ErrorBoundary', 'error', `React Component Crash: ${error.message}`, {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            componentStack: errorInfo.componentStack,
            type: 'react_crash'
        });

        // Capture snapshot of current state
        captureSnapshot('errorState', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });

        // Also log to console
        console.error('[ErrorBoundary] Component crashed:', error, errorInfo);

        this.setState({ errorInfo });
    }

    private handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] text-white p-8">
                    <div className="max-w-2xl w-full bg-[#1a1d24] border border-red-500/20 rounded-xl p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-red-500">Component Error</h1>
                                <p className="text-gray-400 text-sm">Something went wrong in the React component tree</p>
                            </div>
                        </div>

                        <div className="bg-black/50 p-4 rounded-lg mb-6 font-mono text-sm">
                            <div className="text-red-400 mb-2">{this.state.error?.name}: {this.state.error?.message}</div>
                            <div className="text-gray-500 text-xs overflow-auto max-h-40">
                                {this.state.error?.stack}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition"
                            >
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                            >
                                Reload Page
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-700">
                            <p className="text-xs text-gray-500">
                                💡 Tip: Open the Flight Recorder (Debug Panel) to see full error logs and diagnostics.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
