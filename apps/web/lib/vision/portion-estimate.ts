// Deterministic photo→grams portion estimation (VISION_MODELS_AND_ESTIMATION.md
// §2.1/2.2/2.6). The vision model only identifies and LOCALIZES food (bounding
// boxes); everything gram-shaped happens here, in auditable arithmetic:
//
//   scale (cm-per-box-unit, from a known-size circle/rectangle in frame)
//   → per-item real-world footprint area (cm²)
//   → volume via a per-category pile-height heuristic (cm)
//   → grams via a per-category bulk density (g/cm³)
//
// HONESTY CONTRACT: these are ESTIMATES to prefill the confirmation UI —
// always shown as such, always owner-confirmable, never silently trusted.
// A single top-down photo has no depth information; the height/density
// tables are rough priors, to be recalibrated over time from the
// owner-corrected grams accumulating in bowl_analyses.user_corrected (§2.4).
//
// Geometry note: boxes are Gemini-normalized [ymin, xmin, ymax, xmax] in
// 0–1000 units of the image, whose aspect ratio we don't know server-side.
// Using a CIRCULAR reference (bowl rim, coin) sidesteps that: its real width
// and height are both the diameter, so each axis gets its own cm-per-unit
// factor and the aspect ratio cancels out of every area computed as
// (w × cmPerUnitX) × (h × cmPerUnitY). A credit card gives the same per-axis
// treatment but assumes the card is roughly axis-aligned in frame.

import type { Box2D } from '@/lib/vision/analyze-bowl'

export interface DetectedReferenceObject {
  kind: 'card' | 'coin'
  box_2d: Box2D
  confidence: number
}

export type ScaleBasis = 'bowl_diameter' | 'reference_coin' | 'reference_card'

export interface PhotoScale {
  cmPerUnitX: number
  cmPerUnitY: number
  basis: ScaleBasis
}

/** Real-world reference dimensions (cm). */
const US_QUARTER_DIAMETER_CM = 2.426
const CREDIT_CARD_LONG_CM = 8.56
const CREDIT_CARD_SHORT_CM = 5.398

/** Below this identification confidence we refuse to attach a number —
 *  §2.6: route uncertain items to manual entry, don't show false precision. */
export const ESTIMATE_MIN_CONFIDENCE = 0.6

/** Reference-object detections below this are treated as not present. */
const REFERENCE_MIN_CONFIDENCE = 0.5

/** Sanity clamp for a single item in a dog bowl (grams). */
const MIN_ESTIMATE_G = 5
const MAX_ESTIMATE_G = 1500

const boxWidth = (box: Box2D) => Math.max(0, box[3] - box[1])
const boxHeight = (box: Box2D) => Math.max(0, box[2] - box[0])

/**
 * Food categories with volume priors. `pileHeightCm` is the assumed average
 * depth of that food as served in a bowl; `densityGPerCm3` is loose/as-served
 * bulk density (NOT solid density — kibble pours with air gaps).
 * `estimable=false` marks foods whose depth a top-down photo genuinely can't
 * see (liquids pooled under solids) — we return null rather than guess.
 */
interface CategoryPriors {
  pileHeightCm: number
  densityGPerCm3: number
  estimable: boolean
}

const CATEGORY_PRIORS = {
  ground_meat: { pileHeightCm: 2.0, densityGPerCm3: 0.95, estimable: true },
  chunked_meat: { pileHeightCm: 2.2, densityGPerCm3: 0.85, estimable: true },
  shredded_meat: { pileHeightCm: 2.0, densityGPerCm3: 0.5, estimable: true },
  fish: { pileHeightCm: 1.5, densityGPerCm3: 0.7, estimable: true },
  egg: { pileHeightCm: 1.5, densityGPerCm3: 1.0, estimable: true },
  kibble: { pileHeightCm: 2.5, densityGPerCm3: 0.45, estimable: true },
  cooked_grain: { pileHeightCm: 2.0, densityGPerCm3: 0.7, estimable: true },
  pasta: { pileHeightCm: 2.2, densityGPerCm3: 0.55, estimable: true },
  leafy_greens: { pileHeightCm: 1.2, densityGPerCm3: 0.15, estimable: true },
  chopped_vegetables: { pileHeightCm: 1.6, densityGPerCm3: 0.55, estimable: true },
  puree: { pileHeightCm: 1.2, densityGPerCm3: 1.0, estimable: true },
  fruit: { pileHeightCm: 1.8, densityGPerCm3: 0.6, estimable: true },
  liquid: { pileHeightCm: 0, densityGPerCm3: 1.0, estimable: false },
  unknown: { pileHeightCm: 1.8, densityGPerCm3: 0.6, estimable: true },
} as const satisfies Record<string, CategoryPriors>

export type FoodCategory = keyof typeof CATEGORY_PRIORS

/**
 * Keyword → category matcher over the model's free-text label. First match
 * wins, so more specific patterns come first (same pattern as
 * inferPreparationState in lib/usda-canine.ts). Word-ish boundaries keep
 * "rice" from matching inside another word.
 */
