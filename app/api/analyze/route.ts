import { NextResponse } from "next/server";
import { analyzeDishWithOpenAI, demoEnvelope, type AnalysisFailure } from "@/lib/dish-analysis";
import { getRuntimeEnv, selectOpenAIKey } from "@/lib/runtime-env";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/regions";
import { corsHeaders, corsPreflight } from "@/lib/cors";
import { budgetResponse, enforceUsageBudget, logOperation, requestIdFor, UsageBudgetError } from "@/lib/operations";
import { decodeDishImage } from "@/lib/uploads";
import { requireIdentity } from "@/lib/identity";

export const runtime = "edge";

export function OPTIONS(request: Request) { return corsPreflight(request, "POST, OPTIONS"); }

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  const startedAt = Date.now();
  const headers = await corsHeaders(request, "POST, OPTIONS");
  headers.set("X-Request-Id", requestId);
  try {
    const body = await request.json() as { imageDataUrl?: string; demo?: boolean; demoFixture?: string; language?: SupportedLanguage };
    if (body.demo) return json(demoEnvelope(requestId, body.demoFixture), 200, headers);

    const runtimeEnv = await getRuntimeEnv();
    const apiKey = selectOpenAIKey(
      runtimeEnv.OPENAI_API_KEY_2,
      runtimeEnv.OPENAI_API_KEY,
      process.env.OPENAI_API_KEY_2,
      process.env.OPENAI_API_KEY,
    );
    if (!apiKey) {
      return json(failure(requestId, "live_not_configured", "Live identification is not configured yet. You can still choose the clearly labeled demo."), 503, headers);
    }

    try { if (!body.imageDataUrl) throw new Error("invalid_image"); decodeDishImage(body.imageDataUrl); }
    catch { return json(failure(requestId, "invalid_image", "Choose a valid PNG, JPEG or WebP image under 5 MB."), 400, headers); }
    const identity = await requireIdentity(request);
    if (!identity) return json(failure(requestId, "session_required", "A guest session is required for live identification."), 401, headers);
    await enforceUsageBudget("analysis", identity.id);

    const language = body.language && SUPPORTED_LANGUAGES.includes(body.language) ? body.language : "en-CA";
    const result = await analyzeDishWithOpenAI({ imageDataUrl: body.imageDataUrl, apiKey, requestId, language });
    logOperation("request_completed", { requestId, action: "analysis", status: result.ok ? 200 : 502, durationMs: Date.now() - startedAt });
    return json(result, result.ok ? 200 : 502, headers);
  } catch (error) {
    if (error instanceof UsageBudgetError) return budgetResponse(error, requestId);
    logOperation("request_failed", { requestId, action: "analysis", status: 500, code: "provider_error", durationMs: Date.now() - startedAt });
    return json(failure(requestId, "provider_error", "The identifier could not process this request. Retry or choose the labeled demo."), 500, headers);
  }
}

function failure(requestId: string, code: AnalysisFailure["error"]["code"], message: string): AnalysisFailure {
  return { ok: false, mode: "unavailable", requestId, error: { code, message }, demoAvailable: true };
}

function json(body: unknown, status = 200, headers?: Headers) {
  return NextResponse.json(body, { status, headers });
}
