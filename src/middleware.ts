import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decryptSessionToken } from "@/lib/session-codec";
import {
  firstLoginRedirectPath,
  isFirstLoginPathAllowed,
} from "@/lib/first-login-gate";

const publicPaths = ["/login", "/forgot-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
  const sessionToken = request.cookies.get("session_token")?.value;
  const session = await decryptSessionToken(sessionToken);

  if (!isPublicPath && !session) {
    const response = NextResponse.redirect(new URL("/login", request.url), 303);
    if (sessionToken) response.cookies.delete("session_token");
    return response;
  }

  if (
    session &&
    (session.mustChangePassword || session.mustSetRecovery) &&
    !isFirstLoginPathAllowed(pathname)
  ) {
    return NextResponse.redirect(new URL(firstLoginRedirectPath(session), request.url), 303);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|css|js|json|txt|xml|map|woff|woff2|eot|ttf|otf)).*)",
  ],
};
