import { describe, expect, test } from '@jest/globals'
import {
  BOWL_VISION_MODEL,
  parseBowlAnalysis,
} from '@/lib/vision/analyze-bowl'

// Representative structured output from the vision model (fixture — no
// network in tests; the live call is exercised in Cypress/manual QA once
// ANTHROPIC_API_KEY is configured).
const validFixture = {
  items: [
    { label: 'ground turkey', estimated_proportion: 0.5, confidence: 0.92 },
    { label: 'white rice', estimated_proportion: 0.3, confidence: 0.88 },
    { label: 'spinach', estimated_proportion: 0.15, confidence: 0.6 },
    { label: 'blueberries', estimated_proportion: 0.05, confidence: 0.85 },
  ],
  notes: 'Leafy green could be spinach or kale; assumed spinach.',
}

describe('parseBowlAnalysis', () => {
  test('accepts a valid model payload', () => {
    const result = parseBowlAnalysis(validFixture)
    expect(result.items).toHaveLength(4)
    expect(result.items[0].label).toBe('ground turkey')
    const total = result.items.reduce((s, i) => s + i.estimated_proportion, 0)
    expect(total).toBeCloseTo(1, 1)
  })

  test('rejects proportions outside 0..1', () => {
    expect(() =>
      parseBowlAnalysis({
        items: [{ label: 'rice', estimated_proportion: 1.5, confidence: 0.9 }],
        notes: '',
      })
    ).toThrow()
  })

  test('rejects missing fields', () => {
    expect(() =>
      parseBowlAnalysis({ items: [{ label: 'rice' }], notes: '' })
    ).toThrow()
    expect(() => parseBowlAnalysis({ notes: 'no items key' })).toThrow()
  })

  test('rejects empty labels', () => {
    expect(() =>
      parseBowlAnalysis({
        items: [{ label: '', estimated_proportion: 0.5, confidence: 0.5 }],
        notes: '',
      })
    ).toThrow()
  })

  test('model version is pinned and explicit', () => {
    expect(BOWL_VISION_MODEL).toBe('gemini-2.5-flash')
  })
})
