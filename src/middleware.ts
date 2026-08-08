import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/session';

// Define paths that do not require authentication
const publicPaths = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const isPublicPath = publicPaths.includes(pathname);
  
  // Read the session token from cookies
  const sessionToken = request.cookies.get('session_token')?.value;
  
  // Decrypt and validate the session
  const session = await decrypt(sessionToken);

  // If the path is not public and there is no valid session, redirect to login
  if (!isPublicPath && !session) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    
    // Clear the invalid cookie if it exists
    if (sessionToken) {
      response.cookies.delete('session_token');
    }
    return response;
  }

  // If the user is on the login page but has a valid session, redirect to dashboard
  if (isPublicPath && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except API, Next.js internal paths, and static files
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
