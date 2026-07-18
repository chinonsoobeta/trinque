type CrashKind = 'js_exception' | 'unhandled_rejection' | 'api_error';

const APP_VERSION = '1.0.0';

export function installCrashReporting({ apiBase, guestToken, route = '/' }: { apiBase?: string; guestToken?: string | null; route?: string }) {
  if (!apiBase || !guestToken) return () => undefined;
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: { getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void; setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void } }).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils.setGlobalHandler) return () => undefined;
  const previous = errorUtils.getGlobalHandler();
  const report = (kind: CrashKind, error: unknown) => {
    const code = safeCode(error);
    void fetch(`${apiBase}/api/diagnostics`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, code, platform: 'ios', appVersion: APP_VERSION, route }) }).catch(() => undefined);
  };
  errorUtils.setGlobalHandler((error, isFatal) => { report('js_exception', error); previous(error, isFatal); });
  return () => errorUtils.setGlobalHandler?.(previous);
}

export function safeCode(error: unknown): string {
  const name = error instanceof Error ? error.name : 'UnknownError';
  return name.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'UnknownError';
}
