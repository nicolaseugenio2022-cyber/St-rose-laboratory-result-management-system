export const CANONICAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;
export const CONSECUTIVE_USERNAME_SEPARATOR_PATTERN = /[._-]{2}/;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 50;

export function canonicalizeUsername(input: string): string {
  return input.normalize("NFKC").trim().toLowerCase();
}

export function isValidCanonicalUsername(username: string): boolean {
  return (
    username.length >= MIN_USERNAME_LENGTH &&
    username.length <= MAX_USERNAME_LENGTH &&
    CANONICAL_USERNAME_PATTERN.test(username) &&
    !CONSECUTIVE_USERNAME_SEPARATOR_PATTERN.test(username)
  );
}

export function canonicalizeAndValidateUsername(input: string): string | null {
  const canonical = canonicalizeUsername(input);
  return isValidCanonicalUsername(canonical) ? canonical : null;
}
