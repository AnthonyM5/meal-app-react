-- Function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER handle_updated_at_profiles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_foods
    BEFORE UPDATE ON public.foods
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_meals
    BEFORE UPDATE ON public.meals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to calculate daily nutrition totals
CREATE OR REPLACE FUNCTION public.get_daily_nutrition(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_calories DECIMAL,
    total_protein DECIMAL,
    total_carbs DECIMAL,
    total_fat DECIMAL,
    total_fiber DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(mi.calories), 0) as total_calories,
        COALESCE(SUM(mi.protein_g), 0) as total_protein,
        COALESCE(SUM(mi.carbs_g), 0) as total_carbs,
        COALESCE(SUM(mi.fat_g), 0) as total_fat,
        COALESCE(SUM(mi.fiber_g), 0) as total_fiber
    FROM public.meals m
    JOIN public.meal_items mi ON m.id = mi.meal_id
    WHERE m.user_id = p_user_id 
    AND m.date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get nutrition by meal type for a day
CREATE OR REPLACE FUNCTION public.get_nutrition_by_meal_type(
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    meal_type meal_type,
    calories DECIMAL,
    protein DECIMAL,
    carbs DECIMAL,
    fat DECIMAL,
    fiber DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.meal_type,
        COALESCE(SUM(mi.calories), 0) as calories,
        COALESCE(SUM(mi.protein_g), 0) as protein,
        COALESCE(SUM(mi.carbs_g), 0) as carbs,
        COALESCE(SUM(mi.fat_g), 0) as fat,
        COALESCE(SUM(mi.fiber_g), 0) as fiber
    FROM public.meals m
    LEFT JOIN public.meal_items mi ON m.id = mi.meal_id
    WHERE m.user_id = p_user_id 
    AND m.date = p_date
    GROUP BY m.meal_type
    ORDER BY 
        CASE m.meal_type
            WHEN 'breakfast' THEN 1
            WHEN 'lunch' THEN 2
            WHEN 'dinner' THEN 3
            WHEN 'snack' THEN 4
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
