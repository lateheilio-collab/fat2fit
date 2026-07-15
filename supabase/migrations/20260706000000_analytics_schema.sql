-- Database Schema for Fat2Fit Personal Analytics

-- 1. Custom Metric Definitions
CREATE TABLE IF NOT EXISTS public.custom_metric_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('number', 'boolean', 'scale')),
    unit text, -- e.g., 'cm', 'mmHg', 'l', etc.
    target_value numeric(8,2),
    frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
    higher_is_better boolean NOT NULL DEFAULT true,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_metric_name UNIQUE (user_id, name)
);

-- 2. User Metric Settings (to toggle core and custom metrics visibility)
CREATE TABLE IF NOT EXISTS public.user_metric_settings (
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    metric_key text NOT NULL, -- e.g., 'weight', 'body_fat_pct', 'sleep_hours', or a custom_metric_definitions UUID
    is_enabled boolean NOT NULL DEFAULT true,
    target_value numeric(8,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, metric_key)
);

-- 3. Metric Entries (for logging custom metric values)
CREATE TABLE IF NOT EXISTS public.metric_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    metric_id uuid NOT NULL REFERENCES public.custom_metric_definitions(id) ON DELETE CASCADE,
    date date NOT NULL,
    value numeric(8,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_metric_date UNIQUE (user_id, metric_id, date)
);

-- 4. Analytics Snapshots (caching calculated analytics and trend lines)
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date date NOT NULL,
    snapshot_data jsonb NOT NULL, -- structured averages, progress, etc.
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_snapshot_date UNIQUE (user_id, date)
);

-- 5. Detected Insights (caching correlation insights)
CREATE TABLE IF NOT EXISTS public.detected_insights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    insight_type text NOT NULL, -- 'sleep_vs_hunger', 'alcohol_vs_hrv', etc.
    title text NOT NULL,
    content text NOT NULL,
    reliability text NOT NULL CHECK (reliability IN ('low', 'medium', 'high')),
    evidence_count integer NOT NULL DEFAULT 0,
    evidence_details jsonb NOT NULL DEFAULT '{}'::jsonb,
    recommendation text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_insight_type UNIQUE (user_id, insight_type)
);

-- 6. Weekly Reports (updated with more structured stats)
CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date date NOT NULL, -- end date of the week (usually Sunday)
    weight_average numeric(5,2),
    calories_average numeric(6,2),
    protein_average numeric(5,2),
    exercise_count integer,
    highlights text,
    status_summary text NOT NULL DEFAULT 'Etenee tavoitteessa',
    successes text[] NOT NULL DEFAULT '{}',
    focus_area text,
    nutrition_stats jsonb,
    exercise_stats jsonb,
    recovery_stats jsonb,
    trend_stats jsonb,
    recommendations text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_report_date UNIQUE (user_id, date)
);

-- Enable RLS
ALTER TABLE public.custom_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metric_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detected_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY owner_all_custom_metric_def ON public.custom_metric_definitions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_user_metric_settings ON public.user_metric_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_metric_entries ON public.metric_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_analytics_snapshots ON public.analytics_snapshots FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_detected_insights ON public.detected_insights FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_weekly_reports ON public.weekly_reports FOR ALL USING (auth.uid() = user_id);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_metric_entries_date ON public.metric_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON public.analytics_snapshots(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_detected_insights_type ON public.detected_insights(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_date ON public.weekly_reports(user_id, date DESC);
