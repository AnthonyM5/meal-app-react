-- ============================================================
-- Stop anonymous enumeration of the bowl-photos bucket.
--
-- The original policy (migration 20260707000000) was:
--
--   CREATE POLICY "Anyone can view bowl photos" ON storage.objects
--     FOR SELECT USING (bucket_id = 'bowl-photos');
--
-- With no TO clause a policy applies to PUBLIC, which includes `anon`. Supabase
-- Storage's list() is a SELECT against storage.objects, so any unauthenticated
-- caller holding only the (public, client-side) anon key could enumerate every
-- object in the bucket. Object paths are `<dogId>/<timestamp>-<filename>` —
-- unguessable by design, but listability defeats that entirely. The contents
-- are users' photos of their own kitchens, homes and pets.
--
-- SCOPE OF THIS FIX — read before assuming the bucket is now private.
--
-- The bucket is still `public = true`, and for public buckets Storage serves
-- /object/public/<bucket>/<path> WITHOUT evaluating RLS. So this migration
-- closes DISCOVERY, not access-with-a-known-URL. After it:
--
--   * anonymous list()/enumeration  -> blocked (this migration)
--   * fetching a URL you were given -> still works, by design
--
-- That is the intended stopping point for now: image_url values are only ever
-- returned to the owning user, and the paths are unguessable, so the residual
-- exposure is URL leakage (referrer headers, screenshots, sharing) rather than
-- bulk harvesting. Closing it fully requires making the bucket private and
-- serving signed URLs, which is blocked on app/api/bowl/analyze recovering the
-- storage path by string-parsing `/object/public/bowl-photos/` back out of the
-- stored image_url. See the Stage 2/3 plan referenced in the security report.
--
-- Note: any *authenticated* user can still enumerate. Ownership scoping lands
-- with Stage 3, where it can be tested together with signed URLs.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view bowl photos" ON storage.objects;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can view bowl photos" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'bowl-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
