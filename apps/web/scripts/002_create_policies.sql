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
