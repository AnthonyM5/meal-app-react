-- foods.created_by referenced auth.users(id) with NO delete action (from the
-- original pre-PawPlate schema, 20250620030000), so deleting any auth user
-- who had ever created a foods row (source='manual' custom ingredients, and
-- some legacy rows) failed with a foreign-key violation — real account
-- deletion was impossible for those users, and e2e test-user teardown hit
-- the same wall.
--
-- Fix: ON DELETE SET NULL, matching how recipes.created_by already handles
-- it. The ingredient must outlive its creator: meal_items in OTHER users'
-- meals may reference it (branded/OFF rows are shared by design), so
-- cascading the delete would destroy other people's meal history.
-- Idempotent: drops whatever the current FK on created_by is named, then
-- re-adds it with the right action.
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'foods'
    AND con.contype = 'f'
    AND (
      SELECT array_agg(att.attname::text)
      FROM unnest(con.conkey) AS k(attnum)
      JOIN pg_attribute att
        ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    ) = ARRAY['created_by'];

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.foods DROP CONSTRAINT %I', fk_name);
  END IF;

  ALTER TABLE public.foods
    ADD CONSTRAINT foods_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
END $$;
