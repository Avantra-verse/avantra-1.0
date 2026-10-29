-- Admin desk: numbers, referral codes, UPI review list, cash fee, events, results, certificates, staff, Engagement Wall.
-- Was admin.controller, reports.controller (stats), events.controller (PATCH), certificates.controller (issue),
-- staff.controller (leaderboard) and wall.controller (admin side).
-- Not here (need files, email or the Auth admin API): UPI .xlsx, CSV exports, chits PDF, wall sheet import, staff accounts, walk-ins.

-- Throws unless the caller is an active admin; returns their id.
CREATE FUNCTION private.my_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.my_role() IS DISTINCT FROM 'ADMIN' THEN RAISE EXCEPTION 'Admins only' USING ERRCODE = 'PT403'; END IF;
  RETURN auth.uid();
END $$;

CREATE FUNCTION private.staff_json(p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', u."id", 'name', u."name", 'email', u."email", 'role', u."role", 'expiresAt', u."expiresAt",
    'disabledAt', u."disabledAt", 'createdAt', u."createdAt",
    'assignedEvent', (SELECT jsonb_build_object('id', e."id", 'name', e."name") FROM public."Event" e WHERE e."id" = u."assignedEventId"))
  FROM public."User" u WHERE u."id" = p_user
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.my_role() TO anon, authenticated; -- used inside RLS policies

-- ---- numbers ----

CREATE FUNCTION public.admin_stats() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  today timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata';
BEGIN
  PERFORM private.my_admin();
  RETURN jsonb_build_object(
    'students', (SELECT jsonb_build_object('total', count(*), 'paid', count("feePaidAt"), 'unpaid', count(*) - count("feePaidAt")) FROM public."Student"),
    'referralCodes', (SELECT count(DISTINCT "referralCode") FROM public."Student"),
    -- "online" = UPI and Razorpay; "cash" = taken at the desk.
    'fees', (SELECT jsonb_build_object(
      'onlinePaise', coalesce(sum("amountPaise") FILTER (WHERE "method" <> 'OFFLINE'), 0), 'onlineCount', count(*) FILTER (WHERE "method" <> 'OFFLINE'),
      'cashPaise', coalesce(sum("amountPaise") FILTER (WHERE "method" = 'OFFLINE'), 0), 'cashCount', count(*) FILTER (WHERE "method" = 'OFFLINE'))
      FROM public."Payment" WHERE "status" = 'PAID'),
    'gate', jsonb_build_object('checkedInToday', (SELECT count(DISTINCT "studentId") FROM public."CheckIn" WHERE "eventId" IS NULL AND "scannedAt" >= today)),
    'events', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e."id", 'name', e."name", 'capacity', e."capacity",
      'registrations', (SELECT count(*) FROM public."Registration" r WHERE r."eventId" = e."id"),
      'teams', (SELECT count(*) FROM public."Team" t WHERE t."eventId" = e."id"),
      'deskScans', (SELECT count(*) FROM public."CheckIn" c WHERE c."eventId" = e."id")) ORDER BY e."name") FROM public."Event" e), '[]'));
END $$;

-- Sign-ups and paid per referral code, typos included (codes are handed out by hand).
CREATE FUNCTION public.admin_referrals() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(x ORDER BY x."signups" DESC, x."code") FROM (
    SELECT "referralCode" AS "code", count(*) AS "signups", count("feePaidAt") AS "paid"
    FROM public."Student" WHERE "referralCode" IS NOT NULL GROUP BY "referralCode") x), '[]');
END $$;

-- ---- fee ----

-- UPI payments still waiting for the school's check, oldest first.
CREATE FUNCTION public.admin_upi_waiting() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', p."id", 'avantraId', s."avantraId", 'name', u."name", 'utr', p."utr", 'createdAt', p."createdAt")
    ORDER BY p."createdAt")
    FROM public."Payment" p JOIN public."Student" s ON s."userId" = p."studentId" JOIN public."User" u ON u."id" = s."userId"
    WHERE p."method" = 'UPI' AND p."status" = 'CREATED'), '[]');
END $$;

