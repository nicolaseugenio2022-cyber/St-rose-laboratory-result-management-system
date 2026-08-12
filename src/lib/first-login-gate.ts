export const FIRST_LOGIN_PATH_ALLOWLIST = [
  "/first-login/password",
  "/first-login/recovery",
  "/api/auth/session",
  "/logout",
] as const;

export function isFirstLoginPathAllowed(pathname: string): boolean {
  return FIRST_LOGIN_PATH_ALLOWLIST.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function firstLoginRedirectPath(flags: {
  mustChangePassword: boolean;
  mustSetRecovery: boolean;
}): string {
  return flags.mustChangePassword ? "/first-login/password" : "/first-login/recovery";
}
