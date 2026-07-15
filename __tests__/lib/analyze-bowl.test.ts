import { describe, expect, test } from '@jest/globals'
import {
  BOWL_VISION_MODEL,
  MAX_USER_HINT_LENGTH,
  buildUserPrompt,
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

describe('buildUserPrompt', () => {
  test('without a hint, asks only for identification', () => {
    const prompt = buildUserPrompt()
    expect(prompt).toContain('Identify the food items')
    expect(prompt).not.toContain("Owner's note")
  })

  test('folds a hint into the prompt', () => {
    const prompt = buildUserPrompt(
      "there's also ground beef and shredded chicken mixed in"
    )
    expect(prompt).toContain('Identify the food items')
    expect(prompt).toContain(
      "Owner's note about this bowl: there's also ground beef and shredded chicken mixed in"
    )
  })

  test('blank or whitespace hints are ignored', () => {
    expect(buildUserPrompt('   ')).toBe(buildUserPrompt())
    expect(buildUserPrompt('')).toBe(buildUserPrompt())
  })

  test('hints are trimmed and capped at the max length', () => {
    const prompt = buildUserPrompt(`  ${'x'.repeat(MAX_USER_HINT_LENGTH + 50)}  `)
    expect(prompt).toContain(`Owner's note about this bowl: ${'x'.repeat(MAX_USER_HINT_LENGTH)}`)
    expect(prompt).not.toContain('x'.repeat(MAX_USER_HINT_LENGTH + 1))
  })
})
