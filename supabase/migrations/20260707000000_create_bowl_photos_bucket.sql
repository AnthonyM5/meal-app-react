-- ============================================================
-- Storage bucket for bowl-photo uploads (Phase 4 vision pipeline).
-- Public read so served image_url values work without signed URLs;
-- writes are restricted to authenticated users via policy.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bowl-photos',
  'bowl-photos',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$ BEGIN
  CREATE POLICY "Anyone can view bowl photos" ON storage.objects
    FOR SELECT USING (bucket_id = 'bowl-photos');
  CREATE POLICY "Authenticated users can upload bowl photos" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'bowl-photos');
  CREATE POLICY "Service role can manage bowl photos" ON storage.objects
    FOR ALL TO service_role USING (bucket_id = 'bowl-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
