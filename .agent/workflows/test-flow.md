---
description: Protokol testing untuk m8traders-platform (unit, component, E2E)
---

# Test Flow Protocol

Systematic testing untuk memastikan kualitas production.

---

## Test Stack

| Type | Tool | Location |
|------|------|----------|
| Unit | Vitest | `__tests__/*.test.ts` |
| Component | Testing Library | `__tests__/*.test.tsx` |
| E2E | Playwright | `e2e/*.spec.ts` |

---

## Running Tests

### All Tests
```bash
# // turbo
npm run test
```

### Watch Mode (development)
```bash
npm run test:watch
```

### Specific File
```bash
npm run test -- trading.test.ts
```

### E2E Tests
```bash
# // turbo
npm run test:e2e
```

### Coverage
```bash
npm run test:coverage
```

---

## Test File Naming

```
__tests__/
├── lib/
│   └── trading/
│       ├── calculations.test.ts     # Unit tests
│       └── engine.test.ts
├── components/
│   └── trading/
│       └── OrderPanel.test.tsx      # Component tests
└── hooks/
    └── useChart.test.ts
    
e2e/
├── trading-flow.spec.ts             # E2E tests
├── challenge-flow.spec.ts
└── auth-flow.spec.ts
```

---

## Unit Test Pattern

```typescript
// __tests__/lib/trading/calculations.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePnL, calculatePositionSize } from '@/lib/trading/calculations';

describe('Trading Calculations', () => {
  describe('calculatePnL', () => {
    it('should calculate profit for long position', () => {
      const result = calculatePnL({
        entryPrice: 100,
        exitPrice: 110,
        shares: 10,
        type: 'LONG'
      });
      
      expect(result.absolute).toBe(100);
      expect(result.percentage).toBe(10);
    });
    
    it('should calculate loss for long position', () => {
      const result = calculatePnL({
        entryPrice: 100,
        exitPrice: 90,
        shares: 10,
        type: 'LONG'
      });
      
      expect(result.absolute).toBe(-100);
      expect(result.percentage).toBe(-10);
    });
    
    it('should handle zero shares', () => {
      expect(() => calculatePnL({
        entryPrice: 100,
        exitPrice: 110,
        shares: 0,
        type: 'LONG'
      })).toThrow('Invalid shares');
    });
  });
});
```

---

## Component Test Pattern

```typescript
// __tests__/components/trading/OrderPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderPanel } from '@/components/trading/OrderPanel';

describe('OrderPanel', () => {
  const mockOnTrade = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should render buy and sell buttons', () => {
    render(<OrderPanel onTrade={mockOnTrade} />);
    
    expect(screen.getByRole('button', { name: /buy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sell/i })).toBeInTheDocument();
  });
  
  it('should call onTrade when buy clicked', async () => {
    const user = userEvent.setup();
    render(<OrderPanel onTrade={mockOnTrade} />);
    
    const sharesInput = screen.getByLabelText(/shares/i);
    await user.type(sharesInput, '10');
    
    const buyButton = screen.getByRole('button', { name: /buy/i });
    await user.click(buyButton);
    
    expect(mockOnTrade).toHaveBeenCalledWith({
      type: 'BUY',
      shares: 10,
      price: expect.any(Number)
    });
  });
  
  it('should show error for invalid shares', async () => {
    const user = userEvent.setup();
    render(<OrderPanel onTrade={mockOnTrade} />);
    
    const sharesInput = screen.getByLabelText(/shares/i);
    await user.type(sharesInput, '-5');
    
    const buyButton = screen.getByRole('button', { name: /buy/i });
    await user.click(buyButton);
    
    expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    expect(mockOnTrade).not.toHaveBeenCalled();
  });
});
```

---

## E2E Test Pattern

```typescript
// e2e/trading-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Trading Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sim/AAPL');
    // Wait for chart to load
    await page.waitForSelector('[data-testid="trading-chart"]');
  });
  
  test('should complete buy order flow', async ({ page }) => {
    // Enter shares
    await page.fill('[data-testid="shares-input"]', '10');
    
    // Click buy button
    await page.click('[data-testid="buy-button"]');
    
    // Verify position updated
    await expect(page.locator('[data-testid="position-shares"]')).toHaveText('10');
    
    // Verify trade in history
    await expect(page.locator('[data-testid="trade-history"] li')).toHaveCount(1);
  });
  
  test('should prevent sell without position', async ({ page }) => {
    await page.click('[data-testid="sell-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('No position');
  });
});
```

---

## Test Data IDs

Untuk E2E tests, gunakan `data-testid`:

```tsx
// ✅ Good
<button data-testid="buy-button">Buy</button>
<input data-testid="shares-input" />
<div data-testid="position-shares">{shares}</div>

// ❌ Bad - fragile selectors
<button className="btn-primary">Buy</button>
```

---

## Mock Patterns

### Mock Zustand Store
```typescript
import { vi } from 'vitest';

vi.mock('@/stores/useTradingStore', () => ({
  useTradingStore: vi.fn(() => ({
    balance: 100000,
    position: null,
    executeTrade: vi.fn()
  }))
}));
```

### Mock Chart
```typescript
vi.mock('klinecharts', () => ({
  init: vi.fn(() => ({
    applyNewData: vi.fn(),
    createIndicator: vi.fn(),
    dispose: vi.fn()
  })),
  dispose: vi.fn()
}));
```

---

## CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:e2e
```

---

## Test Coverage Targets

| Category | Target |
|----------|--------|
| Trading Logic | 90% |
| Challenge System | 85% |
| Components | 75% |
| Utils | 80% |
| Overall | 80% |

---

**Last Updated**: 2026-01-12
