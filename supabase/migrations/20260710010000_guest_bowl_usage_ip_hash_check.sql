-- ============================================================
-- Assert the guest_bowl_usage.ip_hash format at the schema level.
--
-- Follow-up to 20260710000000, which shipped without this CHECK. That
-- migration was already applied to prod, and `CREATE TABLE IF NOT EXISTS`
-- won't re-run against an existing table, so the constraint has to be added
-- separately here rather than edited into the original.
--
-- ip_hash is always a SHA-256 hex digest from lib/guest-rate-limit.ts#hashIp,
-- so this is a defensive integrity assertion rather than a fix for observed
-- bad data — the hash already bounds the value to 64 hex chars regardless of
-- input. TEXT + CHECK, not CHAR(64): CHAR space-pads to length and makes
-- equality comparisons surprising.
--
-- Idempotent: drop-then-add so a re-apply is clean. Guarded by a NOT VALID +
-- VALIDATE split so that, if any malformed row somehow predates this, the
-- ADD still succeeds and validation surfaces the offender explicitly.
-- ============================================================

ALTER TABLE public.guest_bowl_usage
    DROP CONSTRAINT IF EXISTS guest_bowl_usage_ip_hash_format;

ALTER TABLE public.guest_bowl_usage
    ADD CONSTRAINT guest_bowl_usage_ip_hash_format
    CHECK (ip_hash ~ '^[0-9a-f]{64}$') NOT VALID;

ALTER TABLE public.guest_bowl_usage
    VALIDATE CONSTRAINT guest_bowl_usage_ip_hash_format;
