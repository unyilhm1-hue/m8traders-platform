---
name: lwc4-app-router-trading-debugger
description: Playbook debugging & hardening untuk trading chart/simulator realtime berbasis Next.js App Router + React + Zustand/Redux + Web Worker, dengan Lightweight Charts v4 sebagai charting engine dan Unix Seconds sebagai single source of truth untuk timestamp.
---

# LWC4 + App Router Trading Debugger

Skill ini memandu diagnosa dan perbaikan bug pada sistem charting/trading simulator realtime yang menggunakan:
- **Next.js App Router**
- **Lightweight Charts v4**
- **Unix Timestamp (seconds) sebagai Single Source of Truth (SSoT) di seluruh aplikasi**
- State management (Zustand/Redux), Web Worker, time-series OHLCV, performance batching, dan observability.

## When to use this skill

Gunakan skill ini ketika:
- Switching interval/timeframe (1m ↔ 2m ↔ 5m) menyebabkan freeze/delay, `past update skipped`, atau chart “not ready”.
- Update realtime tidak konsisten (loncat, reorder, duplikat).
- Ada “zombie ticks” (event dari sesi lama masuk sesi baru).
- Bug hanya muncul di Dev (React StrictMode / App Router re-mounting).
- App Router navigation menyebabkan chart reset state/cleanup tidak sempurna.

## Core constraints (project-specific, non-negotiable)

### Time SSoT: Unix Seconds
- Semua timestamp internal aplikasi adalah **Unix seconds (integer)**.
- Tidak boleh ada ms di path utama data.
- Konversi boleh dilakukan hanya di boundary integrasi tertentu (mis. library/API eksternal), lalu **kembali ke seconds**.

### Lightweight Charts v4 time contract
- Untuk LWC v4, gunakan **UTCTimestamp dalam seconds** untuk `time`.
- Pastikan `time` bersifat primitif (number), bukan object (hindari "last time=[object Object]").

Recommended types/conventions:
- `type Sec = number; // integer seconds`
- `type UTCSec = import('lightweight-charts').UTCTimestamp;`
- Saat setData/update: `time: sec as UTCTimestamp`

### Next.js App Router
- Boundary client component harus eksplisit: chart harus berada dalam file yang memakai `"use client"`.
- App Router dapat memicu re-mount yang berbeda dibanding Pages Router; cleanup (unsubscribe, cancel RAF/timer) wajib rapat.

---

# Inputs required

1) Repro steps detail (interval awal/tujuan, play/pause, anchor time, expected vs actual).
2) Log/stack trace: `Ignoring past update`, `Chart not ready yet`, callstack.
3) Kode minimal:
   - Chart component (setData/update pipeline, readiness lock, RAF batching)
   - Store (switchInterval, epoch/session, currentCandle/currentTick, queue)
   - Engine (bridge worker → store, pause/resume, INIT_DATA)
   - Worker (message contract, epoch, interval map)
   - Orchestrator UI (App Router page/segment yang memicu switching)

---

# Success criteria

- Switching interval (naik/turun) tidak memicu spam `past update skipped`.
- Waktu “chart not ready” < ~500ms–1500ms (tergantung window), bukan 6–10 detik.
- Tidak ada zombie update setelah interval/symbol switch (epoch gating efektif).
- Invariants time-series terjaga (monotonic):
  - history ascending
  - realtime update: hanya `t == lastTime` atau `t > lastTime`
  - `t < lastTime` hanya boleh terjadi pada transisi dan harus **drop tanpa efek samping**
- Observability jelas: sequence event switch dapat ditelusuri.

---

# Workflow (Step-by-step)

## Step 1 — Classify bug
- **Lifecycle/App Router**: remount, stale closure, StrictMode double invoke.
- **State**: atomic update gagal, subscribe terlalu luas, race.
- **Data**: resampling/alignment salah, seconds vs ms mismatch.
- **Worker**: contract epoch tidak konsisten, pause/resume tidak memutus pipeline.
- **Performance**: setData/postMessage terlalu besar.
- **Observability**: log tidak membuktikan timeline.

## Step 2 — Establish invariants (hard checks)

### Seconds invariant (SSoT)
- Semua `time` yang melewati store/engine/worker/chart harus:
  - `Number.isInteger(time) === true`
  - `time > 0`
- Tidak boleh ada ms: `(time > 10_000_000_000)` biasanya indikasi ms (opsional rule of thumb).

### LWC monotonic invariant
- `setData` harus ascending.
- `update`:
  - `t == lastTime` (overwrite current)
  - `t > lastTime` (append)
  - `t < lastTime` → **drop** (dan jangan mengubah state monotonic refs).

## Step 3 — Observability standard (event-based logs)
Gunakan format event konsisten:

Fields wajib:
- `event`, `epoch`, `interval`, `symbol`
- `historyLen`, `queueLen`, `lastTime`, `incomingTime`, `durationMs`

