-- Supabase exposes the public schema over its REST API (anon/authenticated roles). Only the API, connecting as the
-- table owner (which bypasses RLS), should read these tables, so RLS on with no policies = REST API sees nothing.
-- New tables need the same line in their migration.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
