import { NextResponse } from "next/server";

export const runtime = "edge";

type Analysis = {
  name: string;
  cuisine: string;
  ingredients: string;
  dietary: string;
  confidence: number;
  description: string;
};

const demoAnalysis: Analysis = {
  name: "Brown butter agnolotti",
  cuisine: "Northern Italian",
  ingredients: "Filled pasta, brown butter, sage, lemon, parmesan",
  dietary: "Vegetarian · Contains dairy and gluten",
  confidence: 94,
  description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.",
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { imageDataUrl?: string; demo?: boolean };
    if (body.demo || !body.imageDataUrl || !process.env.OPENAI_API_KEY) {
      return NextResponse.json(demoAnalysis);
    }
    if (!body.imageDataUrl.startsWith("data:image/") || body.imageDataUrl.length > 7_000_000) {
      return NextResponse.json({ error: "Please upload a valid image under 5 MB." }, { status: 400 });
    }
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        cuisine: { type: "string" },
        ingredients: { type: "string" },
        dietary: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 100 },
        description: { type: "string" },
      },
      required: ["name", "cuisine", "ingredients", "dietary", "confidence", "description"],
    };
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.6-sol",
        reasoning: { effort: "low" },
        store: false,
        safety_identifier: "trinque-anonymous-demo",
        instructions: "Analyze the food photo conservatively. Never claim dietary or allergen safety. If uncertain, say so in dietary. Keep fields concise and useful for restaurant discovery.",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Identify this dish, its likely cuisine and ingredients, dietary caveats, confidence from 0-100, and a one-sentence sensory description." },
            { type: "input_image", image_url: body.imageDataUrl, detail: "low" },
          ],
        }],
        text: { format: { type: "json_schema", name: "dish_analysis", strict: true, schema } },
      }),
    });
    if (!response.ok) return NextResponse.json(demoAnalysis);
    const result = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = result.output?.flatMap((item) => item.content ?? []).find((part) => part.type === "output_text")?.text;
    return NextResponse.json(text ? JSON.parse(text) as Analysis : demoAnalysis);
  } catch {
    return NextResponse.json(demoAnalysis);
  }
}
