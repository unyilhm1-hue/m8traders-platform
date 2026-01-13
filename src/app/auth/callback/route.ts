import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Auth callback handler for Supabase magic link
 * Refreshes session from cookies and redirects to protected route
 * GET /auth/callback
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);

    console.log('Auth callback received');

    // Create response for redirect
    let response = NextResponse.redirect(`${requestUrl.origin}/sim/demo`);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options: any }>) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh user session from cookies (this validates the auth tokens)
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error('Auth callback - no user found:', error?.message || 'no user');
        return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }

    console.log('Auth callback - user authenticated:', user.email);

    // Session is valid, cookies are set, redirect to protected page
    return response;
}
