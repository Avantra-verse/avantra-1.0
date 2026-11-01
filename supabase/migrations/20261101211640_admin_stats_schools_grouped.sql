-- Top schools: names that differ only in case or spaces count once. Already in admin_stats_more's file;
-- kept so the files match the live migration list (a no-op when the text was already replaced).
DO $$
BEGIN
  EXECUTE replace(pg_get_functiondef('public.admin_stats()'::regprocedure),
    '(SELECT "schoolName" school, count(*) n, count("feePaidAt") paid FROM public."Student" GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 8)',
    '(SELECT min("schoolName") school, count(*) n, count("feePaidAt") paid FROM public."Student"
        GROUP BY lower(regexp_replace(trim("schoolName"), ''\s+'', '' '', ''g'')) ORDER BY 2 DESC, 1 LIMIT 8)');
END $$;
