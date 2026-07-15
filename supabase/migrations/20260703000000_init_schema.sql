-- Initial Database Schema for Fat2Fit

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Profiles & Preferences
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL,
    birth_year integer,
    height_cm numeric(5,2),
    gender text CHECK (gender IN ('male', 'female', 'other')),
    timezone text NOT NULL DEFAULT 'Europe/Helsinki',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_preferences (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    wake_up_time time NOT NULL DEFAULT '07:00:00',
    bed_time time NOT NULL DEFAULT '22:30:00',
    coaching_style text[] NOT NULL DEFAULT ARRAY['lempeä'],
    nutrition_style text NOT NULL DEFAULT 'joustava' CHECK (nutrition_style IN ('joustava', 'tarkka')),
    dietary_restrictions text[] NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notification_preferences (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    push_enabled boolean NOT NULL DEFAULT false,
    morning_checkin_reminder time NOT NULL DEFAULT '08:00:00',
    meal_reminders_enabled boolean NOT NULL DEFAULT false,
    bedtime_reminder time NOT NULL DEFAULT '21:30:00',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Goals & Goal Versions
CREATE TABLE public.goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    primary_objective text NOT NULL CHECK (primary_objective IN ('weight_loss', 'weight_maintenance', 'muscle_gain', 'body_recomposition', 'fitness_improvement', 'wellbeing_improvement', 'custom')),
    primary_objective_label text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    start_date date NOT NULL DEFAULT CURRENT_DATE,
    target_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.goal_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
    version integer NOT NULL,
    target_weight_kg numeric(5,2),
    target_body_fat_pct numeric(4,2),
    target_muscle_mass_kg numeric(5,2),
    target_waist_cm numeric(5,2),
    weekly_exercise_count_target integer,
    change_reason text,
    changed_at timestamptz NOT NULL DEFAULT now(),
    changed_by text NOT NULL DEFAULT 'user' CHECK (changed_by IN ('user', 'chatbot')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Measurements & Daily Check-Ins
CREATE TABLE public.body_measurements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    measured_at timestamptz NOT NULL DEFAULT now(),
    metric text NOT NULL CHECK (metric IN ('weight', 'body_fat_pct', 'muscle_mass_kg', 'waist_cm')),
    value numeric(5,2) NOT NULL,
    source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'chat', 'garmin', 'csv_import', 'image_extraction')),
    user_confirmed boolean NOT NULL DEFAULT true,
    confidence numeric(3,2) NOT NULL DEFAULT 1.00,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.daily_check_ins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    sleep_hours numeric(4,2),
    sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
    energy_level integer CHECK (energy_level BETWEEN 1 AND 5),
    stress_level integer CHECK (stress_level BETWEEN 1 AND 5),
    soreness_level integer CHECK (soreness_level BETWEEN 1 AND 5),
    hunger_level integer CHECK (hunger_level BETWEEN 1 AND 5),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- 4. Nutrition
CREATE TABLE public.food_reference_cache (
    id text PRIMARY KEY, -- Fineli-id
    name_fi text NOT NULL,
    name_en text,
    energy_kcal numeric(6,2) NOT NULL,
    protein_g numeric(5,2) NOT NULL,
    carbohydrates_g numeric(5,2) NOT NULL,
    fat_g numeric(5,2) NOT NULL,
    fiber_g numeric(5,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    logged_at timestamptz NOT NULL DEFAULT now(),
    meal_type text NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'evening_snack', 'other')),
    accuracy_class text NOT NULL CHECK (accuracy_class IN ('WEIGHED', 'RECIPE_EXACT', 'PACKAGE_LABEL', 'BARCODE', 'PHOTO_CONFIRMED', 'PHOTO_ESTIMATE', 'QUICK_TEXT_ENTRY')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meal_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    food_id text REFERENCES public.food_reference_cache(id) ON DELETE SET NULL,
    food_name text NOT NULL,
    amount_g numeric(6,2) NOT NULL,
    energy_kcal numeric(6,2) NOT NULL,
    protein_g numeric(5,2) NOT NULL,
    carbohydrates_g numeric(5,2) NOT NULL,
    fat_g numeric(5,2) NOT NULL,
    fiber_g numeric(5,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.meal_image_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    detected_payload jsonb NOT NULL,
    model_name text NOT NULL,
    confidence numeric(3,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Exercises & Plans
CREATE TABLE public.planned_workouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date date NOT NULL,
    activity_type text NOT NULL,
    title text NOT NULL,
    duration_minutes integer NOT NULL,
    intensity text NOT NULL CHECK (intensity IN ('recovery', 'easy', 'moderate', 'hard', 'very_hard')),
    status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'partially_completed', 'skipped', 'moved', 'cancelled')),
    locked_by_user boolean NOT NULL DEFAULT false,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('strava', 'garmin', 'manual', 'file_import')),
    external_id text,
    activity_type text NOT NULL,
    started_at timestamptz NOT NULL,
    duration_seconds integer NOT NULL,
    distance_meters numeric(8,2),
    calories_kcal numeric(6,2),
    average_heart_rate numeric(4,1),
    perceived_exertion integer CHECK (perceived_exertion BETWEEN 1 AND 10),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT unique_provider_external UNIQUE (provider, external_id)
);

