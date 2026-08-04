-- ============================================================
-- Canonical ingredient layer (docs/DATA_NORMALIZATION_DESIGN.md §4.1).
--
-- WHAT PROBLEM THIS SOLVES
-- After the USDA bulk import, 960 rows in `foods` start with "Beef, " and
-- differ only by primal cut, grade, trim, origin and prep. An owner adding
-- "beef" to a bowl should not have to choose between Wagyu marble score 4/5
-- and marble score 9. Parsing those descriptions (lib/food-name-parser.ts)
-- collapses the 4,755 post-prune rows onto ~1,441 canonical keys — beef alone
-- goes from 960 rows to 43.
--
-- SHAPE: `foods` becomes the VARIANT table and this adds the canonical layer
-- above it. No rename, no data migration — consistent with the standing
-- decision recorded in 20260706000000 that renaming `foods` would ripple
-- through the importer, the RPCs, and every existing query.
--
-- `preparation_state` deliberately stays on `foods`: raw and cooked are a
-- real per-100g nutritional difference (water loss concentrates nutrients),
-- so they are SEPARATE VARIANTS under one canonical key, never merged.
--
-- Idempotent — safe to re-apply.
-- ============================================================

-- ---------- canonical_ingredients ----------
CREATE TABLE IF NOT EXISTS public.canonical_ingredients (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Normalized dedupe anchor: 'beef_round', 'chicken_breast', 'sweet_potato'
    slug         TEXT NOT NULL UNIQUE,
    -- Human-facing label shown in grouped search results
    display_name TEXT NOT NULL,
    base_food    TEXT NOT NULL,          -- 'beef'
    part         TEXT,                   -- 'round'; NULL for whole foods
    -- Majority FDC food_category across the group, for filter chips
    category     TEXT,
    -- FALSE when ANY variant is explicitly toxic (pessimistic rollup, set by
    -- scripts/026) — lets the picker warn at group level. Comment updated
    -- 2026-08-03 when the rollup direction flipped; DDL itself is unchanged.
    is_safe_for_dogs BOOLEAN NOT NULL DEFAULT TRUE,
    -- Denormalized count of active variants; refreshed by scripts/026
    variant_count INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS canonical_ingredients_base_food_idx
    ON public.canonical_ingredients(base_food);

-- Grouped search ranks canonicals by trigram similarity on these two columns.
--
-- The opclass is schema-resolved at runtime rather than written literally.
-- pg_trgm lives in `extensions` on this project (20250620030200 created it
-- WITH SCHEMA extensions), which is NOT on the search_path the migration
-- runner uses — a bare `gin_trgm_ops` fails here with "operator class does
-- not exist", even though the identical syntax in 20250620030200 succeeded
-- under whatever path applied that migration. Looking the schema up keeps
-- this working whether pg_trgm sits in `extensions` or `public`.
DO $$
DECLARE
    ops_schema TEXT;
BEGIN
    SELECT n.nspname INTO ops_schema
    FROM pg_opclass o
    JOIN pg_namespace n ON n.oid = o.opcnamespace
    WHERE o.opcname = 'gin_trgm_ops'
    LIMIT 1;

    IF ops_schema IS NULL THEN
        RAISE EXCEPTION
            'gin_trgm_ops not found — pg_trgm is not installed in any schema';
    END IF;

    EXECUTE format(
        'CREATE INDEX IF NOT EXISTS canonical_ingredients_trgm_idx
             ON public.canonical_ingredients
             USING gin (slug %I.gin_trgm_ops, display_name %I.gin_trgm_ops)',
        ops_schema, ops_schema
    );
END $$;

DO $$ BEGIN
    CREATE TRIGGER handle_updated_at_canonical_ingredients
        BEFORE UPDATE ON public.canonical_ingredients
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- foods becomes the variant table ----------
ALTER TABLE public.foods
    ADD COLUMN IF NOT EXISTS canonical_id UUID
        REFERENCES public.canonical_ingredients(id) ON DELETE SET NULL,
    -- Structured attributes parsed out of the description:
    -- {prep, trim, grade, origin, grouping, residual}. `residual` is the
    -- parser's own blind-spot log — segments no gazetteer claimed — so
    -- coverage is measurable rather than assumed.
    ADD COLUMN IF NOT EXISTS variant_attrs JSONB,
    -- The variant the picker shows when the group is collapsed
    ADD COLUMN IF NOT EXISTS is_canonical_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS foods_canonical_id_idx
    ON public.foods(canonical_id)
    WHERE canonical_id IS NOT NULL;

-- Exactly one default variant per canonical. A partial unique index makes
-- that an invariant the database enforces, so a half-finished re-run of
-- scripts/026 cannot leave two rows claiming to be the default.
CREATE UNIQUE INDEX IF NOT EXISTS foods_one_canonical_default_idx
    ON public.foods(canonical_id)
    WHERE is_canonical_default AND canonical_id IS NOT NULL;

-- ---------- ambiguous-match review queue ----------
-- Rows whose proposed slug landed in the 0.75-0.90 similarity band against an
-- existing canonical: too close to create a new entry, too far to auto-merge.
-- A human clears these, and the resolution normally becomes a SYNONYMS entry
-- in lib/food-name-parser.ts so the same case never queues again.
CREATE TABLE IF NOT EXISTS public.canonical_review_queue (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_id       UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
    food_name     TEXT NOT NULL,        -- snapshot, so the queue reads standalone
    proposed_slug TEXT NOT NULL,        -- what the parser derived
    matched_slug  TEXT,                 -- nearest existing canonical
    similarity    REAL,                 -- trigram score against matched_slug
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'merged', 'kept_separate')),
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (food_id)
);

CREATE INDEX IF NOT EXISTS canonical_review_queue_pending_idx
    ON public.canonical_review_queue(created_at)
    WHERE status = 'pending';

-- ---------- RLS ----------
ALTER TABLE public.canonical_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_review_queue ENABLE ROW LEVEL SECURITY;

-- canonical_ingredients: public read (it is catalogue data, same posture as
-- nutrient_requirements); writes only via the service role.
DO $$ BEGIN
    CREATE POLICY "Anyone can view canonical ingredients"
        ON public.canonical_ingredients
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- canonical_review_queue: RLS on with NO policies — internal maintenance
-- data, unreachable via the anon/authenticated roles. Same posture as
-- source_payloads.
