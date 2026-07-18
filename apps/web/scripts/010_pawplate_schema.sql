-- ============================================================
-- PawPlate schema migration (Phase 1)
-- Transforms the human-nutrition schema into a canine one.
--
-- DECISION: the physical table `foods` keeps its name. Renaming it
-- would ripple through the USDA importer, the fuzzy_search_foods RPC,
-- and every existing query. Instead the TS layer exposes it as
-- `Ingredient` (see lib/types.ts). This is a deliberate trade-off.
-- ============================================================

-- ---------- Enums ----------
DO $$ BEGIN
    CREATE TYPE dog_activity_level AS ENUM
        ('sedentary','lightly_active','moderately_active','very_active','working');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE dog_life_stage AS ENUM
        ('puppy','adult','senior','pregnant','lactating');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE meal_source AS ENUM ('manual','photo','recipe');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- dogs ----------
-- profiles keeps holding the human account; dogs are the tracked subjects.
CREATE TABLE IF NOT EXISTS public.dogs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    breed TEXT,                      -- free text for now; FK to breeds later
    weight_kg DECIMAL(5,2) NOT NULL CHECK (weight_kg > 0),
    ideal_weight_kg DECIMAL(5,2) CHECK (ideal_weight_kg > 0),
    birth_date DATE,
    life_stage dog_life_stage DEFAULT 'adult',
    activity_level dog_activity_level DEFAULT 'moderately_active',
    neutered BOOLEAN DEFAULT TRUE,
    health_conditions TEXT[] DEFAULT '{}',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dogs_owner_id ON public.dogs(owner_id);

DO $$ BEGIN
    CREATE TRIGGER handle_updated_at_dogs
        BEFORE UPDATE ON public.dogs
        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- foods (exposed as "ingredients") — canine nutrient columns ----------
-- Hand-curated ingredients (e.g. eggshell powder) have no USDA FDC id;
-- fdc_id stays UNIQUE but becomes optional. (Guarded: the legacy scripts/
-- chain never had the column, only the consolidated migration does.)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'foods'
                 AND column_name = 'fdc_id') THEN
        ALTER TABLE public.foods ALTER COLUMN fdc_id DROP NOT NULL;
    END IF;
END $$;

ALTER TABLE public.foods
    ADD COLUMN IF NOT EXISTS taurine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phosphorus_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS omega3_epa_dha_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS omega6_la_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vitamin_d_iu DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS choline_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS copper_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS manganese_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iodine_mcg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS methionine_cystine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lysine_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tryptophan_mg DECIMAL(8,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_safe_for_dogs BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS toxicity_note TEXT;

-- ---------- nutrient_requirements (RDA reference model) ----------
-- Requirements expressed per 1000 kcal ME (AAFCO style). Targets for a
-- specific dog are computed: amount_per_1000kcal * (daily kcal / 1000).
-- amount_per_1000kcal may be NULL for tracked-but-no-formal-RDA nutrients
-- (e.g. taurine in dogs) — the engine treats those as informational.
CREATE TABLE IF NOT EXISTS public.nutrient_requirements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nutrient_key TEXT NOT NULL,           -- 'protein_g','calcium_mg','taurine_mg',...
    life_stage dog_life_stage NOT NULL,
    amount_per_1000kcal DECIMAL(10,3),
    unit TEXT NOT NULL,
    min_value DECIMAL(10,3),              -- safe lower bound per 1000 kcal
    max_value DECIMAL(10,3),              -- safe upper bound per 1000 kcal (toxicity)
    source TEXT NOT NULL,                 -- 'NRC 2006' | 'AAFCO 2016' | editorial
    notes TEXT,
    UNIQUE (nutrient_key, life_stage, source)
);

CREATE INDEX IF NOT EXISTS idx_nutrient_requirements_lookup
    ON public.nutrient_requirements(life_stage, nutrient_key);

-- ---------- meals: point at dogs, record provenance ----------
ALTER TABLE public.meals
    ADD COLUMN IF NOT EXISTS dog_id UUID REFERENCES public.dogs(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS source meal_source DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_meals_dog_date ON public.meals(dog_id, date);

-- ---------- weight_logs: repurpose for dog weight tracking ----------
ALTER TABLE public.weight_logs
    ADD COLUMN IF NOT EXISTS dog_id UUID REFERENCES public.dogs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_weight_logs_dog_date ON public.weight_logs(dog_id, date);

-- ---------- drop human-only tables ----------
DROP TABLE IF EXISTS public.water_intake;
DROP TABLE IF EXISTS public.exercise_logs;

-- ---------- bowl_analyses (vision-model output + correction feedback) ----------
CREATE TABLE IF NOT EXISTS public.bowl_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dog_id UUID REFERENCES public.dogs(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    model_version TEXT NOT NULL,
    raw_output JSONB NOT NULL,            -- full structured model response
    identified_items JSONB NOT NULL,      -- [{ingredient_id, name, proportion, confidence}]
    user_corrected JSONB,                 -- owner edits — gold data for eval
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bowl_analyses_dog_id ON public.bowl_analyses(dog_id);

-- ---------- RLS ----------
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrient_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bowl_analyses ENABLE ROW LEVEL SECURITY;

-- dogs: owners CRUD their own
DO $$ BEGIN
    CREATE POLICY "Users can view own dogs" ON public.dogs
        FOR SELECT USING (auth.uid() = owner_id);
    CREATE POLICY "Users can insert own dogs" ON public.dogs
        FOR INSERT WITH CHECK (auth.uid() = owner_id);
    CREATE POLICY "Users can update own dogs" ON public.dogs
        FOR UPDATE USING (auth.uid() = owner_id);
    CREATE POLICY "Users can delete own dogs" ON public.dogs
        FOR DELETE USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- nutrient_requirements: public read, writes via service role only
DO $$ BEGIN
    CREATE POLICY "Anyone can view nutrient requirements" ON public.nutrient_requirements
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- bowl_analyses: access through dog ownership
DO $$ BEGIN
    CREATE POLICY "Users can view own bowl analyses" ON public.bowl_analyses
        FOR SELECT USING (
            EXISTS (SELECT 1 FROM public.dogs d
                    WHERE d.id = bowl_analyses.dog_id AND d.owner_id = auth.uid())
        );
    CREATE POLICY "Users can insert own bowl analyses" ON public.bowl_analyses
        FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM public.dogs d
                    WHERE d.id = bowl_analyses.dog_id AND d.owner_id = auth.uid())
        );
    CREATE POLICY "Users can update own bowl analyses" ON public.bowl_analyses
        FOR UPDATE USING (
            EXISTS (SELECT 1 FROM public.dogs d
                    WHERE d.id = bowl_analyses.dog_id AND d.owner_id = auth.uid())
        );
    CREATE POLICY "Users can delete own bowl analyses" ON public.bowl_analyses
        FOR DELETE USING (
            EXISTS (SELECT 1 FROM public.dogs d
                    WHERE d.id = bowl_analyses.dog_id AND d.owner_id = auth.uid())
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
