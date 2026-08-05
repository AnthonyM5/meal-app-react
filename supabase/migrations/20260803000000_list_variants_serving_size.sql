-- ============================================================
-- list_canonical_variants: return serving_size.
--
-- The variant picker (web VariantChoice + its mobile counterpart) displays
-- "kcal / 100g", and the ambiguity gate in lib/resolve-ingredient.ts compares
-- per-100 g numbers. Until now both ASSUMED serving_size = 100 for every
-- variant — true of every current writer, but unenforced, and this RPC gave
-- clients no way to check. Clients now normalize via per100g() in
-- @pawplate/core, which needs the serving_size on the wire.
--
-- Adding a column changes the return type, so the old function must be
-- dropped first (CREATE OR REPLACE cannot change a return type). The only
-- caller is /api/ingredients/grouped-search, which forwards rows as JSON —
-- an added key is invisible to existing clients, so nothing breaks. Clients
-- built before this migration treat a missing serving_size as 100 (the
-- schema default), which reproduces the old behavior exactly.
--
-- Idempotent — safe to re-apply.
-- ============================================================

DROP FUNCTION IF EXISTS public.list_canonical_variants(UUID, INT);

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
