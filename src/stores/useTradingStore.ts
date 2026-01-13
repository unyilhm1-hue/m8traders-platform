/**
 * Trading Store - Manages trading session state
 * (balance, positions, trades, stats)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { Position, Trade, TradingStats, OrderRequest, OrderResult } from '@/types';

interface TradingState {
    // State
    balance: number;
    startingBalance: number;
    position: Position;
    trades: Trade[];
    stats: TradingStats;

    // Actions
    executeTrade: (order: OrderRequest, currentPrice: number) => OrderResult;
    closePosition: (currentPrice: number) => OrderResult;
    resetSession: () => void;
    setStartingBalance: (balance: number) => void;
}

const INITIAL_BALANCE = 100000;

const EMPTY_POSITION: Position = {
    shares: 0,
    avgPrice: 0,
    totalCost: 0,
};

const calculateStats = (trades: Trade[], balance: number, startingBalance: number): TradingStats => {
    const completedTrades = trades.filter((t) => t.realizedPnL !== undefined);
    const wins = completedTrades.filter((t) => (t.realizedPnL ?? 0) > 0);
    const losses = completedTrades.filter((t) => (t.realizedPnL ?? 0) < 0);

    const avgWin = wins.length > 0
        ? wins.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0) / wins.length
        : 0;
    const avgLoss = losses.length > 0
        ? Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0) / losses.length)
        : 0;

    const totalWin = wins.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);
    const totalLoss = Math.abs(losses.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0));

    return {
        balance,
        position: EMPTY_POSITION,
        unrealizedPnL: { absolute: 0, percentage: 0 },
        totalEquity: balance,
        totalReturn: ((balance - startingBalance) / startingBalance) * 100,
        totalTrades: completedTrades.length,
        winRate: completedTrades.length > 0 ? (wins.length / completedTrades.length) * 100 : 0,
        avgWin,
        avgLoss,
        profitFactor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    };
};

const initialState = {
    balance: INITIAL_BALANCE,
    startingBalance: INITIAL_BALANCE,
    position: EMPTY_POSITION,
    trades: [] as Trade[],
    stats: calculateStats([], INITIAL_BALANCE, INITIAL_BALANCE),
};

export const useTradingStore = create<TradingState>()(
    persist(
        immer((set, get) => ({
            ...initialState,

            executeTrade: (order, currentPrice) => {
                const state = get();
                const { type, shares } = order;
                const price = currentPrice;
                const total = shares * price;

                // Validation
                if (shares <= 0) {
                    return { success: false, error: 'Jumlah saham harus lebih dari 0' };
                }

                if (type === 'BUY') {
                    if (total > state.balance) {
                        return { success: false, error: 'Saldo tidak mencukupi' };
                    }

                    const trade: Trade = {
                        id: nanoid(),
                        type: 'BUY',
                        shares,
                        price,
                        total,
                        timestamp: Date.now(),
                    };

                    set((s) => {
                        // Update balance
                        s.balance -= total;

                        // Update position
                        const newTotalCost = s.position.totalCost + total;
                        const newShares = s.position.shares + shares;
                        s.position = {
                            shares: newShares,
                            avgPrice: newTotalCost / newShares,
                            totalCost: newTotalCost,
                        };

                        // Add trade
                        s.trades.push(trade);

                        // Update stats
                        s.stats = calculateStats(s.trades, s.balance, s.startingBalance);
                    });

                    return { success: true, trade, newBalance: get().balance, newPosition: get().position };
                }

                if (type === 'SELL') {
                    if (shares > state.position.shares) {
                        return { success: false, error: 'Tidak cukup saham untuk dijual' };
                    }

                    const realizedPnL = (price - state.position.avgPrice) * shares;

                    const trade: Trade = {
                        id: nanoid(),
                        type: 'SELL',
                        shares,
                        price,
                        total,
                        realizedPnL,
                        timestamp: Date.now(),
                    };

                    set((s) => {
                        // Update balance
                        s.balance += total;

                        // Update position
                        const newShares = s.position.shares - shares;
                        if (newShares === 0) {
                            s.position = EMPTY_POSITION;
                        } else {
                            s.position.shares = newShares;
                            s.position.totalCost = newShares * s.position.avgPrice;
                        }

                        // Add trade
                        s.trades.push(trade);

                        // Update stats
                        s.stats = calculateStats(s.trades, s.balance, s.startingBalance);
                    });

                    return { success: true, trade, newBalance: get().balance, newPosition: get().position };
                }

                return { success: false, error: 'Invalid order type' };
            },

            closePosition: (currentPrice) => {
                const state = get();
                if (state.position.shares === 0) {
                    return { success: false, error: 'Tidak ada posisi untuk ditutup' };
                }
                return state.executeTrade(
                    { type: 'SELL', shares: state.position.shares, price: currentPrice },
                    currentPrice
                );
            },

            resetSession: () =>
                set((s) => {
                    s.balance = s.startingBalance;
                    s.position = EMPTY_POSITION;
                    s.trades = [];
                    s.stats = calculateStats([], s.startingBalance, s.startingBalance);
                }),

            setStartingBalance: (balance) =>
                set((s) => {
                    s.startingBalance = balance;
                    s.balance = balance;
                    s.position = EMPTY_POSITION;
                    s.trades = [];
                    s.stats = calculateStats([], balance, balance);
                }),
        })),
        {
            name: 'm8traders-trading',
            partialize: (state) => ({
                balance: state.balance,
                startingBalance: state.startingBalance,
                position: state.position,
                trades: state.trades,
            }),
        }
    )
);

// Selector hooks for performance
export const useBalance = () => useTradingStore((s) => s.balance);
export const usePosition = () => useTradingStore((s) => s.position);
export const useTrades = () => useTradingStore((s) => s.trades);
export const useTradingStats = () => useTradingStore((s) => s.stats);
