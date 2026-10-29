-- Event entries and teams (was registrations.controller + teams.controller). Same rules, same messages.
-- Every function is SECURITY DEFINER and checks the caller itself. Errors use PTxxx codes, which PostgREST turns
-- into that HTTP status (PT404 = 404). Teammates' data leaves the database as name + AVANTRA ID only.

-- The caller, if they're an active student with a profile.
CREATE FUNCTION private.my_student() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.my_role() IS DISTINCT FROM 'STUDENT' OR NOT EXISTS (SELECT 1 FROM public."Student" WHERE "userId" = auth.uid()) THEN
    RAISE EXCEPTION 'Complete your profile first' USING ERRCODE = 'PT403';
  END IF;
  RETURN auth.uid();
END $$;

-- The caller's entry for an event, with the event and their team (if any).
CREATE FUNCTION private.my_registration(p_event_id text, OUT reg public."Registration", OUT ev public."Event", OUT member public."TeamMember")
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  SELECT * INTO reg FROM public."Registration" WHERE "eventId" = p_event_id AND "studentId" = private.my_student();
  IF reg IS NULL THEN RAISE EXCEPTION 'Register for this event before creating or joining a team' USING ERRCODE = 'PT403'; END IF;
  SELECT * INTO ev FROM public."Event" WHERE "id" = p_event_id;
  SELECT * INTO member FROM public."TeamMember" WHERE "registrationId" = reg."id";
END $$;

-- The caller must be in this team (and its leader, when asked). Returns the caller's registration id.
CREATE FUNCTION private.my_team_registration(p_team_id text, p_leader boolean) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public."TeamMember";
BEGIN
  SELECT tm.* INTO m FROM public."TeamMember" tm JOIN public."Registration" r ON r."id" = tm."registrationId"
  WHERE tm."teamId" = p_team_id AND r."studentId" = private.my_student();
  IF m IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'PT404'; END IF;
  IF p_leader AND NOT m."isLeader" THEN RAISE EXCEPTION 'Only the team leader can do this' USING ERRCODE = 'PT403'; END IF;
  RETURN m."registrationId";
END $$;

-- Once a judge has scored the team, its members are fixed.
CREATE FUNCTION private.assert_not_judged(p_team_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public."Score" WHERE "teamId" = p_team_id) THEN
    RAISE EXCEPTION 'Team members are locked after judging starts' USING ERRCODE = 'PT409';
  END IF;
END $$;

