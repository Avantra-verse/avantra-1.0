-- Science Exhibition teams are one class only: every member has the same grade.
-- Checked on join (code, link or accepted request) and on request; other team events can mix classes.

CREATE OR REPLACE FUNCTION private.assert_same_grade(p_team_id text, p_registration_id text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE mine int; theirs int;
BEGIN
  IF (SELECT e."category" FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId" WHERE t."id" = p_team_id) <> 'EXHIBITION' THEN RETURN; END IF;
  SELECT s."grade" INTO mine FROM public."Registration" r JOIN public."Student" s ON s."userId" = r."studentId" WHERE r."id" = p_registration_id;
  SELECT s."grade" INTO theirs FROM public."TeamMember" m JOIN public."Registration" r ON r."id" = m."registrationId"
    JOIN public."Student" s ON s."userId" = r."studentId"
  WHERE m."teamId" = p_team_id AND s."grade" IS DISTINCT FROM mine LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Exhibition teams are one class only. This team is class %.', theirs USING ERRCODE = 'PT409';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.assert_same_grade(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.add_member(p_team_id text, p_registration_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE team_max int; ev_id text;
BEGIN
  SELECT e."teamMax", e."id" INTO team_max, ev_id FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId" WHERE t."id" = p_team_id FOR UPDATE OF t;
  PERFORM private.assert_not_judged(p_team_id);
  PERFORM private.assert_team_fee(ev_id, p_registration_id);
  PERFORM private.assert_same_grade(p_team_id, p_registration_id);
  IF (SELECT count(*) FROM public."TeamMember" WHERE "teamId" = p_team_id) >= team_max THEN
    RAISE EXCEPTION 'This team is full' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."TeamMember" ("teamId", "registrationId") VALUES (p_team_id, p_registration_id);
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM public."TeamJoinRequest" WHERE "registrationId" = p_registration_id;
    RAISE EXCEPTION 'They are already in another team' USING ERRCODE = 'PT409';
  END;
  DELETE FROM public."TeamJoinRequest" WHERE "registrationId" = p_registration_id;
  UPDATE public."Registration" r SET "topic" = t."topic" FROM public."Team" t
  WHERE r."id" = p_registration_id AND t."id" = p_team_id AND t."topic" IS NOT NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.request_join(p_team_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  t public."Team";
  r record;
BEGIN
  SELECT * INTO t FROM public."Team" WHERE "id" = p_team_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'PT404'; END IF;
  r := private.my_registration(t."eventId");
  IF r.member IS NOT NULL THEN RAISE EXCEPTION 'You are already in a team for this event. Leave it first.' USING ERRCODE = 'PT409'; END IF;
  PERFORM private.assert_team_fee(t."eventId", (r.reg)."id");
  PERFORM private.assert_same_grade(t."id", (r.reg)."id");
  IF (SELECT count(*) FROM public."TeamMember" WHERE "teamId" = t."id") >= (r.ev)."teamMax" THEN
    RAISE EXCEPTION 'This team is full' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TeamJoinRequest" WHERE "teamId" = t."id" AND "registrationId" = (r.reg)."id") THEN RETURN; END IF;
  IF (SELECT count(*) FROM public."TeamJoinRequest" WHERE "registrationId" = (r.reg)."id") >= 5 THEN
    RAISE EXCEPTION 'You can have 5 requests waiting at a time. Cancel one first.' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public."TeamJoinRequest" ("teamId", "registrationId") VALUES (t."id", (r.reg)."id") ON CONFLICT DO NOTHING;
END $function$;

-- Open teams list hides exhibition teams of another class.
CREATE OR REPLACE FUNCTION public.open_teams(p_event_id text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  r record := private.my_registration(p_event_id);
  my_grade int := (SELECT "grade" FROM public."Student" WHERE "userId" = private.my_student());
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', t."id", 'name', t."name", 'projectTitle', t."projectTitle", 'members', c.n,
      'leaderName', l."name", 'school', l."schoolName",
      'requested', EXISTS (SELECT 1 FROM public."TeamJoinRequest" j WHERE j."teamId" = t."id" AND j."registrationId" = (r.reg)."id"))
      ORDER BY t."createdAt")
    FROM public."Team" t
    CROSS JOIN LATERAL (SELECT count(*) AS n FROM public."TeamMember" m WHERE m."teamId" = t."id") c
    LEFT JOIN LATERAL (
      SELECT u."name", s."schoolName" FROM public."TeamMember" m
      JOIN public."Registration" g ON g."id" = m."registrationId" JOIN public."Student" s ON s."userId" = g."studentId"
      JOIN public."User" u ON u."id" = s."userId"
      WHERE m."teamId" = t."id" AND m."isLeader") l ON true
    WHERE t."eventId" = p_event_id AND c.n < (r.ev)."teamMax"
      AND NOT EXISTS (SELECT 1 FROM public."Score" sc WHERE sc."teamId" = t."id")
      AND ((r.ev)."category" <> 'EXHIBITION' OR NOT EXISTS (
        SELECT 1 FROM public."TeamMember" m JOIN public."Registration" g ON g."id" = m."registrationId"
        JOIN public."Student" s ON s."userId" = g."studentId"
        WHERE m."teamId" = t."id" AND s."grade" IS DISTINCT FROM my_grade))), '[]');
