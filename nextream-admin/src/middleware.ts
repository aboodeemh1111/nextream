import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Define public paths that don't require authentication
  const isPublicPath = path === '/login';

  // Check if the user is authenticated by looking for the admin token in cookies
  const token = request.cookies.get('admin')?.value || '';
  const isAuthenticated = !!token;

  // If the path is public and the user is authenticated, redirect to the dashboard
  if (isPublicPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If the path is not public and the user is not authenticated, redirect to login
  if (!isPublicPath && !isAuthenticated && path !== '/favicon.ico') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Otherwise, continue with the request
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    '/',
    '/login',
    '/users/:path*',
    '/movies/:path*',
    '/lists/:path*',
    '/analytics/:path*',
    '/settings/:path*',
  ],
}; 