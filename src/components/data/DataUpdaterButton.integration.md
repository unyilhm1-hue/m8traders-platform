# DataUpdaterButton Integration Guide

## Component Location

[`src/components/data/DataUpdaterButton.tsx`](file:///c:/Users/laras/.gemini/antigravity/scratch/m8traders-platform/src/components/data/DataUpdaterButton.tsx)

---

## Features

✅ **Data Freshness Indicator**
- 🟢 Fresh (<1h old): ✓ green
- 🟡 Stale (1-24h): ⚠ yellow  
- 🔴 Very Stale (>24h): ⨯ red
- ⚪ Empty: ○ gray

✅ **Update Progress**
- Animated spinner during update
- Disabled state while updating
- Clear button states

✅ **Result Feedback**
- Success: green banner with candle count
- No update: yellow info banner
- Error: red error banner with message
- Auto-dismiss after 5 seconds

---

## Integration Options

### ✅ Option 1: Dashboard (Admin-Only) - **IMPLEMENTED**

Button is now integrated in dashboard with admin email protection.

**Location**: [`src/app/(protected)/dashboard/page.tsx`](file:///c:/Users/laras/.gemini/antigravity/scratch/m8traders-platform/src/app/(protected)/dashboard/page.tsx)

**Access**: Only visible for admin emails (configured in dashboard)

**Admin Configuration**: See [`ADMIN_CONFIG.md`](file:///c:/Users/laras/.gemini/antigravity/scratch/m8traders-platform/ADMIN_CONFIG.md) to add/update admin emails.

---

### Option 2: Add to Chart Controls

Add button to existing chart controls/toolbar.

**File**: `src/components/chart/ChartControls.tsx` (or similar)

```tsx
import { DataUpdaterButton } from '@/components/data/DataUpdaterButton';

export function ChartControls() {
    return (
        <div className="chart-controls flex items-center gap-4">
            {/* Existing controls */}
            <IntervalSelector />
            <TickerSelector />
            
            {/* NEW: Data Updater */}
            <div className="ml-auto">
                <DataUpdaterButton />
            </div>
        </div>
    );
}
```

---

### Option 2: Add to Settings Panel

If you have a settings/tools panel:

```tsx
import { DataUpdaterButton } from '@/components/data/DataUpdaterButton';

export function SettingsPanel() {
    return (
        <div className="settings-panel">
            <h3>Data Management</h3>
            <DataUpdaterButton />
        </div>
    );
}
```

---

### Option 3: Floating Action Button (FAB)

For minimal UI, add as floating button:

```tsx
import { DataUpdaterButton } from '@/components/data/DataUpdaterButton';

export function ChartPage() {
    return (
        <div className="relative">
            {/* Chart */}
            <TradingChart />
            
            {/* Floating Data Updater */}
            <div className="absolute bottom-4 right-4 z-10">
                <DataUpdaterButton />
            </div>
        </div>
    );
}
```

---

## Customization

### Styling

Component uses Tailwind. Customize colors/sizing:

```tsx
// Button size
className="px-4 py-2 text-base"  // Larger
className="px-2 py-1 text-xs"    // Smaller

// Button color
className="bg-purple-600 hover:bg-purple-700"  // Purple theme
className="bg-gradient-to-r from-blue-600 to-purple-600"  // Gradient
```

### Compact Mode

Hide freshness indicator for minimal UI:

```tsx
export function DataUpdaterButton({ compact = false }) {
    // ...
    return (
        <div>
            {!compact && (
                <div className="freshness-indicator">...</div>
            )}
            <button>...</button>
        </div>
    );
}
```

---

## Testing

### Manual Test

1. **Open dev server**: `npm run dev`
2. **Open chart page** with button integrated
3. **Check freshness indicator**:
   - Should show current data age
   - Color should match staleness (green/yellow/red)
4. **Click "Update Data"**:
   - Button shows spinner
   - Console shows update logs
   - Result banner appears
5. **Verify chart updates** (if viewing updated ticker)

### Console Test (Fallback)

If UI integration takes time, test via console:

```js
// Open browser console
const store = useSimulationStore.getState();

// Manual trigger
const result = await store.updateData('BBRI', '1m');
console.log(result);
```

---

## Troubleshooting

### Button Disabled / Gray

**Cause**: freshness.status === 'empty'  
**Fix**: Load initial data first (`loadWithSmartBuffer`)

```js
// Load initial data
await store.loadWithSmartBuffer('BBRI', new Date(), '1m');
```

### "No local data" Error

**Cause**: `rawSources` doesn't have data for ticker  
**Fix**: Same as above, ensure data loaded before updating

### API 404 Error

**Cause**: Server file doesn't exist  
**Fix**: Create server data files (see `setup-test-data.md`)

```powershell
mkdir public\simulation-data\server
copy public\simulation-data\BBRI_1m_MASTER.json public\simulation-data\server\BBRI_1m_SERVER.json
```

---

## Next Steps

1. **Choose integration location** (Chart controls recommended)
2. **Import component**
3. **Add to JSX**
4. **Test update flow**
5. **(Optional)** Set up test data directories for realistic testing

---

## Advanced: Auto-Update Service

For background updates, see [`DataUpdater.example.tsx`](file:///c:/Users/laras/.gemini/antigravity/scratch/m8traders-platform/src/utils/DataUpdater.example.tsx) for `AutoUpdateService` class.

**Quick setup:**

```tsx
import { AutoUpdateService } from '@/utils/DataUpdater.example';

// In component mount
useEffect(() => {
    const service = new AutoUpdateService();
    service.start(60 * 60 * 1000);  // Every 1 hour
    
    return () => service.stop();
}, []);
```
