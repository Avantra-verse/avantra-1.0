-- Volunteers (check-in), judges (scoring) and the public certificate check. Was staff.controller and certificates.controller.
-- Errors that concern a scanned student put {"student": card} in DETAIL, so the scanner still shows who it was.

-- The caller, if they're active staff in one of these roles.
CREATE FUNCTION private.my_staff(p_roles public."Role"[]) RETURNS public."User" LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE u public."User";
BEGIN
  IF private.my_role() IS NULL OR NOT private.my_role() = ANY (p_roles) THEN RAISE EXCEPTION 'Staff only' USING ERRCODE = 'PT403'; END IF;
  SELECT * INTO u FROM public."User" WHERE "id" = auth.uid();
  RETURN u;
END $$;

-- What staff see about a student: enough to match face to badge.
CREATE FUNCTION private.card(p_student uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('name', u."name", 'avantraId', s."avantraId", 'grade', s."grade", 'school', s."schoolName", 'feePaid', s."feePaidAt" IS NOT NULL)
  FROM public."Student" s JOIN public."User" u ON u."id" = s."userId" WHERE s."userId" = p_student
$$;

-- A scan: the QR's token, or the typed AVANTRA ID when the QR won't scan.
CREATE FUNCTION private.find_student(p_qr_token text, p_avantra_id text) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid;
BEGIN
  IF p_qr_token IS NOT NULL THEN SELECT "userId" INTO uid FROM public."Student" WHERE "qrToken" = trim(p_qr_token);
  ELSIF p_avantra_id IS NOT NULL THEN SELECT "userId" INTO uid FROM public."Student" WHERE "avantraId" = upper(trim(p_avantra_id));
  ELSE RAISE EXCEPTION 'Send qrToken or avantraId' USING ERRCODE = 'PT400';
  END IF;
  IF uid IS NULL THEN RAISE EXCEPTION 'Unknown badge' USING ERRCODE = 'PT404'; END IF;
  RETURN uid;
END $$;

-- The judge's one event.
CREATE FUNCTION private.judge_event() RETURNS public."Event" LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public."Event";
BEGIN
  SELECT ev.* INTO e FROM public."Event" ev WHERE ev."id" = (private.my_staff('{JUDGE}'))."assignedEventId";
  IF e IS NULL THEN RAISE EXCEPTION 'You are not assigned to an event yet' USING ERRCODE = 'PT403'; END IF;
  RETURN e;
END $$;

CREATE FUNCTION private.team_for_judge(p_team_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public."Event" := private.judge_event();
  t public."Team";
BEGIN
  SELECT * INTO t FROM public."Team" WHERE "id" = p_team_id AND "eventId" = e."id";
  IF t IS NULL THEN RAISE EXCEPTION 'Team not in your event' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object('id', t."id", 'name', t."name", 'projectTitle', t."projectTitle", 'topic', t."topic",
    'members', coalesce((SELECT jsonb_agg(jsonb_build_object('name', u."name", 'avantraId', s."avantraId") ORDER BY m."joinedAt")
      FROM public."TeamMember" m JOIN public."Registration" r ON r."id" = m."registrationId"
      JOIN public."Student" s ON s."userId" = r."studentId" JOIN public."User" u ON u."id" = s."userId" WHERE m."teamId" = t."id"), '[]'),
    'criteria', to_jsonb(e."judgingCriteria"), 'maxPoints', 10,
    'myScores', coalesce((SELECT jsonb_object_agg(sc."criterion", sc."points") FROM public."Score" sc
      WHERE sc."teamId" = t."id" AND sc."judgeId" = auth.uid()), '{}'));
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.my_role() TO anon, authenticated; -- used inside RLS policies

-- ---- volunteers ----

-- Gate (no event) or event desk. "Already checked in" = a scan within 12 h; event days run 10:30–19:00, so day 2 never matches day 1.
-- Offline scans sync later with their scan time (up to 48 h old).
CREATE FUNCTION public.staff_checkin(p_qr_token text DEFAULT NULL, p_avantra_id text DEFAULT NULL, p_event_id text DEFAULT NULL,
  p_scanned_at timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  staff public."User" := private.my_staff('{VOLUNTEER,ADMIN}');
  v_at timestamptz := coalesce(p_scanned_at, now());
  uid uuid;
  card jsonb;
  earlier timestamptz;
BEGIN
  IF v_at > now() + interval '1 minute' OR v_at < now() - interval '48 hours' THEN RAISE EXCEPTION 'Scan time is out of range' USING ERRCODE = 'PT400'; END IF;
  uid := private.find_student(p_qr_token, p_avantra_id);
  card := private.card(uid);
  IF p_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public."Registration" WHERE "eventId" = p_event_id AND "studentId" = uid) THEN
    RAISE EXCEPTION 'Not registered for this event' USING ERRCODE = 'PT403', DETAIL = jsonb_build_object('student', card)::text;
  END IF;
  PERFORM 1 FROM public."Student" WHERE "userId" = uid FOR UPDATE; -- two volunteers scanning the same badge at once
  SELECT min("scannedAt") INTO earlier FROM public."CheckIn"
  WHERE "studentId" = uid AND "eventId" IS NOT DISTINCT FROM p_event_id AND "scannedAt" > v_at - interval '12 hours' AND "scannedAt" <= v_at + interval '12 hours';
  IF earlier IS NOT NULL THEN RETURN jsonb_build_object('student', card, 'checkedInAt', earlier, 'alreadyCheckedIn', true); END IF;
  INSERT INTO public."CheckIn" ("studentId", "eventId", "scannedById", "scannedAt") VALUES (uid, p_event_id, staff."id", v_at);
  RETURN jsonb_build_object('student', card, 'checkedInAt', v_at, 'alreadyCheckedIn', false);
END $$;

-- A volunteer's own scans in the last 12 h: count + latest 20.
CREATE FUNCTION public.staff_my_scans() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH me AS (SELECT (private.my_staff('{VOLUNTEER,ADMIN}'))."id" AS id),
  mine AS (SELECT c.* FROM public."CheckIn" c, me WHERE c."scannedById" = me.id AND c."scannedAt" > now() - interval '12 hours')
  SELECT jsonb_build_object('total', (SELECT count(*) FROM mine), 'recent', coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'at' DESC) FROM (
      SELECT jsonb_build_object('at', m."scannedAt", 'place', coalesce(e."name", 'Main gate'), 'student', private.card(m."studentId")) x
      FROM mine m LEFT JOIN public."Event" e ON e."id" = m."eventId" ORDER BY m."scannedAt" DESC LIMIT 20) r), '[]'))
