-- Add extended nutrient columns to foods table
ALTER TABLE foods 
ADD COLUMN IF NOT EXISTS potassium_mg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS magnesium_mg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS zinc_mg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS selenium_mcg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vitamin_d_mcg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vitamin_b12_mcg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS folate_mcg DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS vitamin_e_mg DECIMAL(8,2) DEFAULT 0;

-- Create index for nutrient-based searches
CREATE INDEX IF NOT EXISTS idx_foods_nutrients ON foods USING gin (
  (ARRAY[
    iron_mg, calcium_mg, vitamin_c_mg, vitamin_a_mcg, 
    potassium_mg, magnesium_mg, zinc_mg, selenium_mcg,
    vitamin_d_mcg, vitamin_b12_mcg, folate_mcg, vitamin_e_mg
  ])
);

-- Create function for nutrient-based food search
CREATE OR REPLACE FUNCTION search_foods_by_nutrient(
  nutrient_name TEXT,
  min_amount DECIMAL DEFAULT 0,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  serving_size DECIMAL,
  serving_unit TEXT,
  calories_per_serving DECIMAL,
  protein_g DECIMAL,
  carbs_g DECIMAL,
  fat_g DECIMAL,
  fiber_g DECIMAL,
  nutrient_amount DECIMAL,
  nutrient_unit TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  CASE nutrient_name
    WHEN 'iron' THEN
      RETURN QUERY
      SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
             f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
             f.iron_mg as nutrient_amount, 'mg'::TEXT as nutrient_unit
      FROM foods f
      WHERE f.iron_mg >= min_amount
      ORDER BY f.iron_mg DESC
      LIMIT limit_count;
      
    WHEN 'calcium' THEN
      RETURN QUERY
      SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
             f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
             f.calcium_mg as nutrient_amount, 'mg'::TEXT as nutrient_unit
      FROM foods f
      WHERE f.calcium_mg >= min_amount
      ORDER BY f.calcium_mg DESC
      LIMIT limit_count;
      
    WHEN 'vitamin_c' THEN
      RETURN QUERY
      SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
             f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
             f.vitamin_c_mg as nutrient_amount, 'mg'::TEXT as nutrient_unit
      FROM foods f
      WHERE f.vitamin_c_mg >= min_amount
      ORDER BY f.vitamin_c_mg DESC
      LIMIT limit_count;
      
    WHEN 'potassium' THEN
      RETURN QUERY
      SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
             f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
             f.potassium_mg as nutrient_amount, 'mg'::TEXT as nutrient_unit
      FROM foods f
      WHERE f.potassium_mg >= min_amount
      ORDER BY f.potassium_mg DESC
      LIMIT limit_count;
      
    WHEN 'selenium' THEN
      RETURN QUERY
      SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
             f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
             f.selenium_mcg as nutrient_amount, 'mcg'::TEXT as nutrient_unit
      FROM foods f
      WHERE f.selenium_mcg >= min_amount
      ORDER BY f.selenium_mcg DESC
      LIMIT limit_count;
      
    ELSE
      -- Default to protein search
      RETURN QUERY
      SELECT f.id, f.name, f.brand, f.serving_size, f.serving_unit,
             f.calories_per_serving, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
             f.protein_g as nutrient_amount, 'g'::TEXT as nutrient_unit
      FROM foods f
      WHERE f.protein_g >= min_amount
      ORDER BY f.protein_g DESC
      LIMIT limit_count;
  END CASE;
END;
$$;
