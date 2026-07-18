import { sql } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { usageCounters } from "../db/schema.ts";
import { getRuntimeEnv } from "./runtime-env.ts";

export type BudgetAction = "analysis" | "places" | "publish" | "invite_join" | "vote";
const DEFAULT_LIMITS: Record<BudgetAction, { user: number; global: number }> = {
  analysis: { user: 12, global: 500 },
  places: { user: 120, global: 2_000 },
  publish: { user: 20, global: 300 },
  invite_join: { user: 30, global: 800 },
  vote: { user: 120, global: 4_000 },
};

export class UsageBudgetError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) { super("usage_budget_exceeded"); this.retryAfterSeconds = retryAfterSeconds; }
}

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export function logOperation(event: string, details: { requestId: string; action?: string; status?: number; code?: string; durationMs?: number; countryCode?: string }) {
  const safe = { timestamp: new Date().toISOString(), event, ...details };
  console.info(JSON.stringify(safe));
}

export async function enforceUsageBudget(action: BudgetAction, userId?: string | null, now = new Date()): Promise<void> {
  const env = await getRuntimeEnv() as Record<string, unknown>;
  const upper = action.toUpperCase();
  const userLimit = limit(env[`TRINQUE_BUDGET_${upper}_USER_HOURLY`], process.env[`TRINQUE_BUDGET_${upper}_USER_HOURLY`], DEFAULT_LIMITS[action].user);
  const globalLimit = limit(env[`TRINQUE_BUDGET_${upper}_GLOBAL_HOURLY`], process.env[`TRINQUE_BUDGET_${upper}_GLOBAL_HOURLY`], DEFAULT_LIMITS[action].global);
  const windowStart = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000).toISOString();
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(windowStart).getTime() + 3_600_000 - now.getTime()) / 1000));
  await increment(action, "global", windowStart, globalLimit, now, retryAfterSeconds);
  if (userId) await increment(action, `user:${await opaqueScope(userId)}`, windowStart, userLimit, now, retryAfterSeconds);
}

async function increment(action: BudgetAction, scope: string, windowStart: string, maximum: number, now: Date, retryAfterSeconds: number) {
  const db = await getDb();
  const [counter] = await db.insert(usageCounters).values({ action, scope, windowStart, count: 1, updatedAt: now.toISOString() }).onConflictDoUpdate({
    target: [usageCounters.action, usageCounters.scope, usageCounters.windowStart],
    set: { count: sql`${usageCounters.count} + 1`, updatedAt: now.toISOString() },
  }).returning({ count: usageCounters.count });
  if (!counter || counter.count > maximum) throw new UsageBudgetError(retryAfterSeconds);
}

function limit(workerValue: unknown, nodeValue: string | undefined, fallback: number): number {
  const parsed = Number(typeof workerValue === "string" || typeof workerValue === "number" ? workerValue : nodeValue);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : fallback;
}

async function opaqueScope(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function budgetResponse(error: UsageBudgetError, requestId: string): Response {
  return Response.json({ error: { code: "rate_limit", message: "Usage budget reached. Retry after the current window.", requestId } }, { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds), "X-Request-Id": requestId } });
}
