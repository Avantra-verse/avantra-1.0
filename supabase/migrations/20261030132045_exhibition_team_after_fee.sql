-- Exhibition teams open only after the ₹299 fee is paid: no creating, joining, asking or being accepted before.
-- new_team covers create_team (register_event only makes solo teams, never exhibition ones); add_member covers
-- join_team and accept_join (it checks the joiner, not the leader); request_join checks the asker.

CREATE OR REPLACE FUNCTION private.assert_team_fee(p_event_id text, p_registration_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT "category" FROM public."Event" WHERE "id" = p_event_id) = 'EXHIBITION'
     AND (SELECT s."feePaidAt" FROM public."Registration" r JOIN public."Student" s ON s."userId" = r."studentId" WHERE r."id" = p_registration_id) IS NULL THEN
    RAISE EXCEPTION 'Exhibition teams open once the ₹299 fee is paid' USING ERRCODE = 'PT403';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.assert_team_fee(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.new_team(p_event_id text, p_name text, p_project_title text, p_topic text, p_registration_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE tid text;
BEGIN
  PERFORM private.assert_team_fee(p_event_id, p_registration_id);
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

CREATE OR REPLACE FUNCTION private.add_member(p_team_id text, p_registration_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE team_max int; ev_id text;
BEGIN
  SELECT e."teamMax", e."id" INTO team_max, ev_id FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId" WHERE t."id" = p_team_id FOR UPDATE OF t;
  PERFORM private.assert_not_judged(p_team_id);
  PERFORM private.assert_team_fee(ev_id, p_registration_id);
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
END $$;

CREATE OR REPLACE FUNCTION public.request_join(p_team_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  t public."Team";
  r record;
BEGIN
  SELECT * INTO t FROM public."Team" WHERE "id" = p_team_id;
  IF t IS NULL THEN RAISE EXCEPTION 'Not found' USING ERRCODE = 'PT404'; END IF;
  r := private.my_registration(t."eventId");
  IF r.member IS NOT NULL THEN RAISE EXCEPTION 'You are already in a team for this event. Leave it first.' USING ERRCODE = 'PT409'; END IF;
  PERFORM private.assert_team_fee(t."eventId", (r.reg)."id");
  IF (SELECT count(*) FROM public."TeamMember" WHERE "teamId" = t."id") >= (r.ev)."teamMax" THEN
    RAISE EXCEPTION 'This team is full' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public."TeamJoinRequest" WHERE "teamId" = t."id" AND "registrationId" = (r.reg)."id") THEN RETURN; END IF;
  IF (SELECT count(*) FROM public."TeamJoinRequest" WHERE "registrationId" = (r.reg)."id") >= 5 THEN
    RAISE EXCEPTION 'You can have 5 requests waiting at a time. Cancel one first.' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public."TeamJoinRequest" ("teamId", "registrationId") VALUES (t."id", (r.reg)."id") ON CONFLICT DO NOTHING;
END $$;
