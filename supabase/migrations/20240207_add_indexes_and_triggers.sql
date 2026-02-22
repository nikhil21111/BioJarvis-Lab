-- Add missing indexes for performance
-- These indexes improve query performance for foreign key lookups and common queries

-- Add missing columns to query_cache if they don't exist
ALTER TABLE public.query_cache ADD COLUMN IF NOT EXISTS query_key text;
ALTER TABLE public.query_cache ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.query_cache ADD COLUMN IF NOT EXISTS hit_count integer DEFAULT 0;

-- Index on favorites.query_id for faster joins
CREATE INDEX IF NOT EXISTS idx_favorites_query_id 
ON public.favorites(query_id);

-- Index on query_cache.query_key for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_query_cache_query_key 
ON public.query_cache(query_key);

-- Index on query_cache.expires_at for cache cleanup queries
CREATE INDEX IF NOT EXISTS idx_query_cache_expires_at 
ON public.query_cache(expires_at);

-- Index on usage_tracking for faster daily usage lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date 
ON public.usage_tracking(user_id, date);

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger to query_history table
DROP TRIGGER IF EXISTS update_query_history_updated_at ON public.query_history;
CREATE TRIGGER update_query_history_updated_at
  BEFORE UPDATE ON public.query_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger to favorites table  
DROP TRIGGER IF EXISTS update_favorites_updated_at ON public.favorites;
CREATE TRIGGER update_favorites_updated_at
  BEFORE UPDATE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create scheduled job for cache cleanup (using pg_cron if available)
-- Note: pg_cron must be enabled in Supabase project settings
-- This job runs daily at 3 AM UTC to clean expired cache entries
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-expired-cache',
      '0 3 * * *',
      'SELECT clean_expired_cache()'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- pg_cron not available, skip scheduling
    RAISE NOTICE 'pg_cron not available, skipping cache cleanup job scheduling';
END $$;

-- Ensure clean_expired_cache function exists
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.query_cache
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
