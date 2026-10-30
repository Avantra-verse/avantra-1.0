-- Exhibition flow is details -> pick a theme -> pay; forming a team is a separate step. So each student's
-- theme lives on their registration (my_registrations returns it via to_jsonb), and the team takes the leader's.
ALTER TABLE public."Registration" ADD COLUMN "topic" TEXT;

DROP FUNCTION public.register_event(text);
CREATE FUNCTION public.register_event(p_event_id text, p_topic text DEFAULT NULL)
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
  -- Same list as create_team and EXHIBITION_TOPICS in packages/shared.
  IF ev."category" = 'EXHIBITION' AND (p_topic IS NULL OR p_topic NOT IN ('Artificial Intelligence & Machine Learning', 'Robotics',
      'Smart Infrastructure & Engineering', 'Emerging Technology', 'IoT & Smart Systems', 'HealthTech & Bio-Innovation',
      'Climate & Sustainability', 'Social Innovation & Entrepreneurship', 'AgriTech & Food Innovation')) THEN
    RAISE EXCEPTION 'Pick a theme from the list' USING ERRCODE = 'PT400', HINT = 'topic';
  END IF;
  IF ev."capacity" IS NOT NULL AND (SELECT count(*) FROM public."Registration" WHERE "eventId" = ev."id") >= ev."capacity" THEN
    RAISE EXCEPTION 'This event is full' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."Registration" ("eventId", "studentId", "topic")
    VALUES (ev."id", uid, CASE WHEN ev."category" = 'EXHIBITION' THEN p_topic END) RETURNING "id" INTO rid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You are already registered for this event' USING ERRCODE = 'PT409';
  END;
  IF ev."teamMax" = 1 THEN
    PERFORM private.new_team(ev."id", (SELECT "name" FROM public."User" WHERE "id" = uid), NULL, NULL, rid);
  END IF;
  RETURN rid;
END $function$;

REVOKE ALL ON FUNCTION public.register_event(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_event(text, text) TO authenticated;
