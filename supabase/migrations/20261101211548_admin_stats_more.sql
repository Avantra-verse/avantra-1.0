-- Admin overview: more numbers (sign-ups, unfinished profiles, juniors/seniors, UPI waiting, exhibition
-- teams by size and theme, top schools (same name in any case counts once), staff). Every old key is kept as it was.
CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  today timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
  ex text := (SELECT "id" FROM public."Event" WHERE "category" = 'EXHIBITION' LIMIT 1);
BEGIN
  PERFORM private.my_admin();
  RETURN jsonb_build_object(
    'students', (SELECT jsonb_build_object('total', count(*), 'paid', count("feePaidAt"), 'unpaid', count(*) - count("feePaidAt"),
      'juniors', count(*) FILTER (WHERE "grade" BETWEEN 6 AND 8), 'seniors', count(*) FILTER (WHERE "grade" BETWEEN 9 AND 12),
      'below6', count(*) FILTER (WHERE "grade" < 6)) FROM public."Student"),
    'signups', (SELECT jsonb_build_object('today', count(*) FILTER (WHERE "createdAt" >= today),
      'week', count(*) FILTER (WHERE "createdAt" >= today - interval '6 days'),
      'profileUnfinished', count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public."Student" s WHERE s."userId" = u."id")))
      FROM public."User" u WHERE u."role" = 'STUDENT'),
    'referralCodes', (SELECT count(DISTINCT "referralCode") FROM public."Student"),
    -- "online" = UPI and Razorpay; "cash" = taken at the desk.
    'fees', (SELECT jsonb_build_object(
      'onlinePaise', coalesce(sum("amountPaise") FILTER (WHERE "method" <> 'OFFLINE'), 0), 'onlineCount', count(*) FILTER (WHERE "method" <> 'OFFLINE'),
      'cashPaise', coalesce(sum("amountPaise") FILTER (WHERE "method" = 'OFFLINE'), 0), 'cashCount', count(*) FILTER (WHERE "method" = 'OFFLINE'))
      FROM public."Payment" WHERE "status" = 'PAID'),
    'upiWaiting', (SELECT count(*) FROM public."Payment" WHERE "method" = 'UPI' AND "status" = 'CREATED'),
    'gate', jsonb_build_object('checkedInToday', (SELECT count(DISTINCT "studentId") FROM public."CheckIn" WHERE "eventId" IS NULL AND "scannedAt" >= today)),
    'exhibition', jsonb_build_object(
      'registered', (SELECT count(*) FROM public."Registration" WHERE "eventId" = ex),
      'paidNoTeam', (SELECT count(*) FROM public."Registration" r JOIN public."Student" s ON s."userId" = r."studentId"
        WHERE r."eventId" = ex AND s."feePaidAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."TeamMember" m WHERE m."registrationId" = r."id")),
      'teamSizes', (SELECT jsonb_build_object('1', count(*) FILTER (WHERE n = 1), '2', count(*) FILTER (WHERE n = 2), '3', count(*) FILTER (WHERE n >= 3))
        FROM (SELECT count(m.*) n FROM public."Team" t LEFT JOIN public."TeamMember" m ON m."teamId" = t."id" WHERE t."eventId" = ex GROUP BY t."id") x),
      'themes', coalesce((SELECT jsonb_agg(jsonb_build_object('topic', topic, 'students', n) ORDER BY n DESC, topic)
        FROM (SELECT "topic" topic, count(*) n FROM public."Registration" WHERE "eventId" = ex AND "topic" IS NOT NULL GROUP BY 1) x), '[]')),
    'topSchools', coalesce((SELECT jsonb_agg(jsonb_build_object('school', school, 'students', n, 'paid', paid) ORDER BY n DESC, school)
      FROM (SELECT min("schoolName") school, count(*) n, count("feePaidAt") paid FROM public."Student"
        GROUP BY lower(regexp_replace(trim("schoolName"), '\s+', ' ', 'g')) ORDER BY 2 DESC, 1 LIMIT 8) x), '[]'),
    'staff', (SELECT jsonb_build_object('volunteers', count(*) FILTER (WHERE "role" = 'VOLUNTEER'), 'judges', count(*) FILTER (WHERE "role" = 'JUDGE'),
      'admins', count(*) FILTER (WHERE "role" = 'ADMIN')) FROM public."User" WHERE "disabledAt" IS NULL),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e."id", 'name', e."name", 'capacity', e."capacity",
      'registrations', (SELECT count(*) FROM public."Registration" r WHERE r."eventId" = e."id"),
      'teams', (SELECT count(*) FROM public."Team" t WHERE t."eventId" = e."id"),
      'deskScans', (SELECT count(*) FROM public."CheckIn" c WHERE c."eventId" = e."id")) ORDER BY e."name") FROM public."Event" e), '[]'));
END $function$;
