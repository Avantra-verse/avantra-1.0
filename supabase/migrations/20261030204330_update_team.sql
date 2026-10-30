-- The team leader can fix the team name, project title and theme until judging starts.
-- A new theme is copied to every member's registration so everyone's dashboard shows the same one.
CREATE FUNCTION public.update_team(p_team_id text, p_name text, p_project_title text DEFAULT NULL, p_topic text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text := trim(p_name);
  v_title text := nullif(trim(p_project_title), '');
  v_exhibition boolean;
BEGIN
  PERFORM private.my_team_registration(p_team_id, true);
  PERFORM private.rate_limit('team-edit:' || private.my_student(), 20, 60);
  IF EXISTS (SELECT 1 FROM public."Score" WHERE "teamId" = p_team_id) THEN
    RAISE EXCEPTION 'The team is locked after judging starts' USING ERRCODE = 'PT409';
  END IF;
  SELECT e."category" = 'EXHIBITION' INTO v_exhibition FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId" WHERE t."id" = p_team_id;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Team names are 2 to 60 characters' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF NOT v_exhibition THEN
    UPDATE public."Team" SET "name" = v_name WHERE "id" = p_team_id;
    RETURN;
  END IF;
  IF v_title IS NULL OR length(v_title) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'Project titles are 3 to 150 characters' USING ERRCODE = 'PT400', HINT = 'projectTitle'; END IF;
  -- Same list as create_team, register_event and EXHIBITION_TOPICS in packages/shared.
  IF p_topic IS NULL OR p_topic NOT IN ('Artificial Intelligence & Machine Learning', 'Robotics', 'Smart Infrastructure & Engineering',
      'Emerging Technology', 'IoT & Smart Systems', 'HealthTech & Bio-Innovation', 'Climate & Sustainability',
      'Social Innovation & Entrepreneurship', 'AgriTech & Food Innovation') THEN
    RAISE EXCEPTION 'Pick a theme from the list' USING ERRCODE = 'PT400', HINT = 'topic';
  END IF;
  UPDATE public."Team" SET "name" = v_name, "projectTitle" = v_title, "topic" = p_topic WHERE "id" = p_team_id;
  UPDATE public."Registration" SET "topic" = p_topic
  WHERE "id" IN (SELECT "registrationId" FROM public."TeamMember" WHERE "teamId" = p_team_id);
END $$;

REVOKE ALL ON FUNCTION public.update_team(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_team(text, text, text, text) TO authenticated;
