-- Owner-supplied free-text hint for bowl analysis (e.g. "there's also ground
-- beef and shredded chicken in there"). Recorded so evals can distinguish
-- failure modes the hint compensates for (occlusion, shredded/submerged items)
-- from ordinary mis-labeling. Null when no hint was given. Idempotent.
ALTER TABLE bowl_analyses
  ADD COLUMN IF NOT EXISTS user_hint TEXT;

COMMENT ON COLUMN bowl_analyses.user_hint IS
  'Free-text owner hint passed to the vision model (identification only, never grams). Latest hint wins on re-analysis.';
