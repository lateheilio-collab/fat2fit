-- Database Schema for Fat2Fit AI Nutrition Coach

-- 1. Nutrition Profiles (Käyttäjän ravintoprofiili)
CREATE TABLE IF NOT EXISTS public.nutrition_profiles (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    diet_type text NOT NULL DEFAULT 'standard' CHECK (diet_type IN ('standard', 'vegetarian', 'vegan', 'pescatarian', 'gluten_free', 'lactose_free')),
    allergies text[] NOT NULL DEFAULT '{}',
    avoided_ingredients text[] NOT NULL DEFAULT '{}',
    favorite_ingredients text[] NOT NULL DEFAULT '{}',
    daily_meals_count integer NOT NULL DEFAULT 4,
    cooking_time_limit integer NOT NULL DEFAULT 45,
    budget_preference text NOT NULL DEFAULT 'medium' CHECK (budget_preference IN ('low', 'medium', 'high')),
    household_size integer NOT NULL DEFAULT 1,
    pantry text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Recipes (Reseptitietokanta)
CREATE TABLE IF NOT EXISTS public.recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    short_description text,
    instructions text NOT NULL,
    preparation_time integer NOT NULL DEFAULT 10,
    cooking_time integer NOT NULL DEFAULT 20,
    difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    default_servings integer NOT NULL DEFAULT 2,
    ingredients jsonb NOT NULL, -- array of { name, amount, unit, category, optional }
    calories_per_serving integer NOT NULL,
    protein_per_serving integer NOT NULL,
    carbohydrates_per_serving integer NOT NULL,
    fat_per_serving integer NOT NULL,
    fiber_per_serving integer NOT NULL DEFAULT 0,
    dietary_tags text[] NOT NULL DEFAULT '{}',
    allergen_tags text[] NOT NULL DEFAULT '{}',
    meal_type text NOT NULL DEFAULT 'dinner' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'evening_snack', 'other')),
    cuisine text,
    image_url text,
    image_source text,
    image_is_illustrative boolean NOT NULL DEFAULT true,
    recipe_source text NOT NULL DEFAULT 'ai_coach',
    estimated_cost text NOT NULL DEFAULT 'medium' CHECK (estimated_cost IN ('low', 'medium', 'high')),
    required_equipment text[] NOT NULL DEFAULT '{}',
    storage_instructions text,
    leftover_days integer NOT NULL DEFAULT 1,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    verified_status boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Meal Plans (Ruoka-ohjelmat)
CREATE TABLE IF NOT EXISTS public.meal_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    version integer NOT NULL DEFAULT 1,
    start_date date NOT NULL,
    end_date date NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb, -- dynamic calorieranges, macros
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_plan_version UNIQUE (user_id, start_date, version)
);

-- 4. Meal Plan Days (Ruoka-ohjelman päivät)
CREATE TABLE IF NOT EXISTS public.meal_plan_days (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    date date NOT NULL,
    is_workout_day boolean NOT NULL DEFAULT false,
    day_calories integer NOT NULL,
    day_protein integer NOT NULL,
    day_carbs integer NOT NULL,
    day_fat integer NOT NULL,
    CONSTRAINT unique_plan_date UNIQUE (plan_id, date)
);

-- 5. Planned Meals (Suunnitellut ateriat)
CREATE TABLE IF NOT EXISTS public.planned_meals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id uuid NOT NULL REFERENCES public.meal_plan_days(id) ON DELETE CASCADE,
    meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'evening_snack', 'other')),
    recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
    recipe_name text NOT NULL,
    is_locked boolean NOT NULL DEFAULT false,
    portion_size_factor numeric(3,2) NOT NULL DEFAULT 1.00,
    household_servings integer NOT NULL DEFAULT 1,
    calories integer NOT NULL,
    protein integer NOT NULL,
    carbs integer NOT NULL,
    fat integer NOT NULL,
    ingredients_snapshot jsonb, -- scaled ingredients list
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Shopping Lists (Ostoslistat)
CREATE TABLE IF NOT EXISTS public.shopping_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of merged items
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_shopping_range UNIQUE (user_id, start_date, end_date)
);

-- Enable RLS
ALTER TABLE public.nutrition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY owner_all_nutrition_profiles ON public.nutrition_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY read_all_recipes ON public.recipes FOR SELECT USING (true);
CREATE POLICY owner_all_recipes ON public.recipes FOR ALL USING (auth.uid() = created_by);
CREATE POLICY owner_all_meal_plans ON public.meal_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_meal_plan_days ON public.meal_plan_days FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meal_plans WHERE id = plan_id AND user_id = auth.uid())
);
CREATE POLICY owner_all_planned_meals ON public.planned_meals FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.meal_plan_days d
        JOIN public.meal_plans p ON p.id = d.plan_id
        WHERE d.id = day_id AND p.user_id = auth.uid()
    )
);
CREATE POLICY owner_all_shopping_lists ON public.shopping_lists FOR ALL USING (auth.uid() = user_id);
