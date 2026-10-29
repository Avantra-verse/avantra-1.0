-- A team below its event's minimum size (3 for the Science Exhibition) cannot be judged.
CREATE OR REPLACE FUNCTION public.judge_submit_scores(p_team_id text, p_scores jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public."Event" := private.judge_event();
  s jsonb;
  unknown text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Team" WHERE "id" = p_team_id AND "eventId" = e."id") THEN
    RAISE EXCEPTION 'Team not in your event' USING ERRCODE = 'PT404';
  END IF;
  IF (SELECT count(*) FROM public."TeamMember" WHERE "teamId" = p_team_id) < e."teamMin" THEN
    RAISE EXCEPTION 'This team needs % members before it can be judged', e."teamMin" USING ERRCODE = 'PT409';
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
