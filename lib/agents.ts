// lib/agents.ts
// THE CORE FILE — 3 Claude API calls
// This is the heart of GrowthBook. Read this first.

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export type PhotoResult = {
  id: string;
  base64: string;
  mimeType: string;
  keep: boolean;           // Agent 1 decision
  rejectReason?: string;   // "blurry" | "duplicate" | "eyes_closed"
  caption?: string;        // Agent 2 output
  voiceNote?: string;      // Parent's voice transcript
  tags?: string[];         // Agent 2 tags
  date?: string;           // from EXIF or upload time
};

export type Language = "en" | "zh" | "fr";

// ─────────────────────────────────────────
// AGENT 1 — Filter
// Looks at each photo and decides: keep or skip
// Input: array of base64 images
// Output: same array with keep: true/false
// ─────────────────────────────────────────

export async function agent1_filter(
  photos: { id: string; base64: string; mimeType: string }[]
): Promise<PhotoResult[]> {
  return Promise.all(
    photos.map(async (photo) => {
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: photo.mimeType as "image/jpeg" | "image/png" | "image/webp",
                    data: photo.base64,
                  },
                },
                {
                  type: "text",
                  text: `You are a photo quality filter for a children's memory app.

Analyze this photo and respond with JSON only, no other text:
{
  "keep": true or false,
  "reason": "blurry" | "eyes_closed" | "duplicate_composition" | "too_dark" | "good"
}

Keep the photo if: it's reasonably sharp, the subject is visible, eyes are open, good lighting.
Reject if: very blurry, eyes clearly closed, extremely dark/overexposed.
When in doubt, KEEP — parents prefer to keep memories.`,
                },
              ],
            },
          ],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        return {
          ...photo,
          keep: parsed.keep,
          rejectReason: parsed.keep ? undefined : parsed.reason,
        } as PhotoResult;
      } catch {
        return { ...photo, keep: true } as PhotoResult;
      }
    })
  );
}

// ─────────────────────────────────────────
// AGENT 2 — Describe
// Generates a warm caption for each kept photo
// Input: filtered photos (keep: true only)
// Output: photos with caption + tags added
// ─────────────────────────────────────────

export async function agent2_describe(
  photos: PhotoResult[],
  language: Language = "en",
  childName?: string,
  voiceNotes?: Record<string, string> // photoId → voice transcript
): Promise<PhotoResult[]> {
  
  const langInstructions = {
    en: "Write in warm, natural English. Like a loving parent wrote it.",
    zh: "用温暖自然的中文写作，像一位充满爱意的父母写的日记一样。",
    fr: "Écris en français chaleureux et naturel. Comme un parent aimant.",
  };

  const keptPhotos = photos.filter((p) => p.keep);
  const results = [...photos];

  const described = await Promise.all(
    keptPhotos.map(async (photo) => {
      const voiceNote = voiceNotes?.[photo.id];
      const nameContext = childName ? `The child's name is ${childName}.` : "";
      const voiceContext = voiceNote
        ? `The parent added this voice note: "${voiceNote}". Incorporate their words naturally.`
        : "";

      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: photo.mimeType as "image/jpeg" | "image/png" | "image/webp",
                    data: photo.base64,
                  },
                },
                {
                  type: "text",
                  text: `You are writing captions for a children's memory book app.

${nameContext}
${voiceContext}

${langInstructions[language]}

Respond with JSON only:
{
  "caption": "1-2 warm sentences describing this moment (max 40 words)",
  "tags": ["tag1", "tag2"],
  "moment_type": "milestone" | "everyday" | "playful" | "tender" | "outdoors" | "learning"
}

Tags should be short (1-2 words), in the same language as the caption.
Caption should feel personal, not generic. Capture the emotion, not just the action.`,
                },
              ],
            },
          ],
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        return {
          id: photo.id,
          caption: parsed.caption as string,
          tags: parsed.tags as string[],
          voiceNote,
        };
      } catch {
        return {
          id: photo.id,
          caption:
            language === "zh"
              ? "珍贵的一刻。"
              : language === "fr"
              ? "Un moment précieux."
              : "A precious moment.",
          tags: [] as string[],
          voiceNote,
        };
      }
    })
  );

  for (const d of described) {
    const idx = results.findIndex((p) => p.id === d.id);
    if (idx >= 0) {
      results[idx] = {
        ...results[idx],
        caption: d.caption,
        tags: d.tags,
        voiceNote: d.voiceNote,
      };
    }
  }

  return results;
}

