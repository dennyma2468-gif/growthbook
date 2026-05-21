import { NextRequest, NextResponse } from "next/server";
import { runPipeline, Language } from "@/lib/agents";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawPhotos, language, childName } = body as {
      rawPhotos: { id: string; base64: string; mimeType: string }[];
      language?: Language;
      childName?: string;
    };

    const results = await runPipeline(rawPhotos, {
      language: language || "en",
      childName,
    });

    return NextResponse.json(results);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; error?: { error?: { message?: string } } };
    const msg =
      e?.error?.error?.message ||
      e?.message ||
      "Unknown error";
    console.error("Pipeline error:", msg, err);
    return NextResponse.json(
      { error: msg, status: e?.status ?? 500 },
      { status: 500 }
    );
  }
}
