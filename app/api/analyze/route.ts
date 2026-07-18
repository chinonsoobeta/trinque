import { NextResponse } from "next/server";
import { analyzeDishWithOpenAI, demoEnvelope, type AnalysisFailure } from "@/lib/dish-analysis";

export const runtime = "edge";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const body = await request.json() as { imageDataUrl?: string; demo?: boolean; demoFixture?: string };
    if (body.demo) return json(demoEnvelope(requestId, body.demoFixture));

    if (!body.imageDataUrl || !body.imageDataUrl.startsWith("data:image/") || body.imageDataUrl.length > 7_000_000) {
      return json(failure(requestId, "invalid_image", "Choose a valid PNG, JPEG or WebP image under 5 MB."), 400);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(failure(requestId, "live_not_configured", "Live identification is not configured yet. You can still choose the clearly labeled demo."), 503);
    }

    const result = await analyzeDishWithOpenAI({ imageDataUrl: body.imageDataUrl, apiKey, requestId });
    return json(result, result.ok ? 200 : 502);
  } catch {
    return json(failure(requestId, "provider_error", "The identifier could not process this request. Retry or choose the labeled demo."), 500);
  }
}

function failure(requestId: string, code: AnalysisFailure["error"]["code"], message: string): AnalysisFailure {
  return { ok: false, mode: "unavailable", requestId, error: { code, message }, demoAvailable: true };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
