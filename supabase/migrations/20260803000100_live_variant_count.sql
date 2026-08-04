-- ============================================================
-- search_canonical_ingredients: compute variant_count live.
--
-- The stored canonical_ingredients.variant_count is a build-time snapshot
-- from scripts/026 — stale the moment a variant is pruned, merged, or (now)
-- attached on creation by lib/services/ingredient-service.ts's exact-slug
-- attach. The gate math in lib/resolve-ingredient.ts already recounts live;
-- this makes grouped search agree with it. The stored column remains as
-- build metadata only, and no longer feeds anything user-facing.
--
-- The count runs per RETURNED group (match_limit, default 25) over
-- foods_canonical_id_idx — a cheap index-only lookup, not a table scan.
--
-- Return type unchanged, so no DROP and no client changes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_canonical_ingredients(
    search_query TEXT,
    match_limit INT DEFAULT 25
)
RETURNS TABLE (
    canonical_id     UUID,
    slug             TEXT,
    display_name     TEXT,
    base_food        TEXT,
    part             TEXT,
    category         TEXT,
    variant_count    INT,
    group_is_safe    BOOLEAN,
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
        vc.n,
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
        (
              0.60 * similarity(c.display_name, search_query)
            + 0.40 * similarity(c.base_food, search_query)
        )::REAL AS score
    FROM public.canonical_ingredients c
    JOIN public.foods f
      ON f.canonical_id = c.id
     AND f.is_canonical_default
     AND f.is_active
    -- Live variant count: the stored c.variant_count is a build snapshot and
    -- drifts as rows are pruned/merged/attached between builds.
    CROSS JOIN LATERAL (
        SELECT COUNT(*)::INT AS n
        FROM public.foods v
        WHERE v.canonical_id = c.id
          AND v.is_active
    ) vc
    WHERE
        -- word_similarity stays HERE, for recall: a one-word query against a
        -- multi-word display name has low whole-string similarity, so `%`
        -- alone would drop real matches. It just no longer drives ranking.
        c.display_name % search_query
        OR c.base_food % search_query
        OR search_query <% c.display_name
    ORDER BY
        score DESC,
        c.is_safe_for_dogs DESC,
        vc.n DESC,
        c.display_name
    LIMIT match_limit;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions;
