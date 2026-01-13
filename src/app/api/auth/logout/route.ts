import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Logout handler
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        await supabase.auth.signOut();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
