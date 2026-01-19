# Admin Email Configuration

## Setting Admin Emails

Admin emails untuk akses DataUpdaterButton dikonfigurasi di dashboard page.

**File**: [`src/app/(protected)/dashboard/page.tsx`](file:///c:/Users/laras/.gemini/antigravity/scratch/m8traders-platform/src/app/(protected)/dashboard/page.tsx)

### Current Mode: Testing (All Users Can Access)

```typescript
// Line ~24-28
const TESTING_MODE = true;  // ← Currently TRUE (testing)
const isAdmin = TESTING_MODE || ADMIN_EMAILS.includes(userEmail.toLowerCase());
```

**Saat ini semua user bisa akses** karena `TESTING_MODE = true`

### Production Configuration (Nanti Setelah Testing Selesai)

**Langkah aktivasi production:**

1. **Set TESTING_MODE ke false**:
```typescript
const TESTING_MODE = false;  // ← Change to false for production
```

2. **Update admin email list** dengan email admin yang sebenarnya:
```typescript
const ADMIN_EMAILS = [
    'admin@m8traders.com',
    'your-actual-admin@email.com',    // ← Real admin email
];
```

3. **Aktifkan magic link authentication** (Supabase auth)

4. **Deploy** perubahan

---

## Default Configuration (Testing)

```typescript
const ADMIN_EMAILS = [
    'admin@m8traders.com',
    'laras@example.com',  // Replace with actual admin email
    // Add more admin emails here
];
```

### Cara Update Admin List

1. **Edit dashboard page**:
```typescript
// Line ~18-22
const ADMIN_EMAILS = [
    'admin@m8traders.com',
    'your-admin@email.com',    // ← Add your admin email
    'another@admin.com',       // ← Add more as needed
];
```

2. **Save & reload** - Changes apply immediately

### Security Notes

⚠️ **Important:**
- Email check hanya di client-side (visibility control)
- Bukan security protection yang sesungguhnya
- Untuk production, gunakan **server-side role check** via Supabase RLS

### Production-Ready Approach (Recommended)

Untuk production yang lebih aman:

#### Option 1: Supabase User Metadata

```typescript
// In Supabase dashboard, add user_metadata:
// { "role": "admin" }

// Then check in code:
const isAdmin = data.user.user_metadata?.role === 'admin';
```

#### Option 2: Supabase Database Table

Create `user_roles` table:

```sql
create table user_roles (
  user_id uuid references auth.users,
  role text not null,
  primary key (user_id)
);

-- Grant admin
insert into user_roles (user_id, role) 
values ('USER_UUID_HERE', 'admin');
```

Then query:

```typescript
const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

const isAdmin = roleData?.role === 'admin';
```

#### Option 3: Server Component (Most Secure)

Convert dashboard to Server Component:

```typescript
// src/app/(protected)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export default async function DashboardPage() {
    const supabase = createClient(cookies());
    const { data: { user } } = await supabase.auth.getUser();
    
    // Server-side check (cannot be bypassed)
    const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);
    
    return (
        // ... render with isAdmin
    );
}
```

### Current Implementation

Saat ini menggunakan **client-side email check** untuk kemudahan development. Untuk production, pertimbangkan upgrade ke salah satu opsi di atas.
