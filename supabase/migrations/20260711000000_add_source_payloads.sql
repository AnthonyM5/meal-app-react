-- ============================================================
-- Raw source-payload persistence (the §3.4 "structural fix" from
-- audits/usda-nonnutrient-fields.md, extended to Open Food Facts per
-- docs/BRANDED_INGREDIENTS_DESIGN.md §3).
--
-- Every USDA / OFF response we fetch is stored verbatim, so that:
--   * fields we discarded at import time (dataType, foodPortions,
--     foodCategory, publicationDate, ...) can be derived later from stored
--     data without re-fetching;
--   * search responses preserve the CANDIDATES we excluded (regex mismatch,
--     EXCLUDE list, limit cutoff) so a later pass can widen coverage from
--     stored results instead of re-running the API.
--
-- Deliberately a standalone table, not a JSONB column on `foods`:
-- payloads exist for items that never get a `foods` row, and format=full
-- payloads are large enough to bloat every `select * from foods`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.source_payloads (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      TEXT NOT NULL CHECK (source IN ('usda', 'off')),
    kind        TEXT NOT NULL CHECK (kind IN ('detail', 'search')),
    -- fdc_id / OFF barcode for kind='detail'; the query string for kind='search'
    external_id TEXT NOT NULL,
    payload     JSONB NOT NULL,
    -- Set when the payload produced a foods row; NULL = fetched but not imported
    food_id     UUID REFERENCES public.foods(id) ON DELETE SET NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source, kind, external_id)
);

CREATE INDEX IF NOT EXISTS idx_source_payloads_food_id
    ON public.source_payloads(food_id)
    WHERE food_id IS NOT NULL;

-- RLS on with NO policies: unreachable via the anon/authenticated roles.
-- Only the service-role client (import scripts / server routes) may touch it.
ALTER TABLE public.source_payloads ENABLE ROW LEVEL SECURITY;
