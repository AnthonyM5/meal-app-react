-- ============================================================
-- Grouped search over the canonical layer
-- (docs/DATA_NORMALIZATION_DESIGN.md §4.4).
--
-- This, not the scoring blend in 20260729000100, is the real fix for the
-- picker. Flat search must pick ONE winner out of 960 "Beef, ..." rows, and
-- any such choice is somewhat arbitrary. Grouped search sidesteps the problem:
-- "beef" returns ~43 canonical groups (Beef round, Beef chuck, Beef liver,
-- Beef ground, ...), each carrying its default variant's nutrition and a
-- variant_count the UI can expand.
--
-- ADDITIVE BY DESIGN: fuzzy_search_foods is left exactly as it is. The mobile
-- REST clients (/api/ingredients/search) and /api/foods/unified-search keep
-- working untouched; grouped mode is a NEW function that callers opt into.
-- ============================================================

-- ---------- grouped search ----------
CREATE OR REPLACE FUNCTION public.search_canonical_ingredients(
    search_query TEXT,
    match_limit INT DEFAULT 25
)
RETURNS TABLE (
    -- the group
    canonical_id     UUID,
    slug             TEXT,
    display_name     TEXT,
    base_food        TEXT,
    part             TEXT,
    category         TEXT,
    variant_count    INT,
    group_is_safe    BOOLEAN,
    -- the default variant, so the picker can show nutrition without a
    -- second round trip
    food_id          UUID,
    name             TEXT,
    brand            TEXT,
    serving_size     DECIMAL,
    calories_per_serving DECIMAL,
    protein_g        DECIMAL,
    carbs_g          DECIMAL,
    fat_g            DECIMAL,
    fiber_g          DECIMAL,
    preparation_state TEXT,
    is_verified      BOOLEAN,
    source           TEXT,
    data_completeness TEXT,
    similarity       REAL
) AS $$
BEGIN
    PERFORM set_limit(0.2);
    PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

    RETURN QUERY
    SELECT
        c.id,
        c.slug,
        c.display_name,
        c.base_food,
        c.part,
        c.category,
        c.variant_count,
        c.is_safe_for_dogs,
        f.id,
        f.name,
        f.brand,
        f.serving_size,
        f.calories_per_serving,
        f.protein_g,
        f.carbs_g,
        f.fat_g,
        f.fiber_g,
        f.preparation_state,
        f.is_verified,
        f.source,
        f.data_completeness,
        GREATEST(
            -- display_name is already the normalized, modifier-free label, so
            -- plain whole-string similarity behaves well here — none of the
            -- over-specification problems that forced the blended score on
            -- raw USDA descriptions apply.
            similarity(c.display_name, search_query),
            similarity(c.base_food, search_query),
            word_similarity(search_query, c.display_name)
        )::REAL AS score
    FROM public.canonical_ingredients c
    -- INNER JOIN: a canonical with no default variant is a build artifact
    -- (scripts/026 interrupted mid-run) and must not surface in search.
    JOIN public.foods f
      ON f.canonical_id = c.id
     AND f.is_canonical_default
     AND f.is_active
    WHERE
        c.display_name % search_query
        OR c.base_food % search_query
        OR search_query <% c.display_name
    ORDER BY
        score DESC,
        -- Prefer groups that actually consolidate something, then safe ones.
        c.is_safe_for_dogs DESC,
        c.variant_count DESC,
        c.display_name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;

-- ---------- variant expansion ----------
-- Backs the "show all N variants" affordance. A dedicated function rather
-- than a PostgREST filter so is_active filtering and the ordering policy
-- (default first, then verified, then shortest name) live in one place.
CREATE OR REPLACE FUNCTION public.list_canonical_variants(
    p_canonical_id UUID,
    match_limit INT DEFAULT 100
)
RETURNS TABLE (
    id               UUID,
    name             TEXT,
    brand            TEXT,
    serving_size     DECIMAL,
    calories_per_serving DECIMAL,
    protein_g        DECIMAL,
    carbs_g          DECIMAL,
    fat_g            DECIMAL,
    fiber_g          DECIMAL,
    is_safe_for_dogs BOOLEAN,
    toxicity_note    TEXT,
    preparation_state TEXT,
    is_verified      BOOLEAN,
    source           TEXT,
    usda_data_type   TEXT,
    data_completeness TEXT,
    variant_attrs    JSONB,
    is_canonical_default BOOLEAN
) AS $$
    SELECT
        f.id, f.name, f.brand, f.serving_size, f.calories_per_serving,
        f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
        f.is_safe_for_dogs, f.toxicity_note, f.preparation_state,
        f.is_verified, f.source, f.usda_data_type, f.data_completeness,
        f.variant_attrs, f.is_canonical_default
    FROM public.foods f
    WHERE f.canonical_id = p_canonical_id
      AND f.is_active
    ORDER BY
        f.is_canonical_default DESC,
        f.is_verified DESC,
        f.preparation_state NULLS LAST,
        length(f.name),
        f.name
    LIMIT match_limit;
$$ LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions;
