// Query understanding for refined ingredient search (Phase A).
// Mirrors food-name-parser.test.ts in style: named expectations against real
// owner phrasing, plus a drift guard tying the reader's keywords back to the
// writer's gazetteers in @pawplate/core/food-vocab.

import { describe, expect, it } from '@jest/globals'
import {
  inferPrepState,
  matchesAny,
  PREP,
  STATE_NEUTRAL_METHODS,
  TRIM,
} from '@pawplate/core/food-vocab'
import { inferPreparationState } from '@/lib/usda-canine'
import {
  COOKING_METHODS,
  filterAndRankVariants,
  leanMatchesTrim,
  parseSearchQuery,
  RAW_STATES,
  TRIM_PHRASES,
  variantMatchesHardFacets,
  variantMatchesMethod,
} from '@pawplate/core/search-query'

describe('parseSearchQuery', () => {
  describe('the headline examples', () => {
    it('"beef, 80% lean" → beef retrieval + leanPct 80', () => {
      const p = parseSearchQuery('beef, 80% lean')
      expect(p.retrievalTerms).toBe('beef')
      expect(p.facets.leanPct).toBe(80)
      expect(p.facets.prepState).toBeUndefined()
    })

    it('"raw chicken breast" → hard raw + chicken breast', () => {
      const p = parseSearchQuery('raw chicken breast')
      expect(p.retrievalTerms).toBe('chicken breast')
      expect(p.facets.prepState).toBe('raw')
    })

    it('"broiled ground beef" → cooked + method broiled, ground stays a term', () => {
      const p = parseSearchQuery('broiled ground beef')
      expect(p.retrievalTerms).toBe('ground beef')
      expect(p.facets.prepState).toBe('cooked')
      expect(p.facets.cookingMethod).toEqual(['broiled'])
    })

    it('"ground beef" routes to the ground group — ground is NOT a facet', () => {
      const p = parseSearchQuery('ground beef')
      expect(p.retrievalTerms).toBe('ground beef')
      expect(p.facets).toEqual({})
    })
  })

  describe('lean percentage forms', () => {
    it.each([
      ['beef 80% lean', 80],
      ['beef 80 % lean', 80],
      ['beef 80 lean', 80],
      ['beef 80/20', 80],
      ['beef 90 / 10', 90],
      ['lean beef 93%', 93],
    ])('%s → leanPct %i', (q, pct) => {
      expect(parseSearchQuery(q).facets.leanPct).toBe(pct)
      expect(parseSearchQuery(q).retrievalTerms).toBe('beef')
    })

    it('ignores a ratio that is not a lean split', () => {
      const p = parseSearchQuery('beef 1/2')
      expect(p.facets.leanPct).toBeUndefined()
    })

    it('does not read a bare percentage as lean without the word', () => {
      expect(parseSearchQuery('milk 2%').facets.leanPct).toBeUndefined()
    })

    it('unqualified "lean" is qualitative trim, never numeric', () => {
      const p = parseSearchQuery('lean beef')
      expect(p.facets.leanPct).toBeUndefined()
      expect(p.facets.trim).toEqual(['lean'])
      expect(p.retrievalTerms).toBe('beef')
    })

    it('"extra lean" and "lean only" are their own trim phrases', () => {
      expect(parseSearchQuery('extra lean ground beef').facets.trim).toEqual(['extra lean'])
      expect(parseSearchQuery('beef lean only').facets.trim).toEqual(['lean only'])
    })
  })

  describe('preparation state', () => {
    it('any cooking method implies cooked', () => {
      for (const m of ['roasted', 'grilled', 'baked', 'braised']) {
        const p = parseSearchQuery(`${m} chicken`)
        expect(p.facets.prepState).toBe('cooked')
        expect(p.facets.cookingMethod).toEqual([m])
      }
    })

    it('multi-word methods are matched whole', () => {
      const p = parseSearchQuery('pan-fried chicken')
      expect(p.facets.cookingMethod).toEqual(['pan-fried'])
      expect(p.retrievalTerms).toBe('chicken')
    })

    it('accepts typed spacing variants but records the canonical (writer) spelling', () => {
      // The gazetteer only ever stores "pan-fried"; owners type it three ways.
      for (const typed of ['pan fried', 'pan-fried', 'panfried']) {
        const p = parseSearchQuery(`${typed} chicken`)
        expect(p.facets.cookingMethod).toEqual(['pan-fried'])
        expect(p.retrievalTerms).toBe('chicken')
      }
      expect(parseSearchQuery('bone in chicken thigh').facets.trim).toEqual(['bone-in'])
    })

    it('plain "cooked" sets state with no method', () => {
      const p = parseSearchQuery('cooked sweet potato')
      expect(p.facets.prepState).toBe('cooked')
      expect(p.facets.cookingMethod).toBeUndefined()
      expect(p.retrievalTerms).toBe('sweet potato')
    })

    it('raw synonyms all read as raw', () => {
      for (const r of ['raw', 'uncooked']) {
        expect(parseSearchQuery(`${r} salmon`).facets.prepState).toBe('raw')
      }
    })
  })

  describe('trim', () => {
    it('captures composition words as hard trim facets', () => {
      const p = parseSearchQuery('skinless boneless chicken thigh')
      expect(p.facets.trim).toEqual(['skinless', 'boneless'])
      expect(p.retrievalTerms).toBe('chicken thigh')
    })
  })

  describe('aliases and normalization', () => {
    it('"hamburger meat" → ground beef (query alias, not a writer synonym)', () => {
      expect(parseSearchQuery('hamburger meat').retrievalTerms).toBe('ground beef')
      expect(parseSearchQuery('hamburger').retrievalTerms).toBe('ground beef')
    })

    it('minced → ground via the shared SYNONYMS table', () => {
      expect(parseSearchQuery('minced beef').retrievalTerms).toBe('ground beef')
    })

    it('collapses MULTI-WORD synonyms, which only fire before tokenizing', () => {
      // Tokenizing first would strand these forever: SYNONYMS is keyed on the
      // whole phrase, the way the writer receives a comma-delimited segment.
      expect(parseSearchQuery('rib eye steak').retrievalTerms).toBe('ribeye steak')
      expect(parseSearchQuery('rib-eye').retrievalTerms).toBe('ribeye')
      expect(parseSearchQuery('garbanzo beans').retrievalTerms).toBe('chickpea')
      expect(parseSearchQuery('beef bottom round').retrievalTerms).toBe('beef round')
    })

    it('singularizes retrieval tokens like the writer does', () => {
      expect(parseSearchQuery('oranges').retrievalTerms).toBe('orange')
      expect(parseSearchQuery('sweet potatoes').retrievalTerms).toBe('sweet potato')
    })
  })

  describe('robustness', () => {
    it('unrecognized tokens stay in retrieval terms — never discarded', () => {
      const p = parseSearchQuery('raw zzzunknown liver')
      expect(p.retrievalTerms).toBe('zzzunknown liver')
      expect(p.facets.prepState).toBe('raw')
    })

    it('handles case, commas and extra whitespace', () => {
      const p = parseSearchQuery('  Beef,   80% LEAN , Broiled ')
      expect(p.retrievalTerms).toBe('beef')
      expect(p.facets.leanPct).toBe(80)
      expect(p.facets.cookingMethod).toEqual(['broiled'])
    })

    it('empty query yields empty terms and no facets', () => {
      const p = parseSearchQuery('')
      expect(p.retrievalTerms).toBe('')
      expect(p.facets).toEqual({})
    })
  })
})