CREATE TABLE public.plan_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    applied_at timestamptz NOT NULL DEFAULT now(),
    reason_code text NOT NULL CHECK (reason_code IN ('USER_REQUEST', 'MISSED_WORKOUT', 'EXTRA_ACTIVITY', 'LOW_SLEEP', 'HIGH_FATIGUE', 'HIGH_SORENESS', 'HIGH_STRESS', 'LOW_ENERGY', 'WEIGHT_TREND', 'NUTRITION_DEVIATION', 'SCHEDULE_CHANGE', 'RECOVERY_NEEDED', 'GOAL_UPDATED', 'OTHER')),
    description text NOT NULL,
    is_undone boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Chat & AI Logs
CREATE TABLE public.chat_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'Uusi keskustelu',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    tool_calls jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.oauth_tokens (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('strava')),
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.integration_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider text NOT NULL,
    external_event_id text NOT NULL,
    event_type text NOT NULL,
    payload_hash text NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    status text NOT NULL CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored_duplicate')),
    processing_attempts integer NOT NULL DEFAULT 0,
    error_message text,
    CONSTRAINT unique_provider_event UNIQUE (provider, external_event_id)
);

-- 7. Audit & Errors
CREATE TABLE public.audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Functions, Triggers & Row Level Security (RLS)

-- Auto-update updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
    new.updated_at = now();
    RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_notif_pref_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_daily_check_ins_updated_at BEFORE UPDATE ON public.daily_check_ins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_meals_updated_at BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_planned_workouts_updated_at BEFORE UPDATE ON public.planned_workouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_oauth_tokens_updated_at BEFORE UPDATE ON public.oauth_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to create public.profiles & preferences when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, timezone)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'Europe/Helsinki'
  );
  
  INSERT INTO public.user_preferences (user_id, coaching_style)
  VALUES (new.id, ARRAY['lempeä']);
  
  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all user tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_image_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Define RLS policies (simple owner access)
CREATE POLICY owner_all_profiles ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY owner_all_preferences ON public.user_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_notif_pref ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY owner_all_goals ON public.goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_goal_versions ON public.goal_versions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.goals WHERE goals.id = goal_versions.goal_id AND goals.user_id = auth.uid())
);

CREATE POLICY owner_all_body_measurements ON public.body_measurements FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_daily_check_ins ON public.daily_check_ins FOR ALL USING (auth.uid() = user_id);

CREATE POLICY owner_all_meals ON public.meals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_meal_items ON public.meal_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meals WHERE meals.id = meal_items.meal_id AND meals.user_id = auth.uid())
);
CREATE POLICY owner_all_meal_image_analyses ON public.meal_image_analyses FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meals WHERE meals.id = meal_image_analyses.meal_id AND meals.user_id = auth.uid())
);

CREATE POLICY owner_all_planned_workouts ON public.planned_workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_activities ON public.activities FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_plan_adjustments ON public.plan_adjustments FOR ALL USING (auth.uid() = user_id);

CREATE POLICY owner_all_chat_threads ON public.chat_threads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_chat_messages ON public.chat_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid())
);

CREATE POLICY owner_all_oauth_tokens ON public.oauth_tokens FOR ALL USING (auth.uid() = user_id);
CREATE POLICY owner_all_audit_events ON public.audit_events FOR ALL USING (auth.uid() = user_id);

-- Enable read-only access to Fineli cache for authenticated users
ALTER TABLE public.food_reference_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY authenticated_read_fineli ON public.food_reference_cache FOR SELECT TO authenticated USING (true);

-- Create database indexes for performance
CREATE INDEX idx_body_measurements_user_date ON public.body_measurements(user_id, measured_at DESC);
CREATE INDEX idx_daily_check_ins_user_date ON public.daily_check_ins(user_id, date DESC);
CREATE INDEX idx_meals_user_date ON public.meals(user_id, logged_at DESC);
CREATE INDEX idx_planned_workouts_user_date ON public.planned_workouts(user_id, date);
CREATE INDEX idx_activities_user_date ON public.activities(user_id, started_at DESC);
CREATE INDEX idx_fineli_name_trgm ON public.food_reference_cache USING gin (name_fi gin_trgm_ops);
