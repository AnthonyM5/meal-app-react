-- Add recipes feature - Composite Meals
-- This migration adds support for reusable recipe templates

-- Create recipes table
CREATE TABLE public.recipes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT FALSE,
    servings DECIMAL(4,2) DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for recipes table
CREATE INDEX idx_recipes_created_by ON public.recipes(created_by);
CREATE INDEX idx_recipes_public ON public.recipes(is_public);

-- Create recipe_ingredients table
CREATE TABLE public.recipe_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE NOT NULL,
    food_id UUID REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL,
    quantity DECIMAL(8,2) NOT NULL,
    unit TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for recipe_ingredients
CREATE INDEX idx_recipe_ingredients_recipe_id ON public.recipe_ingredients(recipe_id);

-- Modify meal_items table to support recipes
ALTER TABLE public.meal_items 
ADD COLUMN recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
ADD COLUMN serving_multiplier DECIMAL(4,2) DEFAULT 1;

-- Make food_id nullable since we might reference a recipe instead
ALTER TABLE public.meal_items 
ALTER COLUMN food_id DROP NOT NULL;

-- Add constraint: either food_id or recipe_id must be present
ALTER TABLE public.meal_items
ADD CONSTRAINT meal_item_source_check 
CHECK ((food_id IS NOT NULL AND recipe_id IS NULL) OR (food_id IS NULL AND recipe_id IS NOT NULL));

-- Enable Row Level Security on new tables
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- Recipes RLS policies
-- Users can view own and public recipes
CREATE POLICY "Users can view own and public recipes" ON public.recipes
    FOR SELECT USING (
        auth.uid() = created_by OR is_public = true
    );

-- Users can create recipes
CREATE POLICY "Users can create recipes" ON public.recipes
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Users can update own recipes
CREATE POLICY "Users can update own recipes" ON public.recipes
    FOR UPDATE USING (auth.uid() = created_by);

-- Users can delete own recipes
CREATE POLICY "Users can delete own recipes" ON public.recipes
    FOR DELETE USING (auth.uid() = created_by);

-- Recipe ingredients RLS policies
-- Users can view recipe ingredients if they can view the recipe
CREATE POLICY "Users can view recipe ingredients" ON public.recipe_ingredients
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND (recipes.created_by = auth.uid() OR recipes.is_public = true)
        )
    );

-- Users can insert recipe ingredients for their own recipes
CREATE POLICY "Users can insert own recipe ingredients" ON public.recipe_ingredients
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.created_by = auth.uid()
        )
    );

-- Users can update recipe ingredients for their own recipes
CREATE POLICY "Users can update own recipe ingredients" ON public.recipe_ingredients
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.created_by = auth.uid()
        )
    );

-- Users can delete recipe ingredients for their own recipes
CREATE POLICY "Users can delete own recipe ingredients" ON public.recipe_ingredients
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.recipes 
            WHERE recipes.id = recipe_ingredients.recipe_id 
            AND recipes.created_by = auth.uid()
        )
    );

-- Add updated_at trigger for recipes table
CREATE TRIGGER handle_updated_at_recipes
    BEFORE UPDATE ON public.recipes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
