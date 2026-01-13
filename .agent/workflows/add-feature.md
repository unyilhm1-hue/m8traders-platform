---
description: Standard workflow untuk implement fitur baru di m8traders-platform
---

# Add Feature Workflow

Standard flow untuk menambah fitur baru dengan kualitas production.

---

## Phase 1: Planning (30 min)

### 1.1 Define Scope
```markdown
## Feature: [Nama Fitur]

### User Story
As a [user type], I want to [action], so that [benefit].

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Out of Scope
- [Apa yang TIDAK termasuk]
```

### 1.2 Technical Design
```markdown
### Files to Create/Modify
- [ ] `src/components/[...]` - [purpose]
- [ ] `src/stores/[...]` - [state changes]
- [ ] `src/lib/[...]` - [logic]

### State Changes
- Store: [which store]
- New state: [what's added]
- Actions: [new actions]

### API Changes (if any)
- Endpoint: [path]
- Method: [GET/POST/etc]
- Payload: [structure]
```

---

## Phase 2: Implementation

### 2.1 Create Types First
```typescript
// src/types/[feature].ts
export interface FeatureData {
  // Define shape
}

export interface FeatureConfig {
  // Options
}
```

### 2.2 Create Store (if needed)
```typescript
// src/stores/useFeatureStore.ts
import { create } from 'zustand';

interface FeatureState {
  data: FeatureData | null;
  loading: boolean;
  // Actions
  setData: (data: FeatureData) => void;
}

export const useFeatureStore = create<FeatureState>((set) => ({
  data: null,
  loading: false,
  setData: (data) => set({ data }),
}));
```

### 2.3 Create Core Logic
```typescript
// src/lib/[feature]/index.ts
export function processFeature(input: Input): Result {
  // Pure function, testable
}
```

### 2.4 Create Components
```tsx
// src/components/[feature]/FeatureComponent.tsx
'use client';

import { useFeatureStore } from '@/stores/useFeatureStore';

interface FeatureComponentProps {
  // Props
}

export function FeatureComponent({ ...props }: FeatureComponentProps) {
  const { data } = useFeatureStore();
  
  return (
    // JSX
  );
}
```

### 2.5 Create Tests
```typescript
// __tests__/[feature]/feature.test.ts
import { describe, it, expect } from 'vitest';
import { processFeature } from '@/lib/[feature]';

describe('processFeature', () => {
  it('should handle normal case', () => {
    // Test
  });
  
  it('should handle edge case', () => {
    // Test
  });
});
```

---

## Phase 3: Integration

### 3.1 Add to Page/Layout
```tsx
// src/app/[route]/page.tsx
import { FeatureComponent } from '@/components/[feature]/FeatureComponent';

export default function Page() {
  return (
    <div>
      <FeatureComponent />
    </div>
  );
}
```

### 3.2 Connect to Other Features
- Link state to chart if needed
- Add to navigation if new page
- Update types index if new types

---

## Phase 4: Testing

### 4.1 Run Tests
```bash
# // turbo
npm run test -- --run
```

### 4.2 Manual Verification
- [ ] Feature works as expected
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Reduced motion respected

### 4.3 Edge Cases
- [ ] Empty state handled
- [ ] Error state handled
- [ ] Loading state shown
- [ ] Long content handled

---

## Phase 5: Documentation

### 5.1 Update Types JSDoc
```typescript
/**
 * Processes feature data for display
 * @param input - The raw input data
 * @returns Processed result ready for UI
 */
export function processFeature(input: Input): Result {
  // ...
}
```

### 5.2 Update Architecture (if significant)
- Add to `.agent/context/architecture.md`
- Update data flow diagram if needed

---

## Checklist Before Done

- [ ] TypeScript no errors
- [ ] Tests pass
- [ ] Lint pass
- [ ] Mobile tested
- [ ] Edge cases handled
- [ ] Accessibility checked
- [ ] Performance acceptable

---

**Last Updated**: 2026-01-12
