import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Check if email is whitelisted
 * POST /api/auth/check-whitelist
 */
export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ allowed: false, error: 'Invalid email' }, { status: 400 });
        }

        const supabase = await createClient();

        // Check whitelist table
        const { data, error } = await supabase
            .from('whitelist')
            .select('email')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !data) {
            return NextResponse.json({ allowed: false });
        }

        return NextResponse.json({ allowed: true });
    } catch (error) {
        console.error('Whitelist check error:', error);
        return NextResponse.json({ allowed: false, error: 'Server error' }, { status: 500 });
    }
}
