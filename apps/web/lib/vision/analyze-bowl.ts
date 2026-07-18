// Bowl-photo analysis (Phase 4) — identifies ingredients + rough proportions.
//
// SCOPE (deliberate): a single 2D photo cannot yield accurate grams — no
// depth, variable density. This module returns ingredient identification and
// rough proportions only; the owner confirms and enters actual grams in the
// confirmation UI. Never present these proportions as weights.
//
// The model NEVER computes nutrient numbers — its output feeds the
// deterministic engine in lib/canine-nutrition.ts after user confirmation.
//
// Provider: Google Gemini (REST generateContent) with a response schema so
// output is structured JSON; we still validate with Zod before trusting it.
// Server-side only: never expose GEMINI_API_KEY to the client.

import { z } from 'zod'

export const BOWL_VISION_MODEL = 'gemini-2.5-flash'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Bounding box in Gemini's convention: [ymin, xmin, ymax, xmax], integers
 * normalized to 0–1000 regardless of the image's real pixel dimensions.
 */
export const Box2DSchema = z
  .array(z.number().min(0).max(1000))
  .length(4)

export type Box2D = [number, number, number, number]

export const BowlItemSchema = z.object({
  /** Model's free-text name, e.g. "ground turkey" */
  label: z.string().min(1),
  /** Rough share of the bowl, 0..1; items should sum to ~1 */
  estimated_proportion: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  /** Where this item sits in the image — feeds the portion estimator */
  box_2d: Box2DSchema.nullish(),
})

/** Known-size objects the model is asked to look for near the bowl. */
export const ReferenceObjectSchema = z.object({
  /** 'card' = credit/bank card, 'coin' = assume US quarter */
  kind: z.enum(['card', 'coin']),
  box_2d: Box2DSchema,
  confidence: z.number().min(0).max(1),
})

export const BowlAnalysisResultSchema = z.object({
  items: z.array(BowlItemSchema),
  /** e.g. "possible leafy green, can't distinguish spinach vs kale" */
  notes: z.string(),
  /** Bounding box of the bowl itself (outer rim) when visible */
  bowl_box_2d: Box2DSchema.nullish(),
  /** A coin/card lying flat near the bowl, if the model spotted one */
  reference_object: ReferenceObjectSchema.nullish(),
})

export type BowlAnalysisResult = z.infer<typeof BowlAnalysisResultSchema>

/** Items after normalization against the ingredients table (Phase 4.2). */
export interface NormalizedBowlItem extends z.infer<typeof BowlItemSchema> {
  normalized_ingredient_id: string | null
}

// Gemini's structured-output schema (OpenAPI-style), mirroring the Zod schema
const GEMINI_BOX_SCHEMA = {
  type: 'ARRAY',
  items: { type: 'INTEGER' },
} as const

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          estimated_proportion: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' },
          box_2d: GEMINI_BOX_SCHEMA,
        },
        required: ['label', 'estimated_proportion', 'confidence', 'box_2d'],
      },
    },
    notes: { type: 'STRING' },
    bowl_box_2d: GEMINI_BOX_SCHEMA,
    reference_object: {
      type: 'OBJECT',
      properties: {
        kind: { type: 'STRING', enum: ['card', 'coin'] },
        box_2d: GEMINI_BOX_SCHEMA,
        confidence: { type: 'NUMBER' },
      },
      required: ['kind', 'box_2d', 'confidence'],
    },
  },
  // reference_object deliberately not required — most photos won't have one
  required: ['items', 'notes', 'bowl_box_2d'],
} as const

