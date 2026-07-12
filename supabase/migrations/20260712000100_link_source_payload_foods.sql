-- Convenience linker for bulk imports: after a batch upsert into `foods`,
-- point archived USDA detail payloads at their foods row via
-- external_id ↔ fdc_id. Idempotent (only touches NULL food_id rows).
-- Service-role only, like everything else touching source_payloads.

CREATE OR REPLACE FUNCTION public.link_source_payload_foods()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.source_payloads sp
    SET food_id = f.id
    FROM public.foods f
    WHERE sp.source = 'usda'
      AND sp.kind = 'detail'
      AND sp.food_id IS NULL
      AND f.fdc_id IS NOT NULL
      AND sp.external_id = f.fdc_id::text;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.link_source_payload_foods() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_source_payload_foods() FROM anon;
REVOKE ALL ON FUNCTION public.link_source_payload_foods() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_source_payload_foods() TO service_role;
