-- Migration: Advanced Nutrition Coach Schema Enhancements

-- 1. recipe_interactions
CREATE TABLE IF NOT EXISTS public.recipe_interactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipe_id text NOT NULL, -- references rec-1, rec-2 or a database uuid
    is_favorite boolean NOT NULL DEFAULT false,
    favorite_frequency text NOT NULL DEFAULT 'weekly' CHECK (favorite_frequency IN ('occasional', 'weekly', 'frequent', 'always', 'never')),
    last_used_at timestamptz,
    uses_last_7_days integer NOT NULL DEFAULT 0,
    uses_last_14_days integer NOT NULL DEFAULT 0,
    uses_last_30_days integer NOT NULL DEFAULT 0,
    user_rating integer CHECK (user_rating BETWEEN 1 AND 5),
    rejected_by_user boolean NOT NULL DEFAULT false,
    rejection_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_recipe_interaction UNIQUE (user_id, recipe_id)
);

-- RLS for recipe_interactions
ALTER TABLE public.recipe_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_all_recipe_interactions ON public.recipe_interactions;
CREATE POLICY owner_all_recipe_interactions ON public.recipe_interactions FOR ALL USING (auth.uid() = user_id);

-- 2. Add leftovers_preference column to nutrition_profiles
ALTER TABLE public.nutrition_profiles ADD COLUMN IF NOT EXISTS leftovers_preference text NOT NULL DEFAULT 'two_days' CHECK (leftovers_preference IN ('none', 'two_days', 'three_days', 'cook_less'));

-- 3. Add columns to planned_meals
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS is_leftover boolean NOT NULL DEFAULT false;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS source_meal_id text;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS planned_servings integer NOT NULL DEFAULT 1;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS user_serving_multiplier numeric(3,2) NOT NULL DEFAULT 1.00;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS repetition_reason text;
ALTER TABLE public.planned_meals ADD COLUMN IF NOT EXISTS regeneration_count integer NOT NULL DEFAULT 0;