const CATEGORY_PATTERNS: Array<[RegExp, FoodCategory]> = [
  [/\b(broth|water|gravy|milk|soup|stock)\b/, 'liquid'],
  [/\b(ground|minced|mince)\b/, 'ground_meat'],
  [/\b(shredded|pulled|flaked)\b/, 'shredded_meat'],
  [/\b(kibble|dry (dog )?food|pellet)/, 'kibble'],
  [/\b(salmon|tuna|sardine|mackerel|whitefish|herring|fish)\b/, 'fish'],
  [/\begg/, 'egg'],
  [/\b(rice|quinoa|oat|oatmeal|barley|couscous|grain)\b/, 'cooked_grain'],
  [/\b(pasta|macaroni|noodle|spaghetti|penne)\b/, 'pasta'],
  [/\b(spinach|kale|lettuce|arugula|chard|leafy|greens|cabbage)\b/, 'leafy_greens'],
  [/\b(puree|pureed|mash|mashed|paste)\b/, 'puree'],
  [
    /\b(carrot|broccoli|cauliflower|zucchini|pea|green bean|bean|pepper|celery|cucumber|squash|vegetable|veggie)s?\b/,
    'chopped_vegetables',
  ],
  [
    /\b(apple|blueberr|strawberr|banana|melon|watermelon|cranberr|pear|mango|berr)/,
    'fruit',
  ],
  [
    /\b(chicken|beef|turkey|pork|lamb|venison|duck|liver|heart|kidney|meat)\b/,
    'chunked_meat',
  ],
  [/\b(pumpkin|sweet potato|potato)\b/, 'puree'],
]

export function categorizeFood(label: string): FoodCategory {
  const normalized = label.toLowerCase()
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(normalized)) return category
  }
  return 'unknown'
}

/**
 * Derive the photo's cm-per-box-unit scale from whatever known-size object
 * is available, preferring the owner-measured bowl (always in frame,
 * circular, exact for THIS dog) over a coin (standard circle) over a card
 * (standardized but orientation-sensitive).
 */
export function resolveScale(input: {
  bowlBox?: Box2D | null
  bowlDiameterCm?: number | null
  referenceObject?: DetectedReferenceObject | null
}): PhotoScale | null {
  const { bowlBox, bowlDiameterCm, referenceObject } = input

  if (bowlBox && bowlDiameterCm != null && bowlDiameterCm > 0) {
    const w = boxWidth(bowlBox)
    const h = boxHeight(bowlBox)
    if (w > 0 && h > 0) {
      return {
        cmPerUnitX: bowlDiameterCm / w,
        cmPerUnitY: bowlDiameterCm / h,
        basis: 'bowl_diameter',
      }
    }
  }

  if (referenceObject && referenceObject.confidence >= REFERENCE_MIN_CONFIDENCE) {
    const w = boxWidth(referenceObject.box_2d)
    const h = boxHeight(referenceObject.box_2d)
    if (w > 0 && h > 0) {
      if (referenceObject.kind === 'coin') {
        return {
          cmPerUnitX: US_QUARTER_DIAMETER_CM / w,
          cmPerUnitY: US_QUARTER_DIAMETER_CM / h,
          basis: 'reference_coin',
        }
      }
      // Card: assume roughly axis-aligned — long real side maps to the
      // longer box axis. A diagonal card degrades this; the bowl/coin paths
      // are preferred for exactly that reason.
      const longSideIsX = w >= h
      return {
        cmPerUnitX: (longSideIsX ? CREDIT_CARD_LONG_CM : CREDIT_CARD_SHORT_CM) / w,
        cmPerUnitY: (longSideIsX ? CREDIT_CARD_SHORT_CM : CREDIT_CARD_LONG_CM) / h,
        basis: 'reference_card',
      }
    }
  }

  return null
}

/** Bounding boxes overshoot an irregular food pile's true footprint;
 *  approximate the pile as an inscribed ellipse-ish region. */
const FOOTPRINT_FILL_FACTOR = 0.75

/**
 * Estimate one item's as-served weight from its box and the photo scale.
 * Returns null when honesty demands it: no box, uncertain identification
 * (§2.6), a liquid (no visible depth), or a result outside sanity bounds.
 * Rounded to 5 g — anything finer would be false precision.
 */
export function estimateItemGrams(input: {
  label: string
  confidence: number
  box: Box2D | null | undefined
  scale: PhotoScale
}): number | null {
  const { label, confidence, box, scale } = input
  if (!box || confidence < ESTIMATE_MIN_CONFIDENCE) return null

  const priors = CATEGORY_PRIORS[categorizeFood(label)]
  if (!priors.estimable) return null

  const widthCm = boxWidth(box) * scale.cmPerUnitX
  const heightCm = boxHeight(box) * scale.cmPerUnitY
  const footprintCm2 = widthCm * heightCm * FOOTPRINT_FILL_FACTOR
  const grams = footprintCm2 * priors.pileHeightCm * priors.densityGPerCm3

  if (!Number.isFinite(grams) || grams < MIN_ESTIMATE_G || grams > MAX_ESTIMATE_G) {
    return null
  }
  return Math.round(grams / 5) * 5
}
