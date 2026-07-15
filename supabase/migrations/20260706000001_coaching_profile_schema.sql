-- Database Schema for Fat2Fit AI Coach Personal Decision-Making and Versioning

-- 1. Coaching Profiles (Valmennusprofiili)
CREATE TABLE IF NOT EXISTS public.coaching_profiles (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    fitness_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    load_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    nutrition_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    recovery_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    behavior_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    constraint_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Plan Versions (Suunnitelman versiointi)
CREATE TABLE IF NOT EXISTS public.plan_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    version integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    valid_until date,
    user_goal_at_creation text,
    fitness_profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    load_profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    recovery_profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
    affecting_user_updates text[] NOT NULL DEFAULT '{}',
    decision_reasoning text NOT NULL,
    changes_made jsonb NOT NULL DEFAULT '[]'::jsonb,
    change_reason text NOT NULL,
    user_accepted boolean NOT NULL DEFAULT true,
    CONSTRAINT unique_user_version UNIQUE (user_id, version)
);

-- Enable RLS
ALTER TABLE public.coaching_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY owner_all_coaching_profiles ON public.coaching_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_plan_versions ON public.plan_versions FOR ALL USING (auth.uid() = user_id);
