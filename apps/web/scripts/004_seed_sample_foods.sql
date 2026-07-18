-- Insert common foods for testing
INSERT INTO public.foods (name, brand, serving_size, serving_unit, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, is_verified) VALUES
-- Fruits
('Apple', 'Generic', 182, 'g (1 medium)', 95, 0.5, 25, 0.3, 4.4, true),
('Banana', 'Generic', 118, 'g (1 medium)', 105, 1.3, 27, 0.4, 3.1, true),
('Orange', 'Generic', 154, 'g (1 medium)', 62, 1.2, 15.4, 0.2, 3.1, true),
('Strawberries', 'Generic', 152, 'g (1 cup)', 49, 1.0, 11.7, 0.5, 3.0, true),

-- Vegetables
('Broccoli', 'Generic', 91, 'g (1 cup)', 25, 3.0, 5.0, 0.3, 2.3, true),
('Spinach', 'Generic', 30, 'g (1 cup)', 7, 0.9, 1.1, 0.1, 0.7, true),
('Carrots', 'Generic', 61, 'g (1 medium)', 25, 0.5, 6.0, 0.1, 1.7, true),
('Sweet Potato', 'Generic', 128, 'g (1 medium)', 112, 2.0, 26, 0.1, 3.9, true),

-- Proteins
('Chicken Breast', 'Generic', 85, 'g (3 oz)', 140, 26, 0, 3.0, 0, true),
('Salmon', 'Generic', 85, 'g (3 oz)', 175, 25, 0, 8.0, 0, true),
('Eggs', 'Generic', 50, 'g (1 large)', 70, 6.0, 0.6, 5.0, 0, true),
('Greek Yogurt', 'Generic', 170, 'g (3/4 cup)', 100, 17, 6.0, 0, 0, true),

-- Grains
('Brown Rice', 'Generic', 195, 'g (1 cup cooked)', 216, 5.0, 45, 1.8, 3.5, true),
('Quinoa', 'Generic', 185, 'g (1 cup cooked)', 222, 8.0, 39, 3.6, 5.2, true),
('Oatmeal', 'Generic', 234, 'g (1 cup cooked)', 147, 5.9, 25, 2.9, 4.0, true),
('Whole Wheat Bread', 'Generic', 28, 'g (1 slice)', 69, 3.6, 11.6, 1.2, 1.9, true),

-- Nuts and Seeds
('Almonds', 'Generic', 28, 'g (1 oz)', 164, 6.0, 6.0, 14, 3.5, true),
('Peanut Butter', 'Generic', 32, 'g (2 tbsp)', 188, 8.0, 8.0, 16, 2.0, true),
('Chia Seeds', 'Generic', 28, 'g (1 oz)', 137, 4.4, 12, 8.6, 10.6, true),

-- Dairy
('Milk', 'Generic', 244, 'g (1 cup)', 149, 8.0, 12, 8.0, 0, true),
('Cheddar Cheese', 'Generic', 28, 'g (1 oz)', 113, 7.0, 1.0, 9.0, 0, true);
