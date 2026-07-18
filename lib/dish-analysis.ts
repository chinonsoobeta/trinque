import type { SupportedLanguage } from "./regions.ts";

export type DishAnalysis = {
  name: string;
  cuisine: string;
  ingredients: string;
  dietary: string;
  confidence: number;
  description: string;
  canonical: {
    dishName: string;
    cuisine: string;
    ingredients: string[];
    flavours: string[];
    metadataSource: "ai_normalized" | "user_reviewed";
  };
};

export type AnalysisSuccess = {
  ok: true;
  mode: "live" | "demo";
  requestId: string;
  result: DishAnalysis;
  warning?: string;
};

export type AnalysisFailure = {
  ok: false;
  mode: "unavailable";
  requestId: string;
  error: {
    code: "invalid_image" | "live_not_configured" | "session_required" | "provider_error" | "invalid_provider_response";
    message: string;
  };
  demoAvailable: true;
};

export type AnalysisEnvelope = AnalysisSuccess | AnalysisFailure;

const demoAnalyses: Record<string, DishAnalysis> = {
  pasta: {
    name: "Brown butter agnolotti",
    cuisine: "Northern Italian",
    ingredients: "Filled pasta, brown butter, sage, lemon, parmesan",
    dietary: "Vegetarian · Contains dairy and gluten",
    confidence: 94,
    description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.",
    canonical: { dishName: "agnolotti", cuisine: "northern italian", ingredients: ["filled pasta", "butter", "sage", "lemon", "parmesan"], flavours: ["nutty", "herbal", "bright"], metadataSource: "user_reviewed" },
  },
  ramen: {
    name: "Charred miso ramen",
    cuisine: "Japanese",
    ingredients: "Wheat noodles, miso broth, charred corn, scallion, chile oil",
    dietary: "Likely contains gluten and soy · Confirm broth ingredients",
    confidence: 91,
    description: "Springy noodles in a smoky, fermented broth with sweet charred corn.",
    canonical: { dishName: "miso ramen", cuisine: "japanese", ingredients: ["wheat noodles", "miso", "corn", "scallion", "chile oil"], flavours: ["smoky", "fermented", "umami"], metadataSource: "user_reviewed" },
  },
  tacos: {
    name: "Crispy oyster mushroom tacos",
    cuisine: "Mexican-inspired",
    ingredients: "Oyster mushrooms, corn tortillas, cabbage, salsa roja, lime",
    dietary: "Plant-based appearance · Confirm fryer cross-contact",
    confidence: 88,
    description: "Crunchy mushrooms layered with bright lime, chile heat and fresh cabbage.",
    canonical: { dishName: "oyster mushroom tacos", cuisine: "mexican inspired", ingredients: ["oyster mushroom", "corn tortilla", "cabbage", "chile", "lime"], flavours: ["crunchy", "bright", "spicy"], metadataSource: "user_reviewed" },
  },
};

export function demoAnalysis(fixture = "pasta"): DishAnalysis {
  return demoAnalyses[fixture] ?? demoAnalyses.pasta;
}

export function demoEnvelope(requestId: string, fixture?: string): AnalysisSuccess {
  return {
    ok: true,
    mode: "demo",
    requestId,
    result: demoAnalysis(fixture),
    warning: "This is seeded demo data, not an analysis of the uploaded photo.",
  };
}

export async function analyzeDishWithOpenAI({
  imageDataUrl,
  apiKey,
  requestId,
  fetcher = fetch,
  language = "en-CA",
}: {
  imageDataUrl: string;
  apiKey: string;
  requestId: string;
  fetcher?: typeof fetch;
  language?: SupportedLanguage;
}): Promise<AnalysisEnvelope> {
  let response: Response;
  try {
    response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        reasoning: { effort: "low" },
        store: false,
        safety_identifier: "trinque-guest",
        instructions: `Analyze only what is visibly supported by the food photo. Return the user-facing name, cuisine, ingredients, dietary caveats, and description in ${language}; preserve an established original-language dish name rather than translating it away. Clearly label uncertainty, never claim allergen or dietary safety, and use the selected language for every warning. Also return concise canonical English matching concepts that remain stable if UI language changes. Canonical metadata is AI-normalized and must not weaken allergen uncertainty. Use 'unknown' when visual evidence is insufficient.`,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Identify this photographed dish. Return its most likely name, cuisine, visible or likely ingredients, dietary caveats, calibrated confidence from 0 to 100, and a one-sentence sensory description." },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "dish_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                cuisine: { type: "string" },
                ingredients: { type: "string" },
                dietary: { type: "string" },
                confidence: { type: "number", minimum: 0, maximum: 100 },
                description: { type: "string" },
                canonical: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    dishName: { type: "string" },
                    cuisine: { type: "string" },
                    ingredients: { type: "array", items: { type: "string" } },
                    flavours: { type: "array", items: { type: "string" } },
                    metadataSource: { type: "string", enum: ["ai_normalized"] },
                  },
                  required: ["dishName", "cuisine", "ingredients", "flavours", "metadataSource"],
                },
              },
              required: ["name", "cuisine", "ingredients", "dietary", "confidence", "description", "canonical"],
            },
          },
        },
      }),
    });
  } catch {
    return providerFailure(requestId, "The live identifier could not reach OpenAI. Retry or choose the labeled demo.");
  }

  if (!response.ok) {
    return providerFailure(requestId, "OpenAI could not analyze this image. Retry or choose the labeled demo.");
  }

  try {
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const outputText = payload.output?.flatMap((item) => item.content ?? []).find((part) => part.type === "output_text")?.text;
    if (!outputText) throw new Error("missing output text");
    const result = JSON.parse(outputText) as DishAnalysis;
    if (!isDishAnalysis(result)) throw new Error("invalid analysis shape");
    return { ok: true, mode: "live", requestId, result };
  } catch {
    return {
      ok: false,
      mode: "unavailable",
      requestId,
      error: { code: "invalid_provider_response", message: "OpenAI returned an unreadable result. Retry or choose the labeled demo." },
      demoAvailable: true,
    };
  }
}

function providerFailure(requestId: string, message: string): AnalysisFailure {
  return {
    ok: false,
    mode: "unavailable",
    requestId,
    error: { code: "provider_error", message },
    demoAvailable: true,
  };
}

function isDishAnalysis(value: DishAnalysis): boolean {
  return Boolean(
    value && typeof value.name === "string" && typeof value.cuisine === "string" &&
    typeof value.ingredients === "string" && typeof value.dietary === "string" &&
    typeof value.confidence === "number" && value.confidence >= 0 && value.confidence <= 100 &&
    typeof value.description === "string" && value.canonical && typeof value.canonical.dishName === "string" &&
    typeof value.canonical.cuisine === "string" && Array.isArray(value.canonical.ingredients) && value.canonical.ingredients.every((item) => typeof item === "string") &&
    Array.isArray(value.canonical.flavours) && value.canonical.flavours.every((item) => typeof item === "string") &&
    ["ai_normalized", "user_reviewed"].includes(value.canonical.metadataSource),
  );
}