$$;

-- Look a student up without checking them in: AVANTRA ID (with or without "AV26-") or part of the name.
CREATE FUNCTION public.staff_find_students(p_q text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  q text := trim(p_q);
  v_id text := upper(trim(p_q));
BEGIN
  PERFORM private.my_staff('{VOLUNTEER,ADMIN}');
  IF length(q) < 2 THEN RAISE EXCEPTION 'Type at least 2 letters' USING ERRCODE = 'PT400'; END IF;
  IF v_id NOT LIKE 'AV26-%' THEN v_id := 'AV26-' || v_id; END IF;
  RETURN coalesce((SELECT jsonb_agg(r ORDER BY r->>'name') FROM (
    SELECT private.card(s."userId") || jsonb_build_object('checkedInAt', (SELECT max(c."scannedAt") FROM public."CheckIn" c
      WHERE c."studentId" = s."userId" AND c."eventId" IS NULL AND c."scannedAt" > now() - interval '12 hours')) r
    FROM public."Student" s JOIN public."User" u ON u."id" = s."userId"
    WHERE s."avantraId" = v_id OR u."name" ILIKE '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    ORDER BY u."name" LIMIT 20) x), '[]');
END $$;

-- ---- judges ----

-- Every team in the judge's event, and whether they've scored it yet.
CREATE FUNCTION public.judge_teams() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('event', to_jsonb(e), 'teams', coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', t."id", 'name', t."name", 'projectTitle', t."projectTitle", 'topic', t."topic",
      'members', (SELECT count(*) FROM public."TeamMember" m WHERE m."teamId" = t."id"),
      'scored', EXISTS (SELECT 1 FROM public."Score" sc WHERE sc."teamId" = t."id" AND sc."judgeId" = auth.uid())) ORDER BY t."name")
    FROM public."Team" t WHERE t."eventId" = e."id"), '[]'))
  FROM private.judge_event() e
$$;

