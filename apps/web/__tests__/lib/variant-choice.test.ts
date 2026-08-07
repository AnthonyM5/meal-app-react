// Preparation state must never be defaulted.
//
// Nothing in the pipeline observed whether a bowl was cooked, yet every item
// resolved to a raw row — an artifact of flat search preferring short names
// ("Carrots, raw" is a shorter string than "Carrots, cooked, boiled, drained,
// without salt"). matchIngredientWithCanonical then narrowed its ambiguity
// spread to variants sharing that assumed state, which filtered away the one
// question worth asking. These tests pin the replacement rule: unobserved
// preparation + a group that offers more than one state => the owner chooses.

import { describe, expect, it } from '@jest/globals'
import { describeVariantChoice, type CanonicalMatch } from '@pawplate/core/types'
import { pickPrepVariant } from '@/lib/resolve-ingredient'

const base: CanonicalMatch = {
  canonicalId: 'c1',
  displayName: 'Carrot',
  variantCount: 4,
  requiresChoice: true,
  prepUnresolved: false,
  availablePreparations: ['cooked', 'raw'],
  kcalRange: [35, 41],
  fatRange: [0.13, 0.35],
}

describe('describeVariantChoice', () => {
  it('names preparation as the reason when that is the reason', () => {
    const text = describeVariantChoice({ ...base, prepUnresolved: true })
    expect(text).toMatch(/cooked or raw/)
    expect(text).toMatch(/won't guess/)
    // The old copy explained EVERY prompt as a nutrient spread, which reads as
    // nonsense on carrots: 35-41 kcal is not why we are asking.
    expect(text).not.toMatch(/skews the whole bowl/)
  })

  it('still explains a genuine nutrient spread', () => {
    const text = describeVariantChoice({
      ...base,
      displayName: 'Beef ground',
      kcalRange: [121, 332],
      fatRange: [5, 30],
    })
    expect(text).toMatch(/121–332 kcal/)
    expect(text).toMatch(/skews the whole bowl/)
    expect(text).not.toMatch(/won't guess/)
  })

  it('does not fall apart when the group has no usable ranges', () => {
    const text = describeVariantChoice({
      ...base,
      prepUnresolved: true,
      kcalRange: null,
      fatRange: null,
    })
    expect(text).toMatch(/cooked or raw/)
    expect(text).not.toMatch(/undefined|null|NaN/)
  })

  it('falls back to generic wording when the states list is empty', () => {
    const text = describeVariantChoice({
      ...base,
      prepUnresolved: true,
      availablePreparations: [],
    })
    expect(text).toMatch(/raw or cooked/)
    expect(text).not.toMatch(/undefined|null/)
  })
})

// The decision table the resolver implements. Kept as a pure re-statement of
// the rule so the intent is testable without a database: the live behavior is
// exercised by scripts/028 against the real corpus.
describe('the prep-choice rule', () => {
  const requiresChoice = (
    prepObserved: boolean,
    distinctPreps: number
  ): boolean => !prepObserved && distinctPreps > 1

  it('asks when preparation was not observed and the group offers a choice', () => {
    expect(requiresChoice(false, 2)).toBe(true)
  })

  it('does not ask when the model actually observed the preparation', () => {
    // Evidence is not a default — a stated value narrows, as before.
    expect(requiresChoice(true, 2)).toBe(false)
  })

  it('does not ask when the group only has one preparation state', () => {
    // "Raw or cooked?" is not a question when every variant is raw.
    expect(requiresChoice(false, 1)).toBe(false)
    expect(requiresChoice(false, 0)).toBe(false)
  })
})

// Flat search cannot reach a cooked chickpea row: USDA's long description
// scores 0.419, under the 0.5 match floor, while the terse "dry" row wins at
// 0.753. The canonical group is the candidate set that CAN reach it.
describe('pickPrepVariant', () => {
  const variants = [
    { id: 'dry', name: 'Chickpeas, (garbanzo beans, bengal gram), dry', preparation_state: null },
    { id: 'raw', name: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', preparation_state: 'raw' },
    { id: 'salt', name: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, with salt', preparation_state: 'cooked' },
    { id: 'nosalt', name: 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled', preparation_state: 'cooked' },
  ]

  it('finds a cooked sibling that flat search scores below the floor', () => {
    expect(pickPrepVariant(variants, 'cooked')?.id).toBe('nosalt')
  })

  it('prefers the least-qualified match — "with salt" is a specialization', () => {
    expect(pickPrepVariant(variants, 'cooked')?.id).not.toBe('salt')
  })

  it('never serves a different food that over-merged into the group', () => {
    // Found end-to-end: "Broccoli, chinese, cooked" (gai lan) is the SHORTEST
    // cooked row in the `broccoli` group, so ordering by name length alone
    // served it for "broccoli". Parser residual ranks it last instead —
    // 'chinese' is a segment the parser could not classify.
    const broccoli = [
      { id: 'gailan', name: 'Broccoli, chinese, cooked', preparation_state: 'cooked' },
      {
        id: 'real',
        name: 'Broccoli, cooked, boiled, drained, without salt',
        preparation_state: 'cooked',
      },
    ]
    expect(pickPrepVariant(broccoli, 'cooked')?.id).toBe('real')
  })

  it('finds raw too, and ignores rows with no stated preparation', () => {
    expect(pickPrepVariant(variants, 'raw')?.id).toBe('raw')
  })

  it('returns null rather than substituting when the group has no such prep', () => {
    const rawOnly = variants.filter(v => v.preparation_state !== 'cooked')
    expect(pickPrepVariant(rawOnly, 'cooked')).toBeNull()
    expect(pickPrepVariant([], 'raw')).toBeNull()
  })
})