-- Cash fee at the desk for a student who signed up online. Records which admin took the money.
-- shortcut: no "fee confirmed" email yet; it comes with the email pass.
CREATE FUNCTION public.admin_mark_paid(p_avantra_id text, p_note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  admin uuid := private.my_admin();
  v_note text := nullif(trim(p_note), '');
  s public."Student";
BEGIN
  IF length(v_note) > 200 THEN RAISE EXCEPTION 'At most 200 characters' USING ERRCODE = 'PT400', HINT = 'note'; END IF;
  SELECT * INTO s FROM public."Student" WHERE "avantraId" = upper(trim(p_avantra_id)) FOR UPDATE; -- two admins clicking at once
  IF s IS NULL THEN RAISE EXCEPTION 'Unknown AVANTRA ID' USING ERRCODE = 'PT404'; END IF;
  IF s."feePaidAt" IS NOT NULL THEN RAISE EXCEPTION 'Fee already paid' USING ERRCODE = 'PT409'; END IF;
  UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = s."userId";
  INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
  VALUES (s."userId", 19900, 'OFFLINE', 'PAID', admin, v_note);
  RETURN jsonb_build_object('avantraId', s."avantraId", 'name', (SELECT "name" FROM public."User" WHERE "id" = s."userId"), 'feePaid', true);
END $$;

-- ---- events and results ----

CREATE FUNCTION public.admin_set_registration_open(p_event_id text, p_open boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public."Event";
BEGIN
  PERFORM private.my_admin();
  UPDATE public."Event" SET "registrationOpen" = p_open WHERE "id" = p_event_id RETURNING * INTO e;
  IF e IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  RETURN to_jsonb(e);
END $$;

-- Teams by average judge total (each judge's points summed, then averaged over judges), best first.
CREATE FUNCTION public.admin_event_leaderboard(p_event_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public."Event";
BEGIN
  PERFORM private.my_admin();
  SELECT * INTO e FROM public."Event" WHERE "id" = p_event_id;
  IF e IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object(
    'event', jsonb_build_object('id', e."id", 'name', e."name", 'judgingCriteria', to_jsonb(e."judgingCriteria"),
      'maxScore', cardinality(e."judgingCriteria") * 10),
    'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('teamId', t."id", 'name', t."name", 'projectTitle', t."projectTitle",
        'members', coalesce((SELECT jsonb_agg(jsonb_build_object('name', u."name", 'avantraId', s."avantraId") ORDER BY m."joinedAt")
          FROM public."TeamMember" m JOIN public."Registration" r ON r."id" = m."registrationId"
          JOIN public."Student" s ON s."userId" = r."studentId" JOIN public."User" u ON u."id" = s."userId" WHERE m."teamId" = t."id"), '[]'),
        'judges', j."judges", 'rank', t."rank", 'score', j."score")
      ORDER BY j."score" DESC NULLS LAST)
      FROM public."Team" t
      CROSS JOIN LATERAL (SELECT count(*) AS "judges", round(avg(total), 2) AS "score"
        FROM (SELECT sum(sc."points") AS total FROM public."Score" sc WHERE sc."teamId" = t."id" GROUP BY sc."judgeId") per) j
      WHERE t."eventId" = e."id"), '[]'));
END $$;

-- 1st–3rd place, or null to clear.
CREATE FUNCTION public.admin_set_rank(p_team_id text, p_rank int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t public."Team";
BEGIN
  PERFORM private.my_admin();
  IF p_rank IS NOT NULL AND p_rank NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Rank is 1, 2 or 3' USING ERRCODE = 'PT400', HINT = 'rank'; END IF;
  UPDATE public."Team" SET "rank" = p_rank WHERE "id" = p_team_id RETURNING * INTO t;
  IF t IS NULL THEN RAISE EXCEPTION 'Team not found' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object('id', t."id", 'name', t."name", 'rank', t."rank");
END $$;

-- After the event: everyone registered who checked in (gate or desk, either day) gets a certificate code.
-- Safe to run again, e.g. after setting ranks: existing codes stay, new attendees are added.
CREATE FUNCTION public.admin_issue_certificates(p_event_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reg text;
  n int := 0;
BEGIN
  PERFORM private.my_admin();
  IF NOT EXISTS (SELECT 1 FROM public."Event" WHERE "id" = p_event_id) THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  FOR reg IN SELECT r."id" FROM public."Registration" r
    WHERE r."eventId" = p_event_id AND r."certificateCode" IS NULL
      AND EXISTS (SELECT 1 FROM public."CheckIn" c WHERE c."studentId" = r."studentId") FOR UPDATE
  LOOP
    FOR attempt IN 1..5 LOOP -- retry when a random code clashes
      BEGIN
        UPDATE public."Registration" SET "certificateCode" = private.random_code(10), "certificateIssuedAt" = now() WHERE "id" = reg;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF attempt = 5 THEN RAISE; END IF;
      END;
    END LOOP;
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('issuedNow', n,
    'issued', (SELECT count(*) FROM public."Registration" WHERE "eventId" = p_event_id AND "certificateCode" IS NOT NULL),
    'notCheckedIn', (SELECT count(*) FROM public."Registration" r WHERE r."eventId" = p_event_id
      AND NOT EXISTS (SELECT 1 FROM public."CheckIn" c WHERE c."studentId" = r."studentId")));
END $$;

-- ---- volunteers and judges ----

CREATE FUNCTION public.admin_staff() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(private.staff_json(u."id") ORDER BY u."name") FROM public."User" u WHERE u."role" IN ('VOLUNTEER', 'JUDGE')), '[]');
END $$;

