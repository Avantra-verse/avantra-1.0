-- Exhibition flow is register -> pick a theme with the team -> pay: the fee no longer gates registering,
-- and the exhibition's description and judging criteria show before event day (other events stay hidden).
CREATE OR REPLACE FUNCTION public.register_event(p_event_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.my_student();
  ev public."Event";
  rid text;
BEGIN
  SELECT * INTO ev FROM public."Event" WHERE "id" = p_event_id FOR UPDATE;
  IF ev IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  IF NOT ev."registrationOpen" THEN RAISE EXCEPTION 'Registration for this event is closed' USING ERRCODE = 'PT400'; END IF;
  IF ev."capacity" IS NOT NULL AND (SELECT count(*) FROM public."Registration" WHERE "eventId" = ev."id") >= ev."capacity" THEN
    RAISE EXCEPTION 'This event is full' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."Registration" ("eventId", "studentId") VALUES (ev."id", uid) RETURNING "id" INTO rid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You are already registered for this event' USING ERRCODE = 'PT409';
  END;
  IF ev."teamMax" = 1 THEN
    PERFORM private.new_team(ev."id", (SELECT "name" FROM public."User" WHERE "id" = uid), NULL, NULL, rid);
  END IF;
  RETURN rid;
END $function$;

CREATE OR REPLACE FUNCTION public.events_list()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT CASE WHEN e."category" = 'EXHIBITION' OR private.wall_open() OR private.my_role() IN ('ADMIN', 'JUDGE', 'VOLUNTEER') THEN to_jsonb(e)
    ELSE to_jsonb(e) - 'description' - 'judgingCriteria' END
    || jsonb_build_object('spotsLeft',
    CASE WHEN e."capacity" IS NULL THEN NULL
    ELSE greatest(0, e."capacity" - (SELECT count(*) FROM public."Registration" r WHERE r."eventId" = e."id")) END)
  FROM public."Event" e
  ORDER BY e."category", e."name"
$function$;
