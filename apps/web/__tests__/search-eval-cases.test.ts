/**
 * Offline tests for the search-eval ground truth (scripts/_search-eval-cases.ts).
 *
 * The scoring predicates are the only part of the eval harness that can be
 * wrong in a way that looks right: a loose predicate turns a failing search
 * into a green report. That is not hypothetical — gate 023's chicken
 * expectation (`/^chicken,/ && segments <= 3`) accepts "Chicken, feet, raw",
 * so it reported green on the exact bug it was written to catch. These tests
 * pin the predicates to literal USDA descriptions so the same thing cannot
 * happen twice.
 *
 * No network, no env: everything here is pure.
 */

import { describe, expect, it } from '@jest/globals'
import {
  PHOTO_CASES,
  STATIC_CASES,
  canonicalTerm,
  derivePrep,
  findCaseForLabel,
  scoreAll,
  scoreBase,
  scorePart,
  scorePrep,
  type EvalCase,
} from '../scripts/_search-eval-cases'

const byQuery = (cases: EvalCase[], query: string): EvalCase => {
  const found = cases.find(c => c.query === query)
  if (!found) throw new Error(`no eval case for ${query}`)
  return found
}

const CHICKEN = byQuery(STATIC_CASES, 'chicken')
const CHICKEN_BREAST = byQuery(STATIC_CASES, 'chicken breast')
const GROUND_TURKEY = byQuery(PHOTO_CASES, 'ground turkey')
const CHICKPEAS = byQuery(PHOTO_CASES, 'chickpeas')
const CARROTS = byQuery(PHOTO_CASES, 'carrots')

const CHICKEN_FEET = 'Chicken, feet, raw'
const CHICKEN_BREAST_COOKED =
  'Chicken, broilers or fryers, breast, meat only, cooked, roasted'

describe('scoring the headline case', () => {
  it('rejects "Chicken, feet, raw" on the part slot', () => {
    // The whole reason this harness exists: gate 023 accepts this row.
    expect(scoreBase(CHICKEN_FEET, CHICKEN)).toBe(true)
    expect(scorePart(CHICKEN_FEET, CHICKEN)).toBe(false)
  })

  it('rejects chicken feet on prep too, when cooked is expected', () => {
    const cookedChicken: EvalCase = { ...CHICKEN, expectedPrep: 'cooked' }
    expect(scorePrep(CHICKEN_FEET, null, cookedChicken)).toBe(false)
    expect(scoreAll(CHICKEN_FEET, null, cookedChicken).fully).toBe(false)
  })

  it('accepts a cooked chicken breast on base, part and prep', () => {
    const s = scoreAll(CHICKEN_BREAST_COOKED, null, CHICKEN)
    expect(s.base).toBe(true)
    expect(s.part).toBe(true)
    // prep is derived from the parser's prep segments — the column is null here
    expect(s.prep).toBe(true)
    expect(s.fully).toBe(true)
  })

  it('accepts the same row for the "chicken breast" case, which demands the cut', () => {
    expect(scoreAll(CHICKEN_BREAST_COOKED, null, CHICKEN_BREAST).fully).toBe(true)
    // A part-less generic chicken row does NOT satisfy a breast query.
    expect(scorePart('Chicken, broilers or fryers, meat only, raw', CHICKEN_BREAST)).toBe(
      false
    )
  })

  it('rejects "Chicken, meatless" — a soy product the part slot cannot see', () => {
    // The parser routes "meatless" to residual, so partOk never sees it; only
    // the name-level disqualifier catches it.
    expect(scoreBase('Chicken, meatless', CHICKEN)).toBe(true)
    expect(scorePart('Chicken, meatless', CHICKEN)).toBe(false)
  })

  it('rejects offal and extremities the parser hides in TRIM or residual', () => {
    expect(scorePart('Turkey, all classes, giblets, cooked, simmered', GROUND_TURKEY)).toBe(
      false
    )
    expect(scorePart('Chicken, broilers or fryers, back, meat only, raw', CHICKEN)).toBe(
      false
    )
    expect(scorePart('Chicken, liver, all classes, raw', CHICKEN)).toBe(false)
  })

  it('rejects "separable fat" — the live default variant of the Chicken group', () => {
    // Found by running the harness: pickDefault elects this row to represent
    // all 78 chicken variants. The parser files "separable fat" as GROUPING,
    // so neither the part slot nor pickDefault's specificity penalty sees it.
    expect(scorePart('Chicken, broilers or fryers, separable fat, raw', CHICKEN)).toBe(
      false
    )
    // ...but the fat DESCRIPTORS on ordinary lean rows must still pass.
    expect(scorePart('Turkey, ground, fat free, raw', GROUND_TURKEY)).toBe(true)
    expect(scorePart('Turkey, ground, 93% lean, 7% fat, raw', GROUND_TURKEY)).toBe(true)
  })

  it('still accepts an ordinary "meat and skin" row — only "skin only" is skin', () => {
    expect(
      scorePart('Turkey, whole, light meat, meat and skin, cooked, roasted', GROUND_TURKEY)
    ).toBe(true)
    expect(scorePart('Chicken, skin only, raw', CHICKEN)).toBe(false)
  })
})

