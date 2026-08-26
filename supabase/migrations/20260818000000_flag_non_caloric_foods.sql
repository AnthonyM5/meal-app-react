-- Declare which all-zero rows are MEASURED as all-zero.
--
-- `isNutritionallyUsable()` (lib/usda-canine.ts) used to let any row that was
-- zero on energy AND every macro through, on the reasoning that the shape is
-- legitimate for a supplement. It is — for exactly one row in the table.
-- The other 18 sharing that shape are truncated USDA Foundation imports:
-- every cooking oil, both dry spaghettis, raisins, dried cranberries,
-- grapefruit, rhubarb, pomegranate juice, ranch dressing, three canned bean
-- products. "Oil, peanut" is 100% fat in reality, and a bowl containing it
-- logged at 0 kcal with no warning.
--
-- Re-fetching does not help: FDC itself publishes no energy and no proximates
-- for these. fdc 748608 (olive oil, extra virgin) carries 33 nutrients — the
-- fatty acid profile, tocopherols — and no total fat. The payload captured at
-- import was faithful; there is nothing upstream to recover.
--
-- So the benign reading has to be asserted per row rather than inferred from
-- the numbers, and the predicate now fails closed without it.

ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_data_completeness_check;

ALTER TABLE public.foods
    ADD CONSTRAINT foods_data_completeness_check
    CHECK (
        data_completeness IS NULL
        OR data_completeness IN ('full', 'macros_only', 'sparse', 'non_caloric')
    );

COMMENT ON COLUMN public.foods.data_completeness IS
    'How much of the nutrition payload is present. ''non_caloric'' additionally '
    'asserts that zero energy and zero macros are the food''s real composition '
    '(a mineral supplement), not missing data — isNutritionallyUsable() rejects '
    'an unmarked all-zero row.';

-- The only row in the table whose zeros are real. A calcium supplement:
-- eggshell is calcium carbonate, and it is the default variant of its group.
UPDATE public.foods
   SET data_completeness = 'non_caloric'
 WHERE name = 'Eggshell powder (calcium supplement)'
   AND COALESCE(calories_per_serving, 0) = 0
   AND COALESCE(protein_g, 0) = 0
   AND COALESCE(fat_g, 0) = 0
   AND COALESCE(carbs_g, 0) = 0;