-- The judge scans any member's QR (or types their AVANTRA ID) and gets that member's team in the judge's event.
CREATE FUNCTION public.judge_lookup(p_qr_token text DEFAULT NULL, p_avantra_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public."Event" := private.judge_event();
  uid uuid := private.find_student(p_qr_token, p_avantra_id);
  reg text;
  tid text;
BEGIN
  SELECT r."id", m."teamId" INTO reg, tid FROM public."Registration" r LEFT JOIN public."TeamMember" m ON m."registrationId" = r."id"
  WHERE r."eventId" = e."id" AND r."studentId" = uid;
  IF reg IS NULL THEN
    RAISE EXCEPTION 'Not registered for %', e."name" USING ERRCODE = 'PT404', DETAIL = jsonb_build_object('student', private.card(uid))::text;
  END IF;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Registered, but not in a team yet' USING ERRCODE = 'PT404', DETAIL = jsonb_build_object('student', private.card(uid))::text;
  END IF;
  RETURN private.team_for_judge(tid);
END $$;

CREATE FUNCTION public.judge_team(p_team_id text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.team_for_judge(p_team_id)
$$;

-- A judge can correct their own scores: one row per team × judge × criterion, 0–10 each.
CREATE FUNCTION public.judge_submit_scores(p_team_id text, p_scores jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public."Event" := private.judge_event();
  s jsonb;
  unknown text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Team" WHERE "id" = p_team_id AND "eventId" = e."id") THEN
    RAISE EXCEPTION 'Team not in your event' USING ERRCODE = 'PT404';
  END IF;
  IF jsonb_typeof(p_scores) IS DISTINCT FROM 'array' OR jsonb_array_length(p_scores) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Send 1 to 10 scores' USING ERRCODE = 'PT400';
  END IF;
  SELECT string_agg(x->>'criterion', ', ') INTO unknown FROM jsonb_array_elements(p_scores) x
  WHERE NOT coalesce(x->>'criterion' = ANY (e."judgingCriteria"), false);
  IF unknown IS NOT NULL THEN RAISE EXCEPTION 'Unknown criteria: %', unknown USING ERRCODE = 'PT400'; END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(p_scores) LOOP
    IF jsonb_typeof(s->'points') IS DISTINCT FROM 'number' OR (s->>'points')::numeric NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10) THEN
      RAISE EXCEPTION 'Points are whole numbers from 0 to 10' USING ERRCODE = 'PT400';
    END IF;
    INSERT INTO public."Score" ("teamId", "judgeId", "criterion", "points") VALUES (p_team_id, auth.uid(), s->>'criterion', (s->>'points')::int)
    ON CONFLICT ("teamId", "judgeId", "criterion") DO UPDATE SET "points" = EXCLUDED."points";
  END LOOP;
  RETURN private.team_for_judge(p_team_id);
END $$;

-- ---- certificates: the public verify page. Only what's printed on the certificate is shown. ----

CREATE FUNCTION public.certificate(p_code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE c jsonb;
BEGIN
  SELECT jsonb_build_object('valid', true, 'code', r."certificateCode", 'name', u."name", 'school', s."schoolName", 'event', e."name",
    'rank', t."rank", 'issuedAt', r."certificateIssuedAt") INTO c
  FROM public."Registration" r
  JOIN public."Event" e ON e."id" = r."eventId"
  JOIN public."Student" s ON s."userId" = r."studentId" JOIN public."User" u ON u."id" = s."userId"
  LEFT JOIN public."TeamMember" m ON m."registrationId" = r."id" LEFT JOIN public."Team" t ON t."id" = m."teamId"
  WHERE r."certificateCode" = upper(trim(p_code));
  IF c IS NULL THEN RAISE EXCEPTION 'No certificate with this ID' USING ERRCODE = 'PT404'; END IF;
  RETURN c;
END $$;

REVOKE ALL ON FUNCTION public.staff_checkin(text, text, text, timestamptz), public.staff_my_scans(), public.staff_find_students(text),
  public.judge_teams(), public.judge_lookup(text, text), public.judge_team(text), public.judge_submit_scores(text, jsonb),
  public.certificate(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_checkin(text, text, text, timestamptz), public.staff_my_scans(), public.staff_find_students(text),
  public.judge_teams(), public.judge_lookup(text, text), public.judge_team(text), public.judge_submit_scores(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.certificate(text) TO anon, authenticated;
