function safeReturnTo(value?: string): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

/**
 * Keeps the login page on the same origin configured for the OAuth callback.
 * PKCE cookies are host-only, so localhost and 127.0.0.1 cannot be mixed.
 */
export function canonicalLoginUrl(authUrl: string | undefined, requestHost: string | null, returnTo?: string): string | null {
  if (!authUrl || !requestHost) return null;
  let canonical: URL;
  try {
    canonical = new URL(authUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(canonical.protocol) || canonical.host.toLowerCase() === requestHost.toLowerCase()) return null;
  const target = new URL("/login", canonical);
  const destination = safeReturnTo(returnTo);
  if (destination) target.searchParams.set("returnTo", destination);
  return target.toString();
}
