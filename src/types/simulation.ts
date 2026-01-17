/**
 * Simulation and Physics Engine Types
 */

export interface TickData {
    price: number;
    volume: number;
    timestamp: number;
    candleIndex: number;
    tickIndex: number;
}
