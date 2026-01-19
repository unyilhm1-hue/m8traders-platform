# Time & Interval SSoT Contract

Single Source of Truth (SSoT) for time units and interval passing across the m8traders-platform data pipeline.

## Boundary Contract

| Layer | Unit | Enforcement | Notes |
|-------|------|-------------|-------|
| Worker internal (`chart.worker.ts`) | **milliseconds** | `assertMilliseconds` (Phase 2+) | Tick scheduling requires ms precision |
| Resampler output | **seconds** | `assertSeconds` (Phase 2+) | Matches LWC requirement |
| Store `candleHistory` | **seconds** | `assertSeconds` (Phase 2+) | Consistent with chart display |
| Chart candle time | **seconds** | Implicit (LWC requirement) | Lightweight Charts v4 UTCTimestamp |

## Conversion Points

### Input Boundary (Raw Data Load)
- **Location**: API route, data loader
- **Format**: May be ms or s depending on source
- **Action**: Normalize to **seconds** before storing

### Worker Internal
- **Location**: `chart.worker.ts` tick generation
- **Format**: Always **ms** for precise scheduling
- **Action**: Multiply by 1000 when receiving seconds

### Worker Output
- **Location**: `CANDLE_UPDATE`, `TICK` messages
- **Format**: Always **seconds** for chart consumption
- **Action**: Divide by 1000 before broadcasting

### Store State
- **Location**: `useSimulationStore` candleHistory
- **Format**: Always **seconds** for consistency
- **Action**: Validate and assert on updates

## Interval Passing

### Before Phase 1 (Legacy)
- Worker defaulted to `'1m'` if interval not provided
- Silent fallback masked configuration issues

### After Phase 1 (Observability)
- API always sends `interval` field
- Legacy autoLoad passes `interval` from API
- Worker logs `[SSoT] INTERVAL FALLBACK` warning if missing

### Phase 2+ (Strict Mode)
- Feature flag `TIME_SSOT_STRICT` controls validation
- Missing interval can throw error in strict mode

## Fallback Behavior by Phase

### Phase 1 (Current - Observability)
- **Status**: All fallbacks remain functional
- **Logging**: Warnings logged with `[SSoT]` prefix
- **Purpose**: Make hidden behavior visible

Example warnings:
```
[SSoT] INTERVAL FALLBACK: No interval provided in smart buffer init, defaulting to 1m
[SSoT] TIME FALLBACK: parseTime received undefined/null, using Date.now()
```

### Phase 2 (Feature Flag - Strict Mode)
- **Status**: Conditional based on `NEXT_PUBLIC_TIME_SSOT_STRICT`
- **Strict ON**: Fallbacks throw errors
- **Strict OFF**: Fallbacks warn (default in prod)
- **Purpose**: Test strict validation in dev/staging

### Phase 3 (Enforcement)
- **Status**: All fallbacks removed or throw unconditionally
- **Purpose**: Zero tolerance for invalid data

---

## Implementation Checklist

- [x] **Phase 1**: Observability
  - [x] Worker telemetry for interval fallbacks
  - [x] Resampler warnings for time fallbacks
  - [x] API always sends interval
  - [x] Legacy autoLoad passes interval
- [ ] **Phase 2**: Feature flag
  - [ ] Create `TIME_SSOT_STRICT` flag
  - [ ] Wrap fallbacks with conditional logic
  - [ ] Add assertion utilities
- [ ] **Phase 3**: Enforcement
  - [ ] Enable strict mode in production
  - [ ] Remove fallback code
  - [ ] Clean up data sources

---

## Quick Reference

**Grep for fallbacks**:
```bash
grep -r "\[SSoT\]" src/
```

**Test strict mode locally**:
```bash
# .env.development
NEXT_PUBLIC_TIME_SSOT_STRICT=true
```

**Validate timestamps**:
```typescript
import { assertSeconds, assertMilliseconds } from '@/utils/timeAssertions';

// Before storing in candleHistory
assertSeconds(candle.time, 'candleHistory update');

// Before worker tick generation
assertMilliseconds(candle.t, 'worker tick scheduling');
```