describe('leanMatchesTrim — string match across FDC spellings', () => {
  it.each([
    '80% lean meat / 20% fat',
    '80% lean / 20% fat',
    '80% lean',
    '80% lean meat',
  ])('80 matches %s', (t) => {
    expect(leanMatchesTrim(80, [t])).toBe(true)
  })

  it('does not match a different percentage or an empty trim', () => {
    expect(leanMatchesTrim(80, ['85% lean meat / 15% fat'])).toBe(false)
    expect(leanMatchesTrim(80, [])).toBe(false)
    expect(leanMatchesTrim(80, undefined)).toBe(false)
  })
})

describe('variant matching — hard vs soft facets', () => {
  // Shapes lifted from the live beef_ground group.
  const raw75 = {
    preparation_state: 'raw',
    variant_attrs: { prep: ['raw'], trim: ['75% lean meat / 25% fat'] },
  }
  const raw80 = {
    preparation_state: 'raw',
    variant_attrs: { prep: ['raw'], trim: ['80% lean meat / 20% fat'] },
  }
  const cooked80Broiled = {
    preparation_state: 'cooked',
    variant_attrs: { prep: ['patty', 'cooked', 'broiled'], trim: ['80% lean meat / 20% fat'] },
  }
  const cooked80Baked = {
    preparation_state: 'cooked',
    variant_attrs: { prep: ['loaf', 'cooked', 'baked'], trim: ['80% lean meat / 20% fat'] },
  }
  const all = [raw75, raw80, cooked80Broiled, cooked80Baked]

  it('prepState is a hard filter', () => {
    expect(variantMatchesHardFacets(raw80, { prepState: 'raw' })).toBe(true)
    expect(variantMatchesHardFacets(cooked80Broiled, { prepState: 'raw' })).toBe(false)
  })

  it('leanPct is a hard filter', () => {
    expect(variantMatchesHardFacets(raw80, { leanPct: 80 })).toBe(true)
    expect(variantMatchesHardFacets(raw75, { leanPct: 80 })).toBe(false)
  })

  it('trim and method comparisons ignore hyphen/space spelling drift', () => {
    // FDC writes "bone-in" here, an owner typed "bone in"; and "pan-broiled"
    // stored against a canonical "pan-broiled" hit.
    const stored = {
      preparation_state: 'cooked',
      variant_attrs: { prep: ['cooked', 'pan-broiled'], trim: ['bone-in'] },
    }
    const f = parseSearchQuery('pan broiled bone in chicken').facets
    expect(variantMatchesHardFacets(stored, f)).toBe(true)
    expect(variantMatchesMethod(stored, f)).toBe(true)
  })

  it('cooking method is SOFT — it never excludes', () => {
    // "broiled" → hard cooked, prefer broiled. Baked survives.
    const f = parseSearchQuery('broiled').facets
    const out = filterAndRankVariants(all, f)
    expect(out).toEqual([cooked80Broiled, cooked80Baked])
    expect(variantMatchesMethod(cooked80Baked, f)).toBe(false)
  })

  it('never falls back to raw when a method was requested', () => {
    const out = filterAndRankVariants(all, parseSearchQuery('broiled').facets)
    expect(out.every(v => v.preparation_state === 'cooked')).toBe(true)
  })

  it('"beef 80% lean raw" narrows to exactly the raw 80/20 row', () => {
    const out = filterAndRankVariants(all, parseSearchQuery('beef 80% lean raw').facets)
    expect(out).toEqual([raw80])
  })

  it('a hard facet with no match yields an empty list (surface it, do not substitute)', () => {
    expect(filterAndRankVariants(all, { leanPct: 99 })).toEqual([])
  })

  it('with no facets, returns the input unchanged', () => {
    expect(filterAndRankVariants(all, {})).toEqual(all)
  })
})

