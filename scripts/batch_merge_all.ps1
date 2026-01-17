# PowerShell script untuk batch merge semua stock data
# Dengan proper UTF-8 encoding handling

$ErrorActionPreference = "Continue"
$dataDir = "public\simulation-data"
$scriptPath = "scripts\merge_stock_data.py"

# Set encoding untuk console dan subprocess
$env:PYTHONIOENCODING = 'utf-8'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "`n"
Write-Host "=" * 62
Write-Host "  BATCH MERGE ALL STOCK DATA (PowerShell)"
Write-Host "=" * 62
Write-Host "`nData Directory: $dataDir"
Write-Host "Merge Script  : $scriptPath`n"

# Scan untuk kombinasi ticker + interval
Write-Host "Scanning for ticker + interval combinations...`n"

$files = Get-ChildItem -Path $dataDir -Filter "*.json" | 
    Where-Object { $_.Name -notmatch "(MERGED|COMBINED|days|_full_)" } |
    Where-Object { $_.Name -match '^([A-Z]+)_(\d+[mh])_\d{4}-\d{2}-\d{2}\.json$' }

$combinations = @{}
foreach ($file in $files) {
    if ($file.Name -match '^([A-Z]+)_(\d+[mh])_') {
        $ticker = $matches[1]
        $interval = $matches[2]
        
        if (-not $combinations.ContainsKey($ticker)) {
            $combinations[$ticker] = @()
        }
        if ($combinations[$ticker] -notcontains $interval) {
            $combinations[$ticker] += $interval
        }
    }
}

# Sort dan tampilkan
$sortedTickers = $combinations.Keys | Sort-Object
$totalCombinations = 0

Write-Host "Found $($combinations.Count) tickers with various intervals:`n"
foreach ($ticker in $sortedTickers) {
    $intervals = $combinations[$ticker] | Sort-Object
    $totalCombinations += $intervals.Count
    Write-Host ("  {0,-10} -> [ {1} ]" -f $ticker, ($intervals -join ', '))
}

Write-Host "`nTotal combinations: $totalCombinations`n"

# Konfirmasi
$confirm = Read-Host "Process all $totalCombinations combinations? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "`nCancelled by user."
    exit 0
}

Write-Host "`nStarting batch merge...`n"

# Process each combination
$successCount = 0
$failedCount = 0
$failedItems = @()

foreach ($ticker in $sortedTickers) {
    foreach ($interval in ($combinations[$ticker] | Sort-Object)) {
        Write-Host "`n$('=' * 60)"
        Write-Host "PROCESSING: $ticker @ $interval"
        Write-Host "$('=' * 60)`n"
        
        try {
            # Run merge script
            $output = & python $scriptPath $ticker $interval $dataDir 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] $ticker`_$interval" -ForegroundColor Green
                $successCount++
            } else {
                Write-Host "[FAIL] $ticker`_$interval" -ForegroundColor Red
                $failedCount++
                $failedItems += "$ticker`_$interval"
                
                # Show error output
                if ($output) {
                    Write-Host "Error output:" -ForegroundColor Yellow
                    Write-Host $output
                }
            }
        } catch {
            Write-Host "[ERROR] $ticker`_$interval : $_" -ForegroundColor Red
            $failedCount++
            $failedItems += "$ticker`_$interval"
        }
    }
}

# Summary
Write-Host "`n`n"
Write-Host "=" * 62
Write-Host "  BATCH MERGE SUMMARY"
Write-Host "=" * 62
Write-Host "`nTotal Processed  : $($successCount + $failedCount)"
Write-Host "Success          : $successCount" -ForegroundColor Green
Write-Host "Failed           : $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { 'Green' } else { 'Red' })

if ($failedItems.Count -gt 0) {
    Write-Host "`nFailed Items:" -ForegroundColor Yellow
    foreach ($item in $failedItems) {
        Write-Host "  X $item" -ForegroundColor Red
    }
}

Write-Host "`n[DONE] Batch merge completed!`n" -ForegroundColor Cyan
