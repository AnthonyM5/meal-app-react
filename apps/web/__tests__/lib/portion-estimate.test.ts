import { describe, expect, test } from '@jest/globals'
import type { Box2D } from '@/lib/vision/analyze-bowl'
import {
  ESTIMATE_MIN_CONFIDENCE,
  categorizeFood,
  estimateItemGrams,
  resolveScale,
} from '@/lib/vision/portion-estimate'

// Boxes are [ymin, xmin, ymax, xmax] in 0–1000 normalized units.
const box = (ymin: number, xmin: number, ymax: number, xmax: number): Box2D => [
  ymin,
  xmin,
  ymax,
  xmax,
]

describe('resolveScale', () => {
  test('derives per-axis scale from an owner-measured bowl', () => {
    // Bowl spans 500 units wide, 400 tall; real diameter 20 cm. The circle's
    // real width and height are both the diameter, so the (unknown) image
    // aspect ratio is absorbed into separate per-axis factors.
    const scale = resolveScale({
      bowlBox: box(300, 250, 700, 750),
      bowlDiameterCm: 20,
    })
    expect(scale).not.toBeNull()
    expect(scale!.basis).toBe('bowl_diameter')
    expect(scale!.cmPerUnitX).toBeCloseTo(20 / 500)
    expect(scale!.cmPerUnitY).toBeCloseTo(20 / 400)
  })

  test('falls back to a detected coin when no bowl diameter is set', () => {
    const scale = resolveScale({
      bowlBox: box(0, 0, 1000, 1000),
      bowlDiameterCm: null,
      referenceObject: {
        kind: 'coin',
        box_2d: box(100, 100, 150, 150),
        confidence: 0.9,
      },
    })
    expect(scale!.basis).toBe('reference_coin')
    // US quarter: 2.426 cm over 50 units on each axis
    expect(scale!.cmPerUnitX).toBeCloseTo(2.426 / 50)
    expect(scale!.cmPerUnitY).toBeCloseTo(2.426 / 50)
  })

  test('maps a card long side to the longer box axis', () => {
    const scale = resolveScale({
      referenceObject: {
        kind: 'card',
        box_2d: box(100, 100, 160, 260), // 160 wide, 60 tall → landscape
        confidence: 0.9,
      },
    })
    expect(scale!.basis).toBe('reference_card')
    expect(scale!.cmPerUnitX).toBeCloseTo(8.56 / 160)
    expect(scale!.cmPerUnitY).toBeCloseTo(5.398 / 60)
  })

  test('owner-measured bowl wins over a reference object', () => {
    const scale = resolveScale({
      bowlBox: box(0, 0, 400, 400),
      bowlDiameterCm: 18,
      referenceObject: {
        kind: 'coin',
        box_2d: box(0, 0, 50, 50),
        confidence: 0.95,
      },
    })
    expect(scale!.basis).toBe('bowl_diameter')
  })

  test('ignores a low-confidence reference object', () => {
    const scale = resolveScale({
      referenceObject: {
        kind: 'coin',
        box_2d: box(0, 0, 50, 50),
        confidence: 0.3,
      },
    })
    expect(scale).toBeNull()
  })

  test('returns null with no usable reference at all', () => {
    expect(resolveScale({ bowlBox: box(0, 0, 500, 500) })).toBeNull()
    expect(resolveScale({ bowlDiameterCm: 20 })).toBeNull()
    expect(resolveScale({})).toBeNull()
  })

  test('rejects a degenerate (zero-area) bowl box', () => {
    expect(
      resolveScale({ bowlBox: box(100, 100, 100, 500), bowlDiameterCm: 20 })
    ).toBeNull()
  })
})

describe('categorizeFood', () => {
  test.each([
    ['ground beef', 'ground_meat'],
    ['shredded chicken', 'shredded_meat'],
    ['chicken breast', 'chunked_meat'],
    ['dry kibble', 'kibble'],
    ['white rice', 'cooked_grain'],
    ['macaroni', 'pasta'],
    ['red cabbage', 'leafy_greens'],
    ['pumpkin puree', 'puree'],
    ['sweet potato', 'puree'],
    ['carrots', 'chopped_vegetables'],
    ['blueberries', 'fruit'],
    ['salmon', 'fish'],
    ['bone broth', 'liquid'],
    ['mystery mixture', 'unknown'],
  ] as const)('%s → %s', (label, category) => {
    expect(categorizeFood(label)).toBe(category)
  })

  test('preparation word beats the meat noun', () => {
    // "ground" is more informative for density than "beef"
    expect(categorizeFood('ground turkey')).toBe('ground_meat')
  })
})

describe('estimateItemGrams', () => {
  // 20 cm bowl spanning 500 units square → 0.04 cm/unit on both axes
  const scale = resolveScale({
    bowlBox: box(250, 250, 750, 750),
    bowlDiameterCm: 20,
  })!

  test('computes a hand-checkable estimate for ground meat', () => {
    // Box 250×250 units → 10cm × 10cm → 100 cm² × 0.75 fill = 75 cm²
    // × 2.0 cm pile height × 0.95 g/cm³ = 142.5 g → rounded to 145
    const grams = estimateItemGrams({
      label: 'ground beef',
      confidence: 0.9,
      box: box(0, 0, 250, 250),
      scale,
    })
    expect(grams).toBe(145)
  })

  test('returns a 5 g-rounded value', () => {
    const grams = estimateItemGrams({
      label: 'white rice',
      confidence: 0.9,
      box: box(0, 0, 300, 220),
      scale,
    })
    expect(grams! % 5).toBe(0)
  })

  test('refuses low-confidence identifications', () => {
    const grams = estimateItemGrams({
      label: 'ground beef',
      confidence: ESTIMATE_MIN_CONFIDENCE - 0.01,
      box: box(0, 0, 250, 250),
      scale,
    })
    expect(grams).toBeNull()
  })

  test('refuses items with no box', () => {
    expect(
      estimateItemGrams({ label: 'ground beef', confidence: 0.9, box: null, scale })
    ).toBeNull()
  })

  test('refuses liquids — a top-down photo cannot see their depth', () => {
    expect(
      estimateItemGrams({
        label: 'bone broth',
        confidence: 0.95,
        box: box(0, 0, 500, 500),
        scale,
      })
    ).toBeNull()
  })

  test('clamps absurd results to null instead of showing them', () => {
    // A tiny sliver of leafy greens lands under the 5 g floor
    expect(
      estimateItemGrams({
        label: 'spinach',
        confidence: 0.9,
        box: box(0, 0, 40, 40),
        scale,
      })
    ).toBeNull()
  })
})
