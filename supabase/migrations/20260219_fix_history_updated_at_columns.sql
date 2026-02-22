-- Fix schema mismatch: tables had updated_at triggers without updated_at columns.
-- This migration is safe and idempotent.

ALTER TABLE public.query_history
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.favorites
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Ensure trigger function exists.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers now that columns are guaranteed.
DROP TRIGGER IF EXISTS update_query_history_updated_at ON public.query_history;
CREATE TRIGGER update_query_history_updated_at
  BEFORE UPDATE ON public.query_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_favorites_updated_at ON public.favorites;
CREATE TRIGGER update_favorites_updated_at
  BEFORE UPDATE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
