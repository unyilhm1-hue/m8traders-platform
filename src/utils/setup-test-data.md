# Data Setup Helper Script

This script helps set up the test data directories for Data Updater testing.

## Quick Setup (Manual)

```bash
# Create directories
mkdir -p public/simulation-data/server
mkdir -p public/simulation-data/baseline
mkdir -p public/simulation-data/patches

# Copy existing MASTER file to server (as SERVER source)
# (Do this for each ticker you want to test)
cp public/simulation-data/BBRI_1m_MASTER.json public/simulation-data/server/BBRI_1m_SERVER.json

# For baseline (client default load), you can:
# Option A: Use same file (creates baseline)
cp public/simulation-data/BBRI_1m_MASTER.json public/simulation-data/baseline/BBRI_1m_BASELINE.json

# Option B: Create truncated version for testing boundary repair
# (Use Node/Python script to truncate to specific date/time)
```

## Testing Scenarios

### Scenario A: Boundary Repair Test (Simplest)

**Goal**: Test that updater can repair incomplete day

**Setup**:
1. Server has full 15 Jan data (00:00 - 16:00)
2. Client baseline is truncated to 15 Jan 10:00

**Script** (Node.js):
```javascript
// truncate-baseline.js
const fs = require('fs');

const serverData = JSON.parse(fs.readFileSync('public/simulation-data/server/BBRI_1m_SERVER.json'));

// Truncate to 15 Jan 10:00 AM (adjust timestamp as needed)
const cutoffTime = new Date('2025-01-15T10:00:00+07:00').getTime();  // ms
const truncated = serverData.filter(c => c.t <= cutoffTime);

fs.writeFileSync(
    'public/simulation-data/baseline/BBRI_1m_BASELINE.json',
    JSON.stringify(truncated, null, 2)
);

console.log(`Truncated: ${serverData.length} -> ${truncated.length} candles`);
console.log(`Last candle: ${new Date(truncated[truncated.length-1].t).toLocaleString()}`);
```

**Run**:
```bash
node truncate-baseline.js
```

### Scenario B: Append Forward Test

**Goal**: Test adding new days (16-19 Jan)

**Setup**:
1. Baseline = full 15 Jan
2. Server = 15 Jan + synthetic 16-19 Jan

**Note**: For this scenario, you need to create synthetic patch data or wait for real data 16-19 Jan to exist.

## Automated PowerShell Script

```powershell
# setup-test-data.ps1

Write-Host "Setting up Data Updater test directories..." -ForegroundColor Cyan

# Create directories
$dirs = @(
    "public/simulation-data/server",
    "public/simulation-data/baseline",
    "public/simulation-data/patches"
)

foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "Exists: $dir" -ForegroundColor Yellow
    }
}

# Copy MASTER to SERVER (if exists)
$masterFile = "public/simulation-data/BBRI_1m_MASTER.json"
$serverFile = "public/simulation-data/server/BBRI_1m_SERVER.json"

if (Test-Path $masterFile) {
    Copy-Item $masterFile $serverFile -Force
    Write-Host "Copied MASTER -> SERVER" -ForegroundColor Green
} else {
    Write-Host "WARNING: $masterFile not found" -ForegroundColor Red
}

# For baseline, use same file initially
$baselineFile = "public/simulation-data/baseline/BBRI_1m_BASELINE.json"
if (Test-Path $masterFile) {
    Copy-Item $masterFile $baselineFile -Force
    Write-Host "Copied MASTER -> BASELINE" -ForegroundColor Green
}

Write-Host "`nSetup complete!" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Truncate BASELINE file to create gap (use Node script above)"
Write-Host "2. Test update via UI button or store action"
```

**Run**:
```powershell
.\setup-test-data.ps1
```

## Verification

After setup, verify file structure:

```bash
ls -R public/simulation-data/
```

Expected:
```
public/simulation-data/
├── BBRI_1m_MASTER.json      # Original
├── baseline/
│   └── BBRI_1m_BASELINE.json
├── server/
│   └── BBRI_1m_SERVER.json
└── patches/
    └── (optional) BBRI_1m_PATCH_16-19.json
```
