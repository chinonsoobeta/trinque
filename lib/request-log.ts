/**
 * Request-scoped helpers with no database dependency, so `proxy.ts` can use
 * them without pulling the libSQL driver into the proxy bundle.
 */
export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function logOperation(event: string, details: { requestId: string; action?: string; status?: number; code?: string; durationMs?: number; countryCode?: string }) {
  const safe = { timestamp: new Date().toISOString(), event, ...details };
  console.info(JSON.stringify(safe));
}
