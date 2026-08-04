// Explicit jest globals, matching every other suite in __tests__/: without
// this, Cypress's chai `Assertion` type wins the ambient `expect` and
// `tsc --noEmit` fails with 40 "Property 'toBe' does not exist" errors.
import { describe, expect, it } from '@jest/globals'
import { parseFoodName, slugify } from '@/lib/food-name-parser'

describe('slugify', () => {
  it('normalizes to lowercase underscore-separated tokens', () => {
    expect(slugify('Beef Round')).toBe('beef_round')
    expect(slugify('sweet potato')).toBe('sweet_potato')
    expect(slugify('  Rib-Eye!  ')).toBe('rib_eye')
  })
})

describe('parseFoodName', () => {
  describe('USDA comma grammar', () => {
    it('takes the first segment as the base food', () => {
      const parsed = parseFoodName('Blueberries, raw')
      expect(parsed.baseFood).toBe('blueberry')
      expect(parsed.part).toBeNull()
      expect(parsed.slug).toBe('blueberry')
      expect(parsed.attrs.prep).toEqual(['raw'])
    })

    it('resolves a retail sub-cut to its primal', () => {
      // The whole point of the canonical layer: 165 rows like this one
      // collapse onto beef_round rather than one key per retail cut.
      const parsed = parseFoodName(
        'Beef, round, bottom round steak/roast, boneless, separable lean and fat, raw'
      )
      expect(parsed.slug).toBe('beef_round')
      expect(parsed.attrs.trim).toContain('boneless')
      expect(parsed.attrs.trim).toContain('separable lean and fat')
      expect(parsed.attrs.prep).toEqual(['raw'])
    })

    it('strips origin and grade so they do not fragment the key', () => {
      const wagyu = parseFoodName(
        'Beef, Australian, imported, Wagyu, loin, tenderloin steak/roast, ' +
          'boneless, separable lean only, Aust. marble score 9, raw'
      )
      const grassFed = parseFoodName(
        'Beef, Australian, imported, grass-fed, loin, tenderloin steak/roast, ' +
          'boneless, separable lean and fat, raw'
      )
      expect(wagyu.slug).toBe('beef_loin')
      expect(grassFed.slug).toBe('beef_loin')
      expect(wagyu.attrs.origin).toEqual(['australian', 'imported'])
      expect(wagyu.attrs.grade).toContain('wagyu')
      expect(wagyu.attrs.grade).toContain('aust marble score 9')
    })

    it('drops USDA grouping scaffolding', () => {
      // "fresh" / "broilers or fryers" classify the row inside FDC but say
      // nothing about the food. Left in, they produced buckets like
      // `pork_fresh` (200 rows) and `chicken_broilers_or_fryers` (116).
      expect(parseFoodName('Pork, fresh, loin, tenderloin, raw').slug).toBe('pork_loin')
      expect(
        parseFoodName('Chicken, broilers or fryers, breast, meat only, cooked, roasted')
          .slug
      ).toBe('chicken_breast')
    })
  })

  describe('non-USDA naming', () => {
    it('splits a part out of the head segment', () => {
      // Hand-curated rows use "Beef liver, raw"; USDA uses "Beef, liver, raw".
      // Both must land on one canonical or the curated row shadows the USDA
      // one in search forever.
      expect(parseFoodName('Beef liver, raw').slug).toBe('beef_liver')
      expect(parseFoodName('Beef, liver, raw').slug).toBe('beef_liver')
    })

    it('agrees across all three chicken-breast naming conventions', () => {
      const slugs = [
        'Chicken breast, boneless skinless, raw',
        'Chicken, breast, boneless, skinless, raw',
        'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
      ].map(n => parseFoodName(n).slug)
      expect(new Set(slugs)).toEqual(new Set(['chicken_breast']))
    })

    it('does not split a head whose last word is not a known part', () => {
      // "beans" and "potato" are not parts — these are the food itself.
      expect(parseFoodName('Green beans, cooked').baseFood).toBe('green bean')
      expect(parseFoodName('Sweet potato, cooked, no skin').baseFood).toBe('sweet potato')
    })
  })

  describe('parentheticals', () => {
    it('strips asides that span comma boundaries', () => {
      // Regression: splitting on commas first left the fragments
      // "Chickpeas (garbanzo beans" and "bengal gram)" looking like real
      // modifiers, producing chickpeas_garbanzo_beans_bengal_gram.
      const parsed = parseFoodName(
        'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw'
      )
      expect(parsed.slug).toBe('chickpea')
      expect(parsed.attrs.prep).toEqual(['raw'])
    })

    it('strips an unterminated parenthetical', () => {
      expect(parseFoodName('Beef, rib, eye, small end (ribs 10-12').slug).toBe('beef_rib')
    })
  })

  describe('synonyms', () => {
    it('collapses spelling variants of the same cut', () => {
      expect(parseFoodName('Beef, rib eye, raw').slug).toBe('beef_ribeye')
      expect(parseFoodName('Beef, rib-eye, raw').slug).toBe('beef_ribeye')
    })

    it('collapses plural part forms', () => {
      expect(parseFoodName('Chicken, thighs, raw').slug).toBe('chicken_thigh')
      expect(parseFoodName('Chicken, thigh, raw').slug).toBe('chicken_thigh')
    })
  })

  describe('preparation state stays a variant, never merged away', () => {
    it('keys raw and cooked to the same canonical but records the difference', () => {
      const raw = parseFoodName('Beef, ground, 85% lean meat / 15% fat, raw')
      const cooked = parseFoodName('Beef, ground, 85% lean meat / 15% fat, cooked, broiled')
      expect(raw.slug).toBe(cooked.slug)
      expect(raw.slug).toBe('beef_ground')
      expect(raw.attrs.prep).toEqual(['raw'])
      // "cooked, broiled" is two segments, so it yields two prep entries.
      expect(cooked.attrs.prep).toEqual(['cooked', 'broiled'])
    })
  })

  describe('robustness', () => {
    it('handles a single-segment name', () => {
      const parsed = parseFoodName('Salmon oil')
      expect(parsed.slug).toBe('salmon_oil')
      expect(parsed.attrs.residual).toEqual([])
    })

    it('never throws on unusual input', () => {
      for (const name of ['', ',', ',,,', 'a', '   ', '???']) {
        expect(() => parseFoodName(name)).not.toThrow()
      }
    })

    it('records unclassified segments as residual rather than dropping them', () => {
      // Residual is the parser's own blind-spot log — it makes gazetteer
      // coverage measurable instead of assumed.
      const parsed = parseFoodName('Beef, round, shoulder clod, arm, raw')
      expect(parsed.slug).toBe('beef_round')
      expect(parsed.attrs.residual).toContain('shoulder clod')
      expect(parsed.attrs.residual).toContain('arm')
    })

    it('never promotes an unknown modifier to the canonical key', () => {
      // The part slot is gazetteer-gated: fat percentage, species, and colour
      // are not parts, so they must not fragment the key (this behavior
      // previously produced `milk_325_milkfat` and made 54% of canonicals
      // singletons). They land in residual, where the coverage report can
      // surface them for deliberate promotion into PARTS.
      expect(
        parseFoodName('Milk, whole, 3.25% milkfat, with added vitamin D').slug
      ).toBe('milk')
      expect(parseFoodName('Grapes, red or green, raw').slug).toBe('grape')
      const salmon = parseFoodName('Salmon, Atlantic, farmed, raw')
      expect(salmon.slug).toBe('salmon')
      expect(salmon.attrs.residual).toContain('atlantic')
      expect(salmon.attrs.origin).toContain('farmed')
    })
  })
})
