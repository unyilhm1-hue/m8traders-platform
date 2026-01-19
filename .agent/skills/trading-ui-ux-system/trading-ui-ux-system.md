---
name: trading-ui-ux-system
description: Sistem UI/UX untuk platform trading/charting berbasis Next.js App Router + Lightweight Charts v4. Fokus pada UX flows trading/simulator, layout responsif, interaksi chart (pan/zoom/draw), aksesibilitas, motion, state feedback, performa perceived, dan design system yang konsisten.
---

# Trading UI/UX System (Charting & Simulator)

Skill ini mendefinisikan standar UI/UX untuk aplikasi trading/charting profesional (kelas TradingView/Binance) dengan prioritas: kejelasan informasi, interaksi cepat, dan minim friction saat analisis.

## When to use this skill

Gunakan skill ini saat:
- Mendesain ulang layout chart + panel (watchlist, orderbook, positions, trades).
- Membuat UI interval/timeframe switcher, tools & indicators, replay/simulator controls.
- Menentukan state feedback (loading, not ready, syncing, reconnecting) agar tidak mengganggu analisis.
- Mengoptimalkan UX transisi interval/symbol (tanpa “freeze feel”).
- Membuat design system komponen dan token yang konsisten.

---

# UX Principles (Non-negotiable)

## 1) Clarity over decoration
- Prioritaskan keterbacaan chart dan data pasar.
- Hindari elemen dekoratif yang mengurangi fokus (glow berlebihan, animasi agresif).

## 2) Fast perceived performance
- User harus merasa “kontrol tetap responsif” meski data sedang re-init.
- Transisi harus punya feedback yang halus dan singkat (bukan blank/freeze).

## 3) Consistent mental model
- Interaksi chart selalu konsisten: zoom, pan, crosshair, drawing, undo/redo.
- Kontrol interval/symbol: predictable, tidak reset viewport tanpa alasan.

## 4) Minimal interruption
- Peringatan/log internal tidak boleh “bocor” ke UX.
- Error UI harus informatif, tidak spam, dan punya recovery action.

---

# Information Architecture (Layout)

## Desktop (primary)
- **Top bar**: symbol search, interval, timeframe, chart type, indicators, layout presets.
- **Main**: chart (dominant area).
- **Right panel (optional)**: watchlist / orderbook / trades tape.
- **Bottom panel (toggle)**: positions, orders, history, logs (developer/debug mode only).
- **Floating tools**: drawing toolbar (vertical), anchored left of chart.

## Mobile
- Mode “Chart-first”:
  - Minimal top bar (symbol + interval + tools)
  - Panels jadi bottom-sheet: watchlist/orderbook/positions
- Gestures:
  - single finger pan
  - pinch zoom
  - tap untuk crosshair toggle (opsional)

---

# Core Flows

## A) Symbol switching
Goals:
- Tidak kehilangan konteks analisis.
- Informasikan data status (delayed, replay mode, historical).

UX rules:
- Pertahankan: interval, indicator set, drawing set (opsional per symbol).
- Reset hanya jika user memilih “Reset view”.

Feedback:
- Show subtle inline status: “Loading candles…” (non-blocking).
- Jika memerlukan re-init: overlay ringan (lihat section “States & Feedback”).

## B) Interval / timeframe switching
Goals:
- Cepat, tidak terasa freeze.
- Tidak mengubah anchor time kecuali user memilih “Go to latest”.

UX rules:
- Saat switching:
  - Disable hanya tombol yang relevan (interval buttons), bukan seluruh UI.
  - Chart tetap bisa pan/zoom jika data sudah tampil.
- Pertahankan viewport jika mungkin; jika tidak, snap dengan aturan jelas:
  - “Keep right edge anchored” default.

Feedback:
- Inline status di chart corner:
  - “Switching to 2m…” + spinner kecil
  - timeout message jika > 2s: “Syncing data…” (bukan error)

## C) Drawing tools & indicators
Goals:
- Discoverable tetapi tidak memakan ruang.

UX rules:
- Toolbar tools:
  - grouped (Trend, Fib, Pattern, Measure)
  - tooltip + shortcut
- Indicator manager:
  - searchable, quick add, quick remove
  - parameter editor in side panel/drawer
- Undo/redo visible + keyboard shortcuts.

## D) Simulator / Replay
Goals:
- Kontrol play/pause/step cepat dan akurat.

UX rules:
- Playback bar:
  - Play/Pause
  - Step forward (1 candle)
  - Speed selector (1x, 2x, 5x, 10x)
  - “Jump to time” (optional)
- Status:
  - “Paused at 14:52”
  - “Replay speed: 5x”
- Saat re-init interval:
  - auto pause, show “Rebuilding replay buffer…”

