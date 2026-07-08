-- ============================================================
-- Add columns for the 8 essential amino acids and 5 B-vitamins that a
-- live USDA nutrient-coverage audit (2026-07-08) found present in every
-- sampled Foundation/SR Legacy food but not captured by the importer.
-- AAFCO 2016 sets canine minimums for all of these; without them the gap
-- engine was silently blind to amino-acid and B-vitamin deficiencies.
-- Idempotent — safe to re-apply.
-- ============================================================

ALTER TABLE public.foods
    ADD COLUMN IF NOT EXISTS threonine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS isoleucine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS leucine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS arginine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS histidine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phenylalanine_tyrosine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS thiamin_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS riboflavin_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS niacin_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pantothenic_acid_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vitamin_b6_mg DECIMAL(8,2) DEFAULT 0;
