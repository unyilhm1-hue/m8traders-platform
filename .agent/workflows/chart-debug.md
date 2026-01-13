---
description: Debug KLineChart rendering, data, or interaction issues
---

# Chart Debug Workflow

Untuk mendiagnosa dan memperbaiki masalah terkait KLineChart.

---

## Step 1: Identify Issue Category

```
Chart tidak tampil?     → Section A
Data tidak muncul?      → Section B  
Indicator error?        → Section C
Drawing tool issue?     → Section D
Performance lambat?     → Section E
```

---

## Section A: Chart Tidak Tampil

**Checklist**:
- [ ] Container punya width & height (cek CSS)
- [ ] `init()` dipanggil setelah DOM ready (useEffect)
- [ ] `dispose()` dipanggil di cleanup
- [ ] Tidak ada error di console

**Debug Steps**:
```typescript
// 1. Cek container dimensions
console.log('Container size:', chartRef.current?.offsetWidth, chartRef.current?.offsetHeight);

// 2. Cek chart instance
console.log('Chart instance:', chartInstance.current);

// 3. Verify init
const chart = init(container, {
  styles: {
    grid: { show: true }  // Temporary grid untuk debug
  }
});
console.log('Chart created:', chart);
```

---

## Section B: Data Tidak Muncul

**Checklist**:
- [ ] Data format sesuai KLineData
- [ ] Timestamp dalam milliseconds
- [ ] Data ada (length > 0)
- [ ] `applyNewData()` atau `updateData()` dipanggil

**Debug Steps**:
```typescript
// 1. Log data yang diterima
console.log('Candles received:', candles.length, candles[0]);

// 2. Verify format
const klineData = candles.map(c => ({
  timestamp: c.t,      // Harus number (ms)
  open: c.o,           // Harus number
  high: c.h,
  low: c.l,
  close: c.c,
  volume: c.v
}));
console.log('KLineData sample:', klineData[0]);

// 3. Apply dan cek
chart.applyNewData(klineData);
console.log('Data applied, current data count:', chart.getDataList().length);
```

**Common Issues**:
- Timestamp dalam seconds (bukan ms) → kalikan 1000
- String values bukan number → parse dulu
- Array kosong → cek data fetching

---

## Section C: Indicator Error

**Checklist**:
- [ ] Indicator name benar (lihat docs)
- [ ] Enough data untuk period (minimal = period length)
- [ ] No duplicate indicator IDs

**Debug Steps**:
```typescript
// 1. List available indicators
console.log('Built-in indicators:', chart.getIndicatorClass());

// 2. Create with logging
try {
  chart.createIndicator('MA', false, { 
    id: 'ma-20',
    calcParams: [20]
  });
  console.log('MA created successfully');
} catch (e) {
  console.error('Indicator error:', e);
}

// 3. Check existing
console.log('Active indicators:', chart.getIndicatorInfo());
```

---

## Section D: Drawing Tool Issue

**Checklist**:
- [ ] Drawing mode enabled
- [ ] Click handlers active
- [ ] Coordinates mapping correct

**Debug Steps**:
```typescript
// 1. Check overlay info
chart.createOverlay('segment', {
  onDrawStart: () => console.log('Draw start'),
  onDrawEnd: (event) => console.log('Draw end:', event),
});

// 2. Get drawings
console.log('Current overlays:', chart.getOverlayById());
```

---

## Section E: Performance Issues

**Checklist**:
- [ ] Data points < 5000 (recommended)
- [ ] No memory leaks (dispose called)
- [ ] Resize debounced

**Debug Steps**:
```typescript
// 1. Check data size
console.log('Data count:', chart.getDataList().length);

// 2. Enable performance mode
chart.applyNewData(data, true);  // true = more

// 3. Profile
console.time('chart-update');
chart.applyNewData(newData);
console.timeEnd('chart-update');
```

---

## Quick Fixes

| Issue | Solution |
|-------|----------|
| Chart blank | Set explicit height on container |
| No candles | Check timestamp format (use ms) |
| Indicator NaN | Ensure enough data points |
| Memory leak | Call dispose() in useEffect cleanup |
| Slow resize | Debounce resize handler (200ms) |

---

**Last Updated**: 2026-01-12
