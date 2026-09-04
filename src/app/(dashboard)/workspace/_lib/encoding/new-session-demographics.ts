/** Shared Encoding default used only while creating a brand-new session. */
export const DEFAULT_NEW_SESSION_ADDRESS = "STA. ROSA, NUEVA ECIJA";

export function initializeNewSessionAddress(address?: string | null): string {
  return address && address.trim() ? address : DEFAULT_NEW_SESSION_ADDRESS;
}
