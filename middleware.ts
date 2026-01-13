import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Middleware to protect routes requiring authentication
 * TEMPORARILY DISABLED for development debugging
 * Runs on all /sim/* routes
 */
export async function middleware(request: NextRequest) {
    // TEMPORARY: Skip auth check for development
    console.log('Middleware: Allowing access to', request.nextUrl.pathname);
    return NextResponse.next();

    /* COMMENTED OUT FOR DEBUGGING - UNCOMMENT AFTER AUTH FIXED
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Get user session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Redirect to login if not authenticated
    if (!user) {
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('from', request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
    }

    return response;
    */
}

// Run middleware on protected routes
export const config = {
    matcher: ['/sim/:path*'],
};