// ─────────────────────────────────────────
// AGENT 3 — Layout / Highlight selection
// Picks the best photos and assigns display weight
// Input: described photos
// Output: photos sorted + sized for waterfall grid
// ─────────────────────────────────────────

export type DisplayPhoto = PhotoResult & {
  displaySize: "large" | "medium" | "small";
  isHighlight: boolean;
  displayOrder: number;
  imageUrl?: string; // Supabase Storage public URL
};

export async function agent3_layout(
  photos: PhotoResult[],
  language: Language = "en"
): Promise<DisplayPhoto[]> {
  
  const keptPhotos = photos.filter((p) => p.keep);
  
  // Build a summary for Claude to reason about (no images needed here)
  const photoSummary = keptPhotos.map((p, i) => ({
    id: p.id,
    index: i,
    tags: p.tags,
    moment_type: "general",
    caption_preview: p.caption?.slice(0, 60),
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: `You are a memory book layout designer.

Given these photos from a child's memory collection, decide:
1. Display order (chronological, but milestones first)
2. Display size for waterfall grid
3. Which ones are "highlights" (top 3 max)

Photos: ${JSON.stringify(photoSummary)}

Respond with JSON only:
{
  "layout": [
    {
      "id": "photo_id",
      "displaySize": "large" | "medium" | "small",
      "isHighlight": true | false,
      "displayOrder": 1
    }
  ]
}

Rules:
- Max 2 "large" per batch
- Milestones and emotionally rich moments → large
- Everyday moments → small or medium
- Highlights = top 3 most memorable moments only`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    const layoutMap: Record<string, { displaySize: string; isHighlight: boolean; displayOrder: number }> = {};
    
    parsed.layout.forEach((item: { id: string; displaySize: string; isHighlight: boolean; displayOrder: number }) => {
      layoutMap[item.id] = item;
    });

    return keptPhotos.map((photo, i) => ({
      ...photo,
      displaySize: (layoutMap[photo.id]?.displaySize as "large" | "medium" | "small") || "medium",
      isHighlight: layoutMap[photo.id]?.isHighlight || false,
      displayOrder: layoutMap[photo.id]?.displayOrder || i + 1,
    })).sort((a, b) => a.displayOrder - b.displayOrder);

  } catch {
    // Fallback: all medium, no highlights
    return keptPhotos.map((photo, i) => ({
      ...photo,
      displaySize: "medium" as const,
      isHighlight: i === 0,
      displayOrder: i + 1,
    }));
  }
}

// ─────────────────────────────────────────
// PIPELINE — Run all 3 agents in sequence
// This is what you call from your upload page
// ─────────────────────────────────────────

export async function runPipeline(
  rawPhotos: { id: string; base64: string; mimeType: string }[],
  options: {
    language?: Language;
    childName?: string;
    voiceNotes?: Record<string, string>;
    onProgress?: (step: 1 | 2 | 3) => void;
  } = {}
): Promise<DisplayPhoto[]> {
  
  const { language = "en", childName, voiceNotes, onProgress } = options;

  // Agent 1
  onProgress?.(1);
  const filtered = await agent1_filter(rawPhotos);
  
  // Agent 2
  onProgress?.(2);
  const described = await agent2_describe(filtered, language, childName, voiceNotes);
  
  // Agent 3
  onProgress?.(3);
  const laid_out = await agent3_layout(described, language);

  return laid_out;
}