---

# States & Feedback (UI)

## State taxonomy (user-facing)
1) **Idle/Ready**
2) **Loading history** (initial load)
3) **Switching interval/symbol** (re-init)
4) **Syncing / buffering** (queue stabilizing)
5) **Reconnecting** (WS/worker restart)
6) **Degraded mode** (partial features)
7) **Error** (actionable)

## UX patterns
- Gunakan **overlay ringan** di chart corner, bukan modal blocking.
- Overlay harus:
  - kecil
  - tidak menutupi area candle
  - hilang otomatis setelah ready

### Copy guideline
- Hindari kata “error” kecuali benar-benar fatal.
- Gunakan bahasa operasional:
  - “Loading candles…”
  - “Switching to 1m…”
  - “Syncing replay buffer…”
  - “Reconnecting…”

## Timeout escalation (anti-freeze feel)
- 0–400ms: tidak perlu tampilkan apa-apa (hindari flicker).
- 400ms–2s: tampilkan status kecil (“Switching…”).
- >2s: escalate copy (“Syncing data, please wait…”).
- >8s: tampilkan CTA:
  - “Retry”
  - “Reset view”
  - “Open diagnostics” (dev only)

---

# Interaction Standards (Chart)

## Cursor & crosshair
- Crosshair default ON desktop.
- Toggle untuk mobile (tap).

## Zoom/Pan
- Zoom ke cursor point.
- Double click: reset zoom (atau fit content, sesuai preferensi).
- Right edge anchor:
  - ketika “live mode”, keep at live edge.
  - ketika user pan ke kiri, live edge indicator muncul (“Go to Live”).

## Tool editing
- Selected drawing punya handles jelas.
- ESC untuk deselect.
- Delete untuk remove.

## Keyboard shortcuts (desktop)
- `/` focus symbol search
- `1` `2` `3` (preset intervals, configurable)
- `Ctrl+Z` / `Ctrl+Y` undo/redo
- Space play/pause (replay mode)

---

# Visual Design System

## Tokens
- Spacing: 4/8/12/16/24
- Radius: 8/12
- Typography:
  - chart labels: 12–13px
  - panel headings: 14–16px
  - primary numbers: 16–20px
- Color (principle-level):
  - neutral background
  - high contrast text
  - semantic: up/down, warning, info
  - avoid neon colors by default

## Components (minimum set)
- Button (primary/secondary/ghost)
- Segmented control (interval)
- Dropdown (indicators, speed)
- Tabs (positions/orders/history)
- Drawer/Bottom sheet (mobile panels)
- Toast (non-critical)
- Inline banner (reconnect/sync)
- Skeleton loader (panels)
- Empty state cards

---

# Accessibility & Usability

- Keyboard navigable untuk top bar, indicator list, drawing tools.
- Minimum touch target mobile: 44px.
- Kontras teks memadai (AA target).
- Prefer reduced motion: matikan animasi non-esensial jika `prefers-reduced-motion`.

---

# Motion & Transitions (tasteful)
- Micro-interactions:
  - hover highlight, selection state
  - panel open/close 150–250ms
- Hindari animasi pada candle rendering (chart library sudah handle).
- During switching:
  - fade overlay, bukan fade seluruh chart.

---

# Performance UX (perceived)
- Windowed rendering (mis. 200–500 candles visible) untuk responsif.
- Batching updates (RAF) agar chart tidak stutter.
- Defer indicator recalculation jika user sedang drag/zoom.

---

# QA Checklist (UI/UX)

## Interval switching
- [ ] Switching tidak memblokir seluruh UI (hanya kontrol terkait).
- [ ] Ada status kecil setelah 400ms, hilang saat ready.
- [ ] Tidak ada “freeze feel” >2s tanpa feedback.
- [ ] Viewport behavior konsisten (keep right edge / keep time anchor).

## Mobile
- [ ] Chart-first, panels via bottom sheet.
- [ ] Gesture tidak konflik dengan drawing edit.
- [ ] Touch targets >= 44px.

## Simulator
- [ ] Play/pause respons <100ms (UI feedback).
- [ ] Step forward jelas, tidak double-advance.
- [ ] Saat re-init buffer, auto pause + status.

## Error states
- [ ] Error actionable (Retry/Reset).
- [ ] Tidak spam toast.
- [ ] Log detail hanya di dev/diagnostic panel.

---

# Deliverables (what the agent must produce)

1) Layout proposal (desktop + mobile) dengan prioritas area chart.
2) Komponen design system minimal + tokens.
3) State feedback spec (copy + timing thresholds + CTA).
4) Interaction spec (zoom/pan/crosshair/tools/shortcuts).
5) QA checklist + acceptance criteria untuk interval switch dan replay.
