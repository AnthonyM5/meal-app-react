-- ============================================================
-- Guest bowl-scan rate limiting.
--
-- Guest mode is a client-set cookie (`guestMode=true`), so the guest bowl
-- endpoint is, in practice, an UNAUTHENTICATED endpoint that spends money:
-- every call is a Gemini vision request. This table is the only thing
-- standing between a `for` loop and the API quota.
--
-- We store a salted SHA-256 of the client IP, never the IP itself. The salt
-- lives in the server environment, so the table alone can't be reversed into
-- a list of visitor addresses.
--
-- Rows are per (ip_hash, day) and are disposable — prune anything older than
-- a couple of days whenever you like.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.guest_bowl_usage (
    ip_hash    TEXT NOT NULL,
    day        DATE NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ip_hash, day)
);

CREATE INDEX IF NOT EXISTS idx_guest_bowl_usage_day
    ON public.guest_bowl_usage(day);

-- RLS on with NO policies: unreachable via the anon/authenticated roles.
-- Only the service-role client (which bypasses RLS) may touch it.
ALTER TABLE public.guest_bowl_usage ENABLE ROW LEVEL SECURITY;

-- Atomically consume one unit of quota.
--
-- Returns TRUE when the caller was under the limit and the counter was
-- incremented; FALSE when the limit was already reached (no increment).
--
-- The check has to live inside the UPSERT. Doing SELECT-then-UPDATE from the
-- application would let two concurrent requests both observe `count = limit-1`
-- and both proceed. Here the `WHERE` on the DO UPDATE is evaluated against the
-- row the statement has already locked, so concurrent callers serialize and the
-- loser gets zero rows back.
CREATE OR REPLACE FUNCTION public.consume_guest_bowl_quota(
    p_ip_hash TEXT,
    p_limit   INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF p_limit <= 0 THEN
        RETURN FALSE;
    END IF;

    INSERT INTO public.guest_bowl_usage (ip_hash, day, count)
    VALUES (p_ip_hash, CURRENT_DATE, 1)
    ON CONFLICT (ip_hash, day) DO UPDATE
        SET count = public.guest_bowl_usage.count + 1
        WHERE public.guest_bowl_usage.count < p_limit
    RETURNING count INTO v_count;

    -- No row returned => the ON CONFLICT WHERE filtered it out => over limit.
    RETURN v_count IS NOT NULL;
END;
$$;

-- Service role only. `anon`/`authenticated` must not be able to burn a
-- competitor's quota (or probe whether an IP hash exists) by calling the RPC.
REVOKE ALL ON FUNCTION public.consume_guest_bowl_quota(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_guest_bowl_quota(TEXT, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.consume_guest_bowl_quota(TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.consume_guest_bowl_quota(TEXT, INTEGER) TO service_role;
