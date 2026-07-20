/**
 * Compatibility policy for legacy route handlers that still import requireIdentity.
 * Public reads remain guest-capable; durable dish/group mutations require accounts.
 */
export function requiresAuthenticatedLegacyMutation(request: Pick<Request, "method" | "url">): boolean {
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;
  const pathname = new URL(request.url).pathname;
  return pathname === "/api/dishes" || pathname.startsWith("/api/dishes/") || pathname === "/api/groups" || pathname.startsWith("/api/groups/");
}
