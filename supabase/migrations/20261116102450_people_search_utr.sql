-- People search also matches UTRs: each row carries that person's UTRs as one space-separated string.
CREATE OR REPLACE FUNCTION public.admin_people()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', u."id", 'name', u."name", 'email', u."email", 'phone', u."phone",
      'role', u."role", 'superAdmin', u."superAdmin", 'disabledAt', u."disabledAt", 'createdAt', u."createdAt", 'avantraId', s."avantraId",
      'schoolName', s."schoolName", 'feePaid', s."feePaidAt" IS NOT NULL,
      'utrs', (SELECT string_agg(p."utr", ' ') FROM public."Payment" p WHERE p."studentId" = u."id" AND p."utr" IS NOT NULL)) ORDER BY u."createdAt" DESC)
    FROM public."User" u LEFT JOIN public."Student" s ON s."userId" = u."id"), '[]');
END $function$;
