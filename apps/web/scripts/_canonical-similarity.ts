// Trigram similarity + the canonical-merge thresholds, shared by
// scripts/026_build_canonical_ingredients.ts (which makes the decisions) and
// scripts/027_audit_canonical_merges.ts (which replays them). 027's audit is
// only meaningful if it runs the EXACT code 026 ran, so both must import from
// here — never copy these locally.

/** Above this, two slugs are the same ingredient. */
export const AUTO_MERGE_SIMILARITY = 0.9
/** Below this, they are different ingredients. Between = human review. */
export const REVIEW_SIMILARITY = 0.75

/**
 * Word trigrams, same construction pg_trgm uses (two-space left pad, one-space
 * right pad per word), so scores here mean the same thing they would in SQL.
 */
export function trigrams(text: string): Set<string> {
  const out = new Set<string>()
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const padded = `  ${word} `
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  }
  return out
}

/** Trigram Jaccard — the metric pg_trgm's similarity() computes. */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a)
  const tb = trigrams(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / (ta.size + tb.size - shared)
}
