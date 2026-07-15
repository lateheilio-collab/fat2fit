-- Database Migration: Analytics and Metrics Adjustments

-- 0. Ensure profiles table has fat2fit_start_date
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS fat2fit_start_date date;

-- 1. Ensure user_goals fields (linking to goals)
ALTER TABLE IF EXISTS public.goals ADD COLUMN IF NOT EXISTS primary_metric_type text;
ALTER TABLE IF EXISTS public.goals ADD COLUMN IF NOT EXISTS secondary_metric_types text[];
ALTER TABLE IF EXISTS public.goals ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Create user_metrics table if not exists (to map settings/visibility of goals and custom metrics)
CREATE TABLE IF NOT EXISTS public.user_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    metric_type text NOT NULL, -- e.g., 'weight', 'waist_cm', 'sleep_hours', etc.
    display_name text NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('goal_created', 'user_created', 'integration', 'system_default', 'ai_suggested')),
    created_from_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
    is_goal_metric boolean NOT NULL DEFAULT false,
    is_visible_in_analytics boolean NOT NULL DEFAULT true,
    required_for_goal boolean NOT NULL DEFAULT false,
    metric_start_date date,
    target_value numeric(8,2),
    target_date date,
    data_source text,
    last_data_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_metric_type UNIQUE (user_id, metric_type)
);

-- 3. Ensure metric_entries table fields
ALTER TABLE IF EXISTS public.metric_entries ADD COLUMN IF NOT EXISTS metric_type text;
ALTER TABLE IF EXISTS public.metric_entries ADD COLUMN IF NOT EXISTS unit text;
ALTER TABLE IF EXISTS public.metric_entries ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE IF EXISTS public.metric_entries ADD COLUMN IF NOT EXISTS is_user_confirmed boolean NOT NULL DEFAULT true;

-- 4. Create analytics_settings table
CREATE TABLE IF NOT EXISTS public.analytics_settings (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    analytics_start_date date,
    default_time_range integer NOT NULL DEFAULT 30,
    hide_pre_data_period boolean NOT NULL DEFAULT true,
    show_empty_goal_metrics boolean NOT NULL DEFAULT true,
    require_min_data_for_trends boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and create policies
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all_user_metrics ON public.user_metrics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_analytics_settings ON public.analytics_settings FOR ALL USING (auth.uid() = user_id);
