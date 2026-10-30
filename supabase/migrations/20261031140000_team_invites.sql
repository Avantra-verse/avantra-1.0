-- Team invite links for students who haven't registered or paid yet: the page remembers the code, shows the
-- team's theme instead of the theme picker (team_preview), and joins them once the fee is paid.

-- Name, theme and event of the team behind an invite code, for an invited student. Rate limited so codes can't be guessed.
CREATE FUNCTION public.team_preview(p_invite_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.my_student();
  t public."Team";
BEGIN
  PERFORM private.rate_limit('team-preview:' || uid, 30, 60);
  SELECT * INTO t FROM public."Team" WHERE "inviteCode" = upper(trim(p_invite_code));
  IF t IS NULL THEN RAISE EXCEPTION 'No team with that invite code' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object('name', t."name", 'topic', t."topic", 'eventId', t."eventId");
END $$;

REVOKE ALL ON FUNCTION public.team_preview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_preview(text) TO authenticated;

-- Joining a team (by code, link or an accepted request) takes the team's theme, so a team never mixes themes.
CREATE OR REPLACE FUNCTION private.add_member(p_team_id text, p_registration_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  UPDATE public."Registration" r SET "topic" = t."topic" FROM public."Team" t
  WHERE r."id" = p_registration_id AND t."id" = p_team_id AND t."topic" IS NOT NULL;
END $function$;
