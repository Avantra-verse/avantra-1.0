-- Students list shows when each account was made (it was already sorted newest first).
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
      'schoolName', s."schoolName", 'feePaid', s."feePaidAt" IS NOT NULL) ORDER BY u."createdAt" DESC)
    FROM public."User" u LEFT JOIN public."Student" s ON s."userId" = u."id"), '[]');
END $function$;
