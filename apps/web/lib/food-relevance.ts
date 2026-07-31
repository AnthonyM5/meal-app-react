// Which corpus rows belong in a fresh-fed dog bowl.
//
// scripts/022_bulk_import_usda_wholefoods.ts filters by FDC food CATEGORY,
// which is the right primary gate but is too coarse on its own: whole
// categories carry prepared products that no dog should be fed and that no
// owner would ever search for.
//
//   'Fats and Oils'          -> 58 salad dressings, 49 margarines, 21 shortenings
//   'Dairy and Egg Products' -> egg substitutes, soy "yogurt"
//   'Poultry Products'       -> "Chicken, meatless" (a soy product)
//   'Fruits and Fruit Juices'-> 61 rows canned in syrup
//
// Beyond being noise, these actively break search: "Chicken, meatless" is
// genuinely the closest trigram match to the query "chicken", so no amount of
// ranking-weight tuning can demote it (see migration 20260729000100). The
// only fix is to keep it out of the searchable corpus.
//
// This is deliberately a DESCRIPTION denylist, not a category one: the
// offending rows are scattered across categories we otherwise want.

/** A denylist rule, kept separate so the audit can report per-rule counts. */
export interface PruneRule {
  /** Stable id, stored in foods.inactive_reason for traceability */
  id: string
  pattern: RegExp
  why: string
}

/**
 * Ordered so the most specific rules match first — a row is attributed to the
 * first rule that matches, which is what the audit report groups by.
 */
export const PRUNE_RULES: readonly PruneRule[] = [
  {
    id: 'imitation',
    pattern: /\b(meatless|imitation|substitute|meat extender)\b/i,
    why: 'soy/plant analogues of meat — not the food the name implies',
  },
  {
    id: 'dressing_spread',
    pattern: /\b(salad dressing|mayonnaise|margarine|shortening|spreads?)\b/i,
    why: 'emulsified prepared condiments, not fresh-feeding ingredients',
  },
  {
    id: 'sweetened',
    pattern: /\b(syrup|candied|sweetened condensed|in heavy syrup)\b/i,
    why: 'added-sugar preparations; the plain variant is always present too',
  },
  {
    id: 'breaded_fried',
    pattern: /\b(breaded|battered|nuggets?)\b/i,
    why: 'breaded/fried convenience products',
  },
  {
    id: 'baked_snack',
    // `pie` needs a negative lookahead: "Squash, pie pumpkin, peeled, seeded,
    // raw" is a real raw squash and a perfectly good dog food, whereas
    // "Pumpkin pie mix, canned" is a sweetened, spiced prepared product.
    pattern:
      /\b(cakes?|cookies?|pies?(?!\s+pumpkin)|puffs?|crackers?|chips|pretzels?|snack)\b/i,
    why: 'baked goods and snack foods',
  },
  {
    id: 'cured_deli',
    pattern: /\b(luncheon meat|breakfast strips|bologna|salami|pepperoni|frankfurter)\b/i,
    why: 'cured deli meats — sodium/nitrate loads unsuitable for dogs',
  },
  {
    id: 'infant',
    pattern: /\b(baby food|infant formula|toddler)\b/i,
    why: 'human infant products',
  },
  {
    id: 'restaurant',
    pattern: /\b(restaurant|fast food|school lunch|USDA Commodity)\b/i,
    why: 'foodservice/commodity entries, not retail ingredients',
  },
  {
    id: 'gravy_sauce',
    // "sauce"/"dip" only when they head the description or follow a comma —
    // avoids nuking legitimate rows that merely mention a sauce ingredient.
    pattern: /\bgravy\b|(^|,\s*)(sauces?|dips?)\b/i,
    why: 'prepared sauces and dips',
  },
]

/**
 * Returns the first matching prune rule, or null when the row belongs in the
 * corpus. Case-insensitive; operates on the full USDA description.
 */
export function matchPruneRule(name: string): PruneRule | null {
  for (const rule of PRUNE_RULES) {
    if (rule.pattern.test(name)) return rule
  }
  return null
}

/** Convenience predicate for callers that don't need the reason. */
export function isPrunable(name: string): boolean {
  return matchPruneRule(name) !== null
}
