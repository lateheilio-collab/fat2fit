-- Migration: Add unique constraint to planned_workouts for upserts
ALTER TABLE public.planned_workouts DROP CONSTRAINT IF EXISTS unique_user_date_title;
ALTER TABLE public.planned_workouts ADD CONSTRAINT unique_user_date_title UNIQUE (user_id, date, title);