-- Joining by code and an accepted request both end here. Locks the team so two people can't both take its last place.
CREATE FUNCTION private.add_member(p_team_id text, p_registration_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE team_max int;
BEGIN
  SELECT e."teamMax" INTO team_max FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId" WHERE t."id" = p_team_id FOR UPDATE OF t;
  PERFORM private.assert_not_judged(p_team_id);
  IF (SELECT count(*) FROM public."TeamMember" WHERE "teamId" = p_team_id) >= team_max THEN
    RAISE EXCEPTION 'This team is full' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."TeamMember" ("teamId", "registrationId") VALUES (p_team_id, p_registration_id);
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM public."TeamJoinRequest" WHERE "registrationId" = p_registration_id; -- they started their own team after asking
    RAISE EXCEPTION 'They are already in another team' USING ERRCODE = 'PT409';
  END;
  DELETE FROM public."TeamJoinRequest" WHERE "registrationId" = p_registration_id; -- their requests to other teams are over
END $$;

-- A new team with the caller's registration as leader. Retries when the random invite code is taken.
CREATE FUNCTION private.new_team(p_event_id text, p_name text, p_project_title text, p_topic text, p_registration_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tid text;
BEGIN
  FOR attempt IN 1..5 LOOP
    BEGIN
      INSERT INTO public."Team" ("eventId", "name", "projectTitle", "topic", "inviteCode")
      VALUES (p_event_id, p_name, p_project_title, p_topic, private.random_code(6)) RETURNING "id" INTO tid;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public."TeamMember" ("teamId", "registrationId", "isLeader") VALUES (tid, p_registration_id, true);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You are already in a team for this event' USING ERRCODE = 'PT409';
  END;
  RETURN tid;
END $$;

-- Who someone is, as teammates see them.
CREATE FUNCTION private.person(p_registration_id text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('student', jsonb_build_object('avantraId', s."avantraId", 'user', jsonb_build_object('name', u."name")))
  FROM public."Registration" r JOIN public."Student" s ON s."userId" = r."studentId" JOIN public."User" u ON u."id" = s."userId"
  WHERE r."id" = p_registration_id
$$;

-- A team as its members see it (the invite code is only ever shown to members).
CREATE FUNCTION private.team_json(p_team_id text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(t)
    || jsonb_build_object('event', jsonb_build_object('id', e."id", 'name', e."name", 'teamMin', e."teamMin", 'teamMax', e."teamMax"))
    || jsonb_build_object('members', coalesce((
         SELECT jsonb_agg(jsonb_build_object('registrationId', m."registrationId", 'isLeader', m."isLeader", 'joinedAt', m."joinedAt",
           'registration', private.person(m."registrationId")) ORDER BY m."joinedAt")
         FROM public."TeamMember" m WHERE m."teamId" = t."id"), '[]'))
    || jsonb_build_object('joinRequests', coalesce((
         SELECT jsonb_agg(jsonb_build_object('registrationId', j."registrationId", 'createdAt', j."createdAt",
           'registration', private.person(j."registrationId")) ORDER BY j."createdAt")
         FROM public."TeamJoinRequest" j WHERE j."teamId" = t."id"), '[]'))
  FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId"
  WHERE t."id" = p_team_id
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.my_role() TO anon, authenticated; -- used inside RLS policies

-- ---- event entries: free, except EXHIBITION events need the fee ----

CREATE FUNCTION public.my_registrations() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(
    to_jsonb(r)
    || jsonb_build_object('event', jsonb_build_object('id', e."id", 'slug', e."slug", 'name', e."name", 'category', e."category",
         'teamMin', e."teamMin", 'teamMax', e."teamMax"))
    || jsonb_build_object('teamMember', CASE WHEN m IS NULL THEN NULL
         ELSE jsonb_build_object('isLeader', m."isLeader", 'team', private.team_json(m."teamId")) END)
    ORDER BY r."createdAt" DESC), '[]')
  FROM public."Registration" r
  JOIN public."Event" e ON e."id" = r."eventId"
  LEFT JOIN public."TeamMember" m ON m."registrationId" = r."id"
  WHERE r."studentId" = private.my_student()
$$;

CREATE FUNCTION public.register_event(p_event_id text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.my_student();
  ev public."Event";
  rid text;
BEGIN
  -- Lock the event row so two people can't both take the last spot.
  SELECT * INTO ev FROM public."Event" WHERE "id" = p_event_id FOR UPDATE;
  IF ev IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  IF NOT ev."registrationOpen" THEN RAISE EXCEPTION 'Registration for this event is closed' USING ERRCODE = 'PT400'; END IF;
  IF ev."category" = 'EXHIBITION' AND (SELECT "feePaidAt" FROM public."Student" WHERE "userId" = uid) IS NULL THEN
    RAISE EXCEPTION 'Pay the ₹199 exhibition fee first' USING ERRCODE = 'PT403';
  END IF;
  IF ev."capacity" IS NOT NULL AND (SELECT count(*) FROM public."Registration" WHERE "eventId" = ev."id") >= ev."capacity" THEN
    RAISE EXCEPTION 'This event is full' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."Registration" ("eventId", "studentId") VALUES (ev."id", uid) RETURNING "id" INTO rid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You are already registered for this event' USING ERRCODE = 'PT409';
  END;
  -- Solo events: every participant gets a team of one, so judging always scores teams.
  IF ev."teamMax" = 1 THEN
    PERFORM private.new_team(ev."id", (SELECT "name" FROM public."User" WHERE "id" = uid), NULL, NULL, rid);
  END IF;
  RETURN rid;
END $$;

-- Withdraw from an event (the fee is not refunded here). Team events: leave the team first.
CREATE FUNCTION public.withdraw_registration(p_registration_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  reg public."Registration";
  team_max int;
  tid text;
BEGIN
  SELECT * INTO reg FROM public."Registration" WHERE "id" = p_registration_id AND "studentId" = private.my_student();
  IF reg IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'PT404'; END IF;
  SELECT "teamMax" INTO team_max FROM public."Event" WHERE "id" = reg."eventId";
  SELECT "teamId" INTO tid FROM public."TeamMember" WHERE "registrationId" = reg."id";
  IF tid IS NOT NULL AND team_max > 1 THEN RAISE EXCEPTION 'Leave your team first' USING ERRCODE = 'PT409'; END IF;
  IF tid IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public."Score" WHERE "teamId" = tid) THEN RAISE EXCEPTION 'Already judged' USING ERRCODE = 'PT409'; END IF;
    DELETE FROM public."Team" WHERE "id" = tid; -- solo team of one
  END IF;
  DELETE FROM public."Registration" WHERE "id" = reg."id";
END $$;

-- ---- teams ----

-- Same rules as CreateTeamRequest in packages/shared.
CREATE FUNCTION public.create_team(p_event_id text, p_name text, p_project_title text DEFAULT NULL, p_topic text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record := private.my_registration(p_event_id);
  v_name text := trim(p_name);
  v_title text := nullif(trim(p_project_title), '');
BEGIN
  IF r.member IS NOT NULL THEN RAISE EXCEPTION 'You are already in a team for this event' USING ERRCODE = 'PT409'; END IF;
  IF (r.ev)."teamMax" = 1 THEN RAISE EXCEPTION 'This is a solo event' USING ERRCODE = 'PT400'; END IF;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Team names are 2 to 60 characters' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF length(v_title) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'Project titles are 3 to 150 characters' USING ERRCODE = 'PT400', HINT = 'projectTitle'; END IF;
  IF p_topic IS NOT NULL AND p_topic NOT IN ('Artificial Intelligence & Machine Learning', 'Robotics', 'Smart Infrastructure & Engineering',
      'Emerging Technology', 'IoT & Smart Systems', 'HealthTech & Bio-Innovation', 'Climate & Sustainability',
      'Social Innovation & Entrepreneurship', 'AgriTech & Food Innovation') THEN
    RAISE EXCEPTION 'Pick a topic from the list' USING ERRCODE = 'PT400', HINT = 'topic';
  END IF;
  IF (r.ev)."category" = 'EXHIBITION' AND (v_title IS NULL OR p_topic IS NULL) THEN
    RAISE EXCEPTION 'Project title and topic are required for the exhibition' USING ERRCODE = 'PT400';
  END IF;
  RETURN private.new_team(p_event_id, v_name, v_title, p_topic, (r.reg)."id");
END $$;

CREATE FUNCTION public.join_team(p_invite_code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public."Team";
  r record;
BEGIN
  SELECT * INTO t FROM public."Team" WHERE "inviteCode" = upper(trim(p_invite_code));
  IF t IS NULL THEN RAISE EXCEPTION 'No team with that invite code' USING ERRCODE = 'PT404'; END IF;
  r := private.my_registration(t."eventId");
  IF r.member IS NOT NULL THEN
    IF (r.member)."teamId" = t."id" THEN RETURN t."id"; END IF;
    RAISE EXCEPTION 'You are already in a team for this event. Leave it first.' USING ERRCODE = 'PT409';
  END IF;
  PERFORM private.add_member(t."id", (r.reg)."id");
  RETURN t."id";
END $$;

-- Teams that still have room, for "ask to join". Only for students registered for that event.
-- shortcut: no paging; ~500 teams is one small response. Page it if an event passes a few thousand teams.
CREATE FUNCTION public.open_teams(p_event_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record := private.my_registration(p_event_id);
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
      AND NOT EXISTS (SELECT 1 FROM public."Score" sc WHERE sc."teamId" = t."id")), '[]');
END $$;

-- Ask to join a team without its code. At most 5 waiting at a time, so one student can't ask every team.
CREATE FUNCTION public.request_join(p_team_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public."Team";
  r record;
BEGIN
  SELECT * INTO t FROM public."Team" WHERE "id" = p_team_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'PT404'; END IF;
  r := private.my_registration(t."eventId");
  IF r.member IS NOT NULL THEN RAISE EXCEPTION 'You are already in a team for this event. Leave it first.' USING ERRCODE = 'PT409'; END IF;
  IF (SELECT count(*) FROM public."TeamMember" WHERE "teamId" = t."id") >= (r.ev)."teamMax" THEN
    RAISE EXCEPTION 'This team is full' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TeamJoinRequest" WHERE "teamId" = t."id" AND "registrationId" = (r.reg)."id") THEN RETURN; END IF;
  IF (SELECT count(*) FROM public."TeamJoinRequest" WHERE "registrationId" = (r.reg)."id") >= 5 THEN
    RAISE EXCEPTION 'You can have 5 requests waiting at a time. Cancel one first.' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public."TeamJoinRequest" ("teamId", "registrationId") VALUES (t."id", (r.reg)."id") ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION public.accept_join(p_team_id text, p_registration_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_team_registration(p_team_id, true);
  IF NOT EXISTS (SELECT 1 FROM public."TeamJoinRequest" WHERE "teamId" = p_team_id AND "registrationId" = p_registration_id) THEN
    RAISE EXCEPTION 'That request is no longer waiting' USING ERRCODE = 'PT404';
  END IF;
  PERFORM private.add_member(p_team_id, p_registration_id);
END $$;

-- The leader declines, or the student takes their own request back.
CREATE FUNCTION public.drop_join_request(p_team_id text, p_registration_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE asker uuid;
BEGIN
  SELECT r."studentId" INTO asker FROM public."TeamJoinRequest" j JOIN public."Registration" r ON r."id" = j."registrationId"
  WHERE j."teamId" = p_team_id AND j."registrationId" = p_registration_id;
  IF asker IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'PT404'; END IF;
  IF asker IS DISTINCT FROM private.my_student() THEN PERFORM private.my_team_registration(p_team_id, true); END IF;
  DELETE FROM public."TeamJoinRequest" WHERE "teamId" = p_team_id AND "registrationId" = p_registration_id;
END $$;

-- If the leader leaves, the longest-standing member takes over; the last one out deletes the team.
CREATE FUNCTION public.leave_team(p_team_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  mine text := private.my_team_registration(p_team_id, false);
  was_leader boolean;
  next_reg text;
BEGIN
  IF (SELECT e."teamMax" FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId" WHERE t."id" = p_team_id) = 1 THEN
    RAISE EXCEPTION 'Solo entries have no team to leave' USING ERRCODE = 'PT400';
  END IF;
  PERFORM 1 FROM public."Team" WHERE "id" = p_team_id FOR UPDATE;
  PERFORM private.assert_not_judged(p_team_id);
  DELETE FROM public."TeamMember" WHERE "registrationId" = mine RETURNING "isLeader" INTO was_leader;
  SELECT "registrationId" INTO next_reg FROM public."TeamMember" WHERE "teamId" = p_team_id ORDER BY "joinedAt" LIMIT 1;
  IF next_reg IS NULL THEN DELETE FROM public."Team" WHERE "id" = p_team_id;
  ELSIF was_leader THEN UPDATE public."TeamMember" SET "isLeader" = true WHERE "registrationId" = next_reg;
  END IF;
END $$;

CREATE FUNCTION public.remove_member(p_team_id text, p_registration_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m public."TeamMember";
BEGIN
  PERFORM private.my_team_registration(p_team_id, true);
  SELECT * INTO m FROM public."TeamMember" WHERE "teamId" = p_team_id AND "registrationId" = p_registration_id;
  IF m IS NULL THEN RAISE EXCEPTION 'Not a member of this team' USING ERRCODE = 'PT404'; END IF;
  IF m."isLeader" THEN RAISE EXCEPTION 'Use leave to remove yourself' USING ERRCODE = 'PT400'; END IF;
  PERFORM private.assert_not_judged(p_team_id);
  DELETE FROM public."TeamMember" WHERE "registrationId" = p_registration_id;
END $$;

-- The old code stops working immediately.
CREATE FUNCTION public.new_invite_code(p_team_id text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_team_registration(p_team_id, true);
  FOR attempt IN 1..5 LOOP
    BEGIN
      UPDATE public."Team" SET "inviteCode" = private.random_code(6) WHERE "id" = p_team_id;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.my_registrations(), public.register_event(text), public.withdraw_registration(text),
  public.create_team(text, text, text, text), public.join_team(text), public.open_teams(text), public.request_join(text),
  public.accept_join(text, text), public.drop_join_request(text, text), public.leave_team(text), public.remove_member(text, text),
  public.new_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_registrations(), public.register_event(text), public.withdraw_registration(text),
  public.create_team(text, text, text, text), public.join_team(text), public.open_teams(text), public.request_join(text),
  public.accept_join(text, text), public.drop_join_request(text, text), public.leave_team(text), public.remove_member(text, text),
  public.new_invite_code(text) TO authenticated;