describe('state facets stay inside what the writer stores', () => {
  // The bug this guards: prepState is a HARD filter on foods.preparation_state,
  // and a row the importer couldn't classify holds NULL. Any state word the
  // reader recognizes but the writer never stores therefore filters away the
  // exact rows it names. Descriptions below are live corpus rows.
  it.each([
    ['Turkey, ground, 93% lean, 7% fat, patties, broiled', 'broiled', 'cooked'],
    ['Turkey, ground, 85% lean, 15% fat, pan-broiled crumbles', 'pan broiled', 'cooked'],
    ['Beans, snap, green, frozen, all styles, microwaved', 'microwaved', 'cooked'],
    ['Onions, frozen, whole, unprepared', 'unprepared', 'raw'],
    ['Pork, cured, ham, whole, separable lean only, unheated', 'unheated', 'raw'],
  ])('%s is stored as the state "%s" narrows to', (description, query, expected) => {
    expect(inferPreparationState(description)).toBe(expected)
    expect(parseSearchQuery(query).facets.prepState).toBe(expected)
  })

  it.each([
    // FDC's raw words say how the row is SOLD; its method words say what was
    // already done to it. Both appear on one row more often than it looks.
    ['Potatoes, french fried, par fried, frozen, unprepared', 'cooked'],
    ['Salmon nuggets, cooked as purchased, unheated', 'cooked'],
    ['Apples, raw, without skin, cooked, boiled', 'cooked'],
    // …but a raw word alone still wins, including the "uncooked" ⊃ "cooked"
    // substring collision that made the original implementation test raw first.
    ['Quinoa, uncooked', 'raw'],
    ['Onions, frozen, whole, unprepared', 'raw'],
  ])('%s → %s (cooked wins when a row carries both signals)', (description, expected) => {
    expect(inferPreparationState(description)).toBe(expected)
  })

  it('"smoked" ranks but never narrows — cold-smoked fish is stored NULL', () => {
    // Every smoked row in the live corpus is lox/smoked fish: cured, not
    // cooked. Treating the method as cooked would hide all of them.
    expect(inferPreparationState('Fish, salmon, chinook, smoked, (lox), regular')).toBeNull()

    const f = parseSearchQuery('smoked salmon').facets
    expect(f.cookingMethod).toEqual(['smoked'])
    expect(f.prepState).toBeUndefined()

    const lox = { preparation_state: null, variant_attrs: { prep: ['smoked'] } }
    const plain = { preparation_state: 'raw', variant_attrs: { prep: ['raw'] } }
    expect(filterAndRankVariants([plain, lox], f)).toEqual([lox, plain])
  })
})

