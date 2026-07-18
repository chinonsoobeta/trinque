export function guestTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Guest ([A-Za-z0-9_-]{32,})$/);
  return match?.[1] ?? null;
}