Minimal event sequence saat interval switch:
- `SWITCH_BEGIN`
- `ENGINE_PAUSE_OK`
- `STORE_RESET_LIVE_OK` (currentCandle/currentTick cleared)
- `QUEUE_FLUSH_OK`
- `SET_DATA_BEGIN`
- `SET_DATA_DONE (lastTime=...)`
- `READY_ON`
- `ENGINE_RESUME_OK`

## Step 4 — Enforce session/epoch gating
Gunakan **epoch/session id** untuk semua jalur event (TICK/CANDLE_UPDATE/INIT_DATA).
Rule:
- Jika `msg.epoch !== epochRef.current` → drop tanpa side effect.

## Step 5 — Fix order-of-operations (kill switch)
Urutan recommended:

1) `epoch++`, `ready=false`, reset refs (lastTime/pending), cancel RAF
2) Engine pause worker
3) Store reset live state (`currentCandle=null`, clear tickQueue)
4) Prepare **windowed history** (200–500) + setData
5) Set `lastTimeRef = lastHistoryTime`
6) `ready=true`
7) Resume engine

---

# Patterns & anti-patterns (project-specific)

## A) App Router + StrictMode
### Anti-pattern
- `useCallback([])` membaca `epoch/interval` yang berubah (closure lama).
- Tidak cancel RAF/timers pada unmount atau switch.
- Chart logic ditempatkan di Server Component (tanpa `"use client"`).

### Pattern
- Session variables via `useRef`: `epochRef`, `rafIdRef`, `lastTimeRef`, `readyRef`.
- Cleanup rapat:
  - unsubscribe store
  - cancel RAF
  - clear pending updates
- Pastikan chart component `"use client"` dan tidak mengakses browser API saat SSR.

Checklist:
- [ ] Semua subscribe punya cleanup
- [ ] RAF id disimpan di ref dan dibatalkan saat switch/unmount
- [ ] Tidak ada callback yang “membaca epoch lama” karena dependency kosong

## B) Zustand/Redux subscriptions
### Anti-pattern
- Subscribe ke seluruh state → callback terpanggil untuk state lain → spam update.
- Interval switch tidak atomic.

### Pattern
- Subscribe hanya ke slice yang relevan (`currentCandle`, `baseInterval`, `epoch`).
- Saat switch interval:
  - epoch++ (sekali)
  - reset live state
  - clear queues
  - set anchor/split index

## C) Time-series: resampling & alignment (seconds)
### Anti-pattern
- Resample pakai floor tanpa memastikan boundary session/timezone (kalau dibutuhkan).
- Mencampur seconds dan ms.
- Mengirim history “dari awal sampai anchor” (ribuan candle) → setData lama.

### Pattern
- Normalisasi seconds di boundary.
- Windowing:
  - `historyWindowSecCount = 200–500 candles` (TradingView-like)
- Simpan `splitIndexAbsolute` untuk membagi baseData; jangan bergantung pada `history.length` jika windowed.

## D) Web Worker message contract
### Anti-pattern
- epoch hanya berada di `data.epoch`, tetapi consumer mengecek `msg.epoch`.
- TICK tidak memiliki epoch guard, menyebabkan zombie tick.

### Pattern
- Semua message:
  - `{ type, epoch, data }`
- Consumer:
  - `if (msg.epoch !== epochRef.current) return;`

## E) Performance: batching, RAF, backpressure
### Anti-pattern
- Update chart per tick tanpa batching.
- PostMessage array besar saat downshift interval.
- Queue tumbuh tanpa limit.

### Pattern
- RAF batching “latest-only”:
  - simpan hanya update terakhir di frame
- Backpressure:
  - jika queue > threshold → compact/drop intermediate (terutama di transisi)
- Windowed `setData` agar `READY_ON` cepat.

Targets:
- `setData` sebaiknya < 200ms (windowed)
- “time to ready” < 1500ms
- indicator compute di throttle (tail window), bukan full history

---

# Recommended utilities (seconds SSoT)

## Time normalization
- `toSec(ms): Sec = Math.floor(ms / 1000)`
- `assertSec(t): void` -> memastikan integer seconds
- Jangan gunakan Date parsing di hot path tick; hanya untuk display.

## LWC adapter
- `toLwcTime(sec: Sec): UTCTimestamp = sec as UTCTimestamp`
- Hindari object time (BusinessDay) kecuali memang dibutuhkan.

---

# Deliverables (what the agent must produce)

1) Root cause + bukti dari logs/invariants.
2) Patch minimal (diff) untuk:
   - session/epoch gating
   - reset live state saat switch
   - windowed history & splitIndexAbsolute
   - RAF cancellation & readiness lock
3) Validasi after-fix:
   - tidak ada spam `past update skipped`
   - time-to-ready turun signifikan
4) Guardrails:
   - seconds assertion
   - log schema event-based
   - backpressure limits