describe('drift guard — reader vocabulary ⊆ writer gazetteers', () => {
  // If the writer's gazetteers change, these fail rather than letting search
  // recognize a facet that would never have been stored.
  it('every cooking method matches a PREP gazetteer entry', () => {
    for (const m of COOKING_METHODS) {
      expect({ m, ok: matchesAny(m, PREP) }).toEqual({ m, ok: true })
    }
  })

  it('every raw state matches a PREP gazetteer entry', () => {
    for (const r of RAW_STATES) {
      expect({ r, ok: matchesAny(r, PREP) }).toEqual({ r, ok: true })
    }
  })

  it('every cooking method is classified cooked, or declared state-neutral', () => {
    // The PREP check above only proves the word can appear in variant_attrs.
    // This proves the reader's HARD state filter agrees with the column the
    // writer fills — the half that had actually drifted.
    for (const m of COOKING_METHODS) {
      const state = inferPrepState(m)
      const ok = state === 'cooked' || (state === null && STATE_NEUTRAL_METHODS.includes(m))
      expect({ m, state, ok }).toEqual({ m, state, ok: true })
    }
  })

  it('every raw state word is classified raw by the writer', () => {
    for (const r of RAW_STATES) {
      expect({ r, state: inferPrepState(r) }).toEqual({ r, state: 'raw' })
    }
  })

  it('every trim phrase matches a TRIM gazetteer entry', () => {
    for (const t of TRIM_PHRASES) {
      expect({ t, ok: matchesAny(t, TRIM) }).toEqual({ t, ok: true })
    }
  })
})