describe('photo ground truth', () => {
  it('accepts cooked ground turkey', () => {
    expect(scoreAll('Turkey, ground, cooked', null, GROUND_TURKEY).fully).toBe(true)
  })

  it('fails raw ground turkey on prep only', () => {
    const s = scoreAll('Turkey, ground, raw', 'raw', GROUND_TURKEY)
    expect(s.base).toBe(true)
    expect(s.part).toBe(true)
    expect(s.prep).toBe(false)
  })

  it('resolves the chickpea synonyms and the "mature seeds" grouping segment', () => {
    // "seeds" is USDA scaffolding on the row we WANT, so it must not be a
    // disqualifier — this is the regression that guards that.
    const name = 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt'
    expect(scoreAll(name, 'cooked', CHICKPEAS).fully).toBe(true)
    expect(canonicalTerm('garbanzo beans')).toBe(canonicalTerm('chickpeas'))
  })

  it('rejects plant products that are not the plant', () => {
    expect(scorePart('Carrot juice, canned', CARROTS)).toBe(false)
    expect(scoreBase('Hummus, commercial', CHICKPEAS)).toBe(false)
  })

  it('accepts cooked carrots and rejects raw ones', () => {
    const cooked = 'Carrots, cooked, boiled, drained, without salt'
    expect(scoreAll(cooked, 'cooked', CARROTS).fully).toBe(true)
    expect(scorePrep('Carrots, raw', 'raw', CARROTS)).toBe(false)
  })
})

describe('derivePrep', () => {
  it('prefers the stored column', () => {
    expect(derivePrep('Turkey, ground, cooked', 'raw')).toBe('raw')
  })

  it('falls back to the parser prep segments when the column is null', () => {
    expect(derivePrep(CHICKEN_BREAST_COOKED, null)).toBe('cooked')
    expect(derivePrep(CHICKEN_FEET, null)).toBe('raw')
  })

  it('returns null when nothing states a prep state', () => {
    expect(derivePrep('Spinach', null)).toBeNull()
  })

  it("is not consulted when the case's expectedPrep is 'any'", () => {
    expect(scorePrep('Chicken, broilers or fryers, meat only, raw', null, CHICKEN)).toBe(
      true
    )
  })
})

describe('findCaseForLabel', () => {
  it('resolves Gemini phrasing drift to the same case', () => {
    for (const label of ['ground turkey', 'cooked ground turkey', 'turkey']) {
      expect(findCaseForLabel(label)?.query).toBe('ground turkey')
    }
  })

  it('resolves plural/singular and modifier drift', () => {
    expect(findCaseForLabel('shredded carrots')?.query).toBe('carrots')
    expect(findCaseForLabel('carrot')?.query).toBe('carrots')
    expect(findCaseForLabel('chickpeas')?.query).toBe('chickpeas')
    expect(findCaseForLabel('garbanzo beans')?.query).toBe('chickpeas')
  })

  it('returns null for labels with no ground truth, rather than guessing', () => {
    // 028 reports these as UNANNOTATED instead of scoring them.
    expect(findCaseForLabel('kibble')).toBeNull()
    expect(findCaseForLabel('white rice')).toBeNull()
    expect(findCaseForLabel('')).toBeNull()
  })

  it('refuses a partial overlap where neither side contains the other', () => {
    // "turkey broth" shares one term with "ground turkey" but is a different
    // food; matching it would score broth rows against turkey-meat truth.
    expect(findCaseForLabel('turkey broth')).toBeNull()
  })
})
