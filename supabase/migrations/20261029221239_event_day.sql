-- Event details stay secret until event day: students and visitors get each event without its description and
-- judging criteria until an admin opens the Wall (the event-day switch). Staff and admins always see everything.
CREATE OR REPLACE FUNCTION public.events_list()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN private.wall_open() OR private.my_role() IN ('ADMIN', 'JUDGE', 'VOLUNTEER') THEN to_jsonb(e)
    ELSE to_jsonb(e) - 'description' - 'judgingCriteria' END
    || jsonb_build_object('spotsLeft',
    CASE WHEN e."capacity" IS NULL THEN NULL
    ELSE greatest(0, e."capacity" - (SELECT count(*) FROM public."Registration" r WHERE r."eventId" = e."id")) END)
  FROM public."Event" e
  ORDER BY e."category", e."name"
$function$;
