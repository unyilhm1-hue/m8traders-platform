/**
 * Feature Flags
 * Control experimental and progressive features
 */

export const FEATURE_FLAGS = {
    /** 
     * Strict time SSoT validation
     * - When TRUE: throws errors on invalid timestamps/fallbacks
     * - When FALSE: logs warnings only (default in production)
     * 
     * Set via environment variable: NEXT_PUBLIC_TIME_SSOT_STRICT
     */
    TIME_SSOT_STRICT: process.env.NEXT_PUBLIC_TIME_SSOT_STRICT === 'true',
} as const;

// Type for feature flag keys
export type FeatureFlag = keyof typeof FEATURE_FLAGS;

// Helper to check if a flag is enabled
export function isFeatureEnabled(flag: FeatureFlag): boolean {
    return FEATURE_FLAGS[flag];
}
