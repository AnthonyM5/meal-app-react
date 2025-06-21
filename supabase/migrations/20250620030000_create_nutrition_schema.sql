-- Create custom types
CREATE TYPE meal_type AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE activity_level AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active');
CREATE TYPE goal_type AS ENUM ('lose_weight', 'maintain_weight', 'gain_weight', 'build_muscle');

-- Create profiles table (extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    age INTEGER,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    height_cm DECIMAL(5,2),
    weight_kg DECIMAL(5,2),
    activity_level activity_level DEFAULT 'moderately_active',
    goal_type goal_type DEFAULT 'maintain_weight',
    target_calories INTEGER,
    target_protein DECIMAL(6,2),
    target_carbs DECIMAL(6,2),
    target_fat DECIMAL(6,2),
    target_fiber DECIMAL(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create foods table (nutritional database)
CREATE TABLE public.foods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fdc_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT UNIQUE,
    serving_size DECIMAL(8,2) NOT NULL DEFAULT 100, -- in grams
    serving_unit TEXT DEFAULT 'g',
    calories_per_serving DECIMAL(8,2) NOT NULL,
    protein_g DECIMAL(8,2) DEFAULT 0,
    carbs_g DECIMAL(8,2) DEFAULT 0,
    fat_g DECIMAL(8,2) DEFAULT 0,
    fiber_g DECIMAL(8,2) DEFAULT 0,
    sugar_g DECIMAL(8,2) DEFAULT 0,
    sodium_mg DECIMAL(8,2) DEFAULT 0,
    cholesterol_mg DECIMAL(8,2) DEFAULT 0,
    vitamin_a_mcg DECIMAL(8,2) DEFAULT 0,
    vitamin_c_mg DECIMAL(8,2) DEFAULT 0,
    calcium_mg DECIMAL(8,2) DEFAULT 0,
    iron_mg DECIMAL(8,2) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT foods_fdc_id_key UNIQUE (fdc_id)
);

-- Create meals table
CREATE TABLE public.meals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT,
    meal_type meal_type NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meal_items table (foods in meals)
CREATE TABLE public.meal_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
    food_id UUID REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL,
    quantity DECIMAL(8,2) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'serving',
    calories DECIMAL(8,2) NOT NULL,
    protein_g DECIMAL(8,2) DEFAULT 0,
    carbs_g DECIMAL(8,2) DEFAULT 0,
    fat_g DECIMAL(8,2) DEFAULT 0,
    fiber_g DECIMAL(8,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create water_intake table
CREATE TABLE public.water_intake (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount_ml INTEGER NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TIME DEFAULT CURRENT_TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weight_logs table
CREATE TABLE public.weight_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    weight_kg DECIMAL(5,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exercise_logs table
CREATE TABLE public.exercise_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    exercise_name TEXT NOT NULL,
    duration_minutes INTEGER,
    calories_burned INTEGER,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_foods_name ON public.foods(name);
CREATE INDEX idx_foods_barcode ON public.foods(barcode);
CREATE INDEX idx_meals_user_date ON public.meals(user_id, date);
CREATE INDEX idx_meals_date ON public.meals(date);
CREATE INDEX idx_meal_items_meal_id ON public.meal_items(meal_id);
CREATE INDEX idx_water_intake_user_date ON public.water_intake(user_id, date);
CREATE INDEX idx_weight_logs_user_date ON public.weight_logs(user_id, date);
CREATE INDEX idx_exercise_logs_user_date ON public.exercise_logs(user_id, date);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Foods policies (public read, authenticated users can add)
CREATE POLICY "Anyone can view foods" ON public.foods
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert foods" ON public.foods
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own foods" ON public.foods
    FOR UPDATE TO authenticated USING (auth.uid() = created_by);

-- Meals policies
CREATE POLICY "Users can view own meals" ON public.meals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meals" ON public.meals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meals" ON public.meals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meals" ON public.meals
    FOR DELETE USING (auth.uid() = user_id);

-- Meal items policies
CREATE POLICY "Users can view own meal items" ON public.meal_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.meals 
            WHERE meals.id = meal_items.meal_id 
            AND meals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own meal items" ON public.meal_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.meals 
            WHERE meals.id = meal_items.meal_id 
            AND meals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own meal items" ON public.meal_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.meals 
            WHERE meals.id = meal_items.meal_id 
            AND meals.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own meal items" ON public.meal_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.meals 
            WHERE meals.id = meal_items.meal_id 
            AND meals.user_id = auth.uid()
        )
    );

-- Water intake policies
CREATE POLICY "Users can view own water intake" ON public.water_intake
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own water intake" ON public.water_intake
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own water intake" ON public.water_intake
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own water intake" ON public.water_intake
    FOR DELETE USING (auth.uid() = user_id);

-- Weight logs policies
CREATE POLICY "Users can view own weight logs" ON public.weight_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight logs" ON public.weight_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight logs" ON public.weight_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight logs" ON public.weight_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Exercise logs policies
CREATE POLICY "Users can view own exercise logs" ON public.exercise_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercise logs" ON public.exercise_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercise logs" ON public.exercise_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercise logs" ON public.exercise_logs
    FOR DELETE USING (auth.uid() = user_id);

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

-- Foods will be populated from USDA database