-- Move a judge to another event.
CREATE FUNCTION public.admin_assign_judge(p_user_id uuid, p_event_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF NOT EXISTS (SELECT 1 FROM public."Event" WHERE "id" = p_event_id) THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  UPDATE public."User" SET "assignedEventId" = p_event_id WHERE "id" = p_user_id AND "role" = 'JUDGE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Judge not found' USING ERRCODE = 'PT404'; END IF;
  RETURN private.staff_json(p_user_id);
END $$;

-- Switch any non-admin account off or on. Off = my_role() is null, so every function and policy refuses it
-- at once; its sessions are also deleted so it can't refresh.
CREATE FUNCTION public.admin_set_disabled(p_user_id uuid, p_disabled boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  UPDATE public."User" SET "disabledAt" = CASE WHEN p_disabled THEN coalesce("disabledAt", now()) END WHERE "id" = p_user_id AND "role" <> 'ADMIN';
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404'; END IF;
  IF p_disabled THEN DELETE FROM auth.sessions WHERE "user_id" = p_user_id; END IF;
  RETURN jsonb_build_object('id', p_user_id, 'disabled', p_disabled);
END $$;

-- ---- Engagement Wall ----

CREATE FUNCTION public.admin_wall() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN jsonb_build_object('open', private.wall_open(), 'frozenAt', private.wall_frozen_at(),
    'challenges', coalesce((SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'options', coalesce(c."options", '{}'), 'answers', coalesce(c."answers", '{}'),
      '_count', jsonb_build_object(
        'solves', (SELECT count(*) FROM public."WallSolve" w WHERE w."challengeId" = c."id"),
        'attempts', (SELECT count(*) FROM public."WallAttempt" a WHERE a."challengeId" = c."id"))) ORDER BY c."number")
      FROM public."WallChallenge" c), '[]'));
END $$;

-- open: event-day on/off (closed = codes can't be opened or answered; the leaderboard stays public).
-- frozen: the public board and ranks stop moving from now; unfreeze at the prize ceremony. Freezing twice keeps the first time.
CREATE FUNCTION public.admin_wall_state(p_open boolean DEFAULT NULL, p_frozen boolean DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF p_open IS NULL AND p_frozen IS NULL THEN RAISE EXCEPTION 'Send open and/or frozen' USING ERRCODE = 'PT400'; END IF;
  IF p_open IS NOT NULL THEN
    INSERT INTO public."Setting" ("key", "value") VALUES ('wall.open', p_open::text) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";
  END IF;
  IF p_frozen THEN
    INSERT INTO public."Setting" ("key", "value") VALUES ('wall.frozenAt', now()::text) ON CONFLICT ("key") DO NOTHING;
  ELSIF p_frozen = false THEN
    DELETE FROM public."Setting" WHERE "key" = 'wall.frozenAt';
  END IF;
  RETURN jsonb_build_object('open', private.wall_open(), 'frozenAt', private.wall_frozen_at());
END $$;

-- Hide or show a chit. (The UI only toggles "active"; answer edits with re-grading come back if the UI needs them.)
CREATE FUNCTION public.admin_wall_set_active(p_challenge_id text, p_active boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public."WallChallenge";
BEGIN
  PERFORM private.my_admin();
  UPDATE public."WallChallenge" SET "active" = p_active WHERE "id" = p_challenge_id RETURNING * INTO c;
  IF c IS NULL THEN RAISE EXCEPTION 'Challenge not found' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object('challenge', to_jsonb(c), 'regraded', 0);
END $$;

-- Lost or damaged chit: print a new one. The old code stops working; points already earned stay.
CREATE FUNCTION public.admin_wall_new_code(p_challenge_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public."WallChallenge";
BEGIN
  PERFORM private.my_admin();
  FOR attempt IN 1..5 LOOP
    BEGIN
      UPDATE public."WallChallenge" SET "code" = private.random_code(6) WHERE "id" = p_challenge_id RETURNING * INTO c;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
  IF c IS NULL THEN RAISE EXCEPTION 'Challenge not found' USING ERRCODE = 'PT404'; END IF;
  RETURN to_jsonb(c);
END $$;

-- Disputes: wipe one student's tries (and points) on one challenge so they get fresh tries.
CREATE FUNCTION public.admin_wall_reset(p_challenge_id text, p_avantra_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE uid uuid;
BEGIN
  PERFORM private.my_admin();
  SELECT "userId" INTO uid FROM public."Student" WHERE "avantraId" = upper(trim(p_avantra_id));
  IF uid IS NULL THEN RAISE EXCEPTION 'Student not found' USING ERRCODE = 'PT404'; END IF;
  DELETE FROM public."WallAttempt" WHERE "challengeId" = p_challenge_id AND "studentId" = uid;
  DELETE FROM public."WallSolve" WHERE "challengeId" = p_challenge_id AND "studentId" = uid;
END $$;

-- Every function above checks private.my_admin() itself; granting to authenticated only lets them be called.
DO $$
DECLARE f text;
BEGIN
  FOR f IN SELECT p.oid::regprocedure::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'admin\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;
