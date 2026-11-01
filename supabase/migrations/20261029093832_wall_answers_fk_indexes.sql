-- Edit a challenge's accepted answers. Earlier wrong tries that now match count as correct,
-- so students who typed the new answer get their points (solved at their first matching try).
CREATE FUNCTION public.admin_wall_set_answers(p_challenge_id text, p_answers text[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  c public."WallChallenge";
  answers text[] := ARRAY(SELECT trim(a) FROM unnest(p_answers) a WHERE trim(a) <> '');
  regraded int;
BEGIN
  PERFORM private.my_admin();
  IF cardinality(answers) NOT BETWEEN 1 AND 20 OR EXISTS (SELECT 1 FROM unnest(answers) a WHERE length(a) > 200) THEN
    RAISE EXCEPTION 'Give 1 to 20 answers, each up to 200 characters' USING ERRCODE = 'PT400';
  END IF;
  SELECT * INTO c FROM public."WallChallenge" WHERE "id" = p_challenge_id FOR UPDATE;
  IF c IS NULL THEN RAISE EXCEPTION 'Challenge not found' USING ERRCODE = 'PT404'; END IF;
  IF cardinality(c."options") > 0 AND EXISTS (
    SELECT 1 FROM unnest(answers) a
    WHERE NOT EXISTS (SELECT 1 FROM unnest(c."options") o WHERE private.normalize_answer(o) = private.normalize_answer(a))
  ) THEN
    RAISE EXCEPTION 'Multiple choice needs 2+ options, and each answer must be one of them' USING ERRCODE = 'PT400';
  END IF;

  UPDATE public."WallChallenge" SET "answers" = answers WHERE "id" = c."id" RETURNING * INTO c;

  WITH now_right AS (
    UPDATE public."WallAttempt" t SET "correct" = true
    WHERE t."challengeId" = c."id" AND NOT t."correct"
      AND EXISTS (SELECT 1 FROM unnest(answers) a WHERE private.normalize_answer(a) = private.normalize_answer(t."answer"))
    RETURNING t."studentId", t."createdAt"
  ), solved AS (
    INSERT INTO public."WallSolve" ("challengeId", "studentId", "solvedAt")
    SELECT c."id", "studentId", min("createdAt") FROM now_right GROUP BY "studentId"
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO regraded FROM solved;

  RETURN jsonb_build_object('challenge', to_jsonb(c), 'regraded', regraded);
END $$;

REVOKE ALL ON FUNCTION public.admin_wall_set_answers(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_wall_set_answers(text, text[]) TO authenticated;

-- Performance advisor: foreign keys without a covering index.
CREATE INDEX "CheckIn_scannedById_idx" ON public."CheckIn"("scannedById");
CREATE INDEX "Score_judgeId_idx" ON public."Score"("judgeId");
CREATE INDEX "User_assignedEventId_idx" ON public."User"("assignedEventId");
CREATE INDEX "WallAttempt_studentId_idx" ON public."WallAttempt"("studentId");