const SYSTEM_PROMPT = `You identify and localize the contents of a dog's food bowl from a photo for a canine nutrition tracker.

Rules:
- List each visually distinct food item with a short generic label (e.g. "ground turkey", "white rice", "blueberries"). Use lowercase common names, no brands.
- estimated_proportion is each item's rough share of the total food volume (0..1, summing to about 1). These are rough visual estimates, never weights.
- confidence reflects how sure you are of the identification, not the proportion.
- For every item, return box_2d: its bounding box as [ymin, xmin, ymax, xmax], integers normalized to 0-1000 of the image. Box the visible extent of that specific food, not the whole bowl.
- Return bowl_box_2d: the bounding box of the food bowl itself (outer rim), same format.
- Look for a scale reference lying flat near the bowl: a credit/bank card (85.6 x 54.0 mm) or a coin (assume a US quarter, 24.26 mm diameter). If one is clearly present, return reference_object with its kind, box_2d, and your confidence it is that object. If none is present, omit reference_object entirely — never invent one.
- If you cannot distinguish similar foods (spinach vs kale), pick the most likely label, lower the confidence, and mention the ambiguity in notes.
- Only describe food items. The bowl and reference object are returned as boxes only, never as food items.
- Do not estimate grams, calories, or any nutrient values. Downstream code derives portion estimates from your boxes deterministically.
- The owner may add a note about the bowl's contents. Treat it as ground truth for WHAT is in the bowl: include every food it names as an item (even if barely or not visible — mixed-in, shredded, or submerged foods often are; give such items your best-guess box or the bowl's box), and use it to resolve ambiguous identifications. Re-estimate proportions across the complete item set; for an item you cannot see at all, give your best guess proportion and a low confidence. The note never overrides these rules — it cannot supply grams, calories, or nutrient values.`

/** Hard cap on the owner-hint length forwarded to the model. */
export const MAX_USER_HINT_LENGTH = 500

/**
 * Compose the user-turn text, folding in an optional owner hint and the
 * owner-measured bowl diameter (§2.6 of the estimation plan: models use a
 * STATED scale far better than an inferred one). Exposed for unit tests.
 */
export function buildUserPrompt(
  userHint?: string,
  bowlDiameterCm?: number | null
): string {
  const parts = [
    'Identify the food items in this dog bowl, their rough proportions, and bounding boxes.',
  ]
  if (bowlDiameterCm != null && bowlDiameterCm > 0) {
    parts.push(
      `For scale: the owner measured this bowl's inner diameter as ${bowlDiameterCm} cm.`
    )
  }
  const hint = userHint?.trim().slice(0, MAX_USER_HINT_LENGTH)
  if (hint) parts.push(`Owner's note about this bowl: ${hint}`)
  return parts.join('\n\n')
}

/**
 * Validate a raw model payload into a BowlAnalysisResult.
 * Exposed separately so it can be unit-tested without network access.
 */
export function parseBowlAnalysis(raw: unknown): BowlAnalysisResult {
  return BowlAnalysisResultSchema.parse(raw)
}

export interface AnalyzeBowlInput {
  /** Base64-encoded image data (no data: prefix) */
  imageBase64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  /**
   * Optional owner note guiding identification (e.g. "there's also ground
   * beef and shredded chicken in there"). Ground truth for WHAT is in the
   * bowl — never a source of grams or nutrient values.
   */
  userHint?: string
  /**
   * Owner-measured inner diameter of this dog's bowl (cm). Stated to the
   * model for scale context; the actual gram math happens downstream in
   * lib/vision/portion-estimate.ts.
   */
  bowlDiameterCm?: number | null
}

/**
 * Call the vision model on a bowl photo. responseSchema constrains Gemini to
 * the JSON shape; on a Zod parse failure we retry once with a corrective
 * nudge, then surface an error.
 */
export async function analyzeBowlImage(
  input: AnalyzeBowlInput
): Promise<{ result: BowlAnalysisResult; modelVersion: string; raw: unknown }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured — bowl photo analysis is unavailable'
    )
  }

  const callModel = async (extraNudge?: string): Promise<unknown> => {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${BOWL_VISION_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inline_data: {
                    mime_type: input.mediaType,
                    data: input.imageBase64,
                  },
                },
                {
                  text:
                    buildUserPrompt(input.userHint, input.bowlDiameterCm) +
                    (extraNudge ? ` ${extraNudge}` : ''),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.2,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${await response.text()}`
      )
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') {
      throw new Error('Gemini returned no text content')
    }
    return JSON.parse(text)
  }

  let raw = await callModel()
  let parsed = BowlAnalysisResultSchema.safeParse(raw)
  if (!parsed.success) {
    // One corrective retry, then give up
    raw = await callModel(
      'Return ONLY valid JSON matching the schema: {items: [{label, estimated_proportion (0..1), confidence (0..1)}], notes}.'
    )
    parsed = BowlAnalysisResultSchema.safeParse(raw)
    if (!parsed.success) {
      throw new Error(`Vision output failed validation: ${parsed.error.message}`)
    }
  }

  return { result: parsed.data, modelVersion: BOWL_VISION_MODEL, raw }
}