END $function$;

-- A student in an exhibition team with others can't change class (would break the one-class rule).
CREATE OR REPLACE FUNCTION public.update_student_profile(profile jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  uid uuid := private.my_student();
  v_name text := trim(profile->>'name');
  v_phone text := profile->>'phone';
  v_grade int;
  v_school text := trim(profile->>'schoolName');
  v_section text := nullif(upper(trim(profile->>'section')), '');
  v_ref text := nullif(upper(trim(profile->>'referralCode')), '');
  v_g_email text := nullif(lower(trim(profile->>'guardianEmail')), '');
  v_g_phone text := nullif(profile->>'guardianPhone', '');
BEGIN
  PERFORM private.rate_limit('profile:' || uid, 20, 60);
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Type your full name' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF v_phone IS NULL OR v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING ERRCODE = 'PT400', HINT = 'phone'; END IF;
  BEGIN v_grade := (profile->>'grade')::int; EXCEPTION WHEN others THEN v_grade := NULL; END;
  IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Pick your class.' USING ERRCODE = 'PT400', HINT = 'grade'; END IF;
  IF v_grade IS DISTINCT FROM (SELECT "grade" FROM public."Student" WHERE "userId" = uid) AND EXISTS (
      SELECT 1 FROM public."TeamMember" me JOIN public."Registration" r ON r."id" = me."registrationId"
      JOIN public."Team" t ON t."id" = me."teamId" JOIN public."Event" e ON e."id" = t."eventId"
      WHERE r."studentId" = uid AND e."category" = 'EXHIBITION'
        AND EXISTS (SELECT 1 FROM public."TeamMember" o WHERE o."teamId" = me."teamId" AND o."registrationId" <> me."registrationId")) THEN
    RAISE EXCEPTION 'Your exhibition team is one class. Leave the team first to change your class.' USING ERRCODE = 'PT409', HINT = 'grade';
  END IF;
  IF v_school IS NULL OR length(v_school) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Type your school name' USING ERRCODE = 'PT400', HINT = 'schoolName'; END IF;
  IF length(v_section) > 10 THEN RAISE EXCEPTION 'At most 10 characters' USING ERRCODE = 'PT400', HINT = 'section'; END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Z]{3}[A-Z0-9]{3}$' THEN RAISE EXCEPTION 'That is not an ambassador code. Check it, or leave it blank.' USING ERRCODE = 'PT400', HINT = 'referralCode'; END IF;
  IF v_g_email IS NOT NULL AND (length(v_g_email) > 254 OR v_g_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Enter a valid email' USING ERRCODE = 'PT400', HINT = 'guardianEmail'; END IF;
  IF v_g_phone IS NOT NULL AND v_g_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING ERRCODE = 'PT400', HINT = 'guardianPhone'; END IF;

  UPDATE public."User" SET "name" = v_name, "phone" = v_phone WHERE "id" = uid;
  UPDATE public."Student" SET "grade" = v_grade, "section" = v_section, "schoolName" = v_school,
    "guardianEmail" = v_g_email, "guardianPhone" = v_g_phone, "referralCode" = coalesce("referralCode", v_ref)
  WHERE "userId" = uid;
END $function$;
