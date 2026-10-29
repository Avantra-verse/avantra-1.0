-- ₹199 exhibition fee by UPI (student side) and the ARITHI Engagement Wall (student + public side).
-- Was registrations.controller (payments/upi) and wall.controller. Admin sides come with the admin pass.

-- ---- rate limits (the old API used @nestjs/throttler) ----

CREATE TABLE private.rate_hits ("key" text NOT NULL, "at" timestamptz NOT NULL DEFAULT now());
CREATE INDEX rate_hits_key_at ON private.rate_hits ("key", "at");
REVOKE ALL ON private.rate_hits FROM PUBLIC, anon, authenticated;

-- At most p_max calls per p_seconds for this key, else 429.
-- shortcut: rows older than an hour are cleared per key on each call; add a pg_cron job if the table grows.
CREATE FUNCTION private.rate_limit(p_key text, p_max int, p_seconds int) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM private.rate_hits WHERE "key" = p_key AND "at" < now() - interval '1 hour';
  IF (SELECT count(*) FROM private.rate_hits WHERE "key" = p_key AND "at" > now() - make_interval(secs => p_seconds)) >= p_max THEN
    RAISE EXCEPTION 'Too many attempts. Try again in a minute.' USING ERRCODE = 'PT429';
  END IF;
  INSERT INTO private.rate_hits ("key") VALUES (p_key);
END $$;

-- ---- fee by UPI: the student pays the school's QR and sends the 12-digit UTR; the school checks it (admin Excel) ----

CREATE FUNCTION public.submit_upi_payment(p_utr text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.my_student();
  v_utr text := regexp_replace(coalesce(p_utr, ''), '\s', '', 'g');
  p public."Payment";
BEGIN
  PERFORM private.rate_limit('upi:' || uid, 10, 60);
  IF v_utr !~ '^[0-9]{12}$' THEN
    RAISE EXCEPTION 'The UTR is the 12-digit number in your UPI app''s payment details' USING ERRCODE = 'PT400', HINT = 'utr';
  END IF;
  PERFORM 1 FROM public."Student" WHERE "userId" = uid FOR UPDATE; -- one at a time per student
  IF (SELECT "feePaidAt" FROM public."Student" WHERE "userId" = uid) IS NOT NULL THEN
    RAISE EXCEPTION 'Exhibition fee already paid' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Payment" WHERE "studentId" = uid AND "method" = 'UPI' AND "status" = 'CREATED') THEN
    RAISE EXCEPTION 'Your payment is already being checked' USING ERRCODE = 'PT409';
  END IF;
  -- A UTR pays once; one the school marked Not paid may be sent again. The partial unique index catches two at once.
  BEGIN
    INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "utr") VALUES (uid, 19900, 'UPI', v_utr) RETURNING * INTO p;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This UTR has already been sent. Check the number in your UPI app.' USING ERRCODE = 'PT409', HINT = 'utr';
  END;
  RETURN jsonb_build_object('method', p."method", 'status', p."status", 'utr', p."utr", 'createdAt', p."createdAt");
END $$;

-- ---- Engagement Wall ----

CREATE FUNCTION private.setting(p_key text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT "value" FROM public."Setting" WHERE "key" = p_key
$$;
CREATE FUNCTION private.wall_open() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.setting('wall.open') = 'true', false)
$$;
-- Set = the public board and everyone's ranks stay as at this moment (final-hour suspense). Points still count.
CREATE FUNCTION private.wall_frozen_at() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.setting('wall.frozenAt')::timestamptz
$$;

-- Students type their school, so a school is everyone whose typed name matches ignoring case and spacing.
CREATE FUNCTION private.school_key(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT lower(regexp_replace(trim(p_name), '[[:space:]]+', ' ', 'g'))
$$;

-- Same as normalizeAnswer in packages/shared: case, spacing, a trailing full stop and number formatting don't matter.
CREATE FUNCTION private.normalize_answer(p text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  t text := regexp_replace(trim(regexp_replace(lower(normalize(p, NFKC)), '\s+', ' ', 'g')), '[.!]+$', '');
  n text := replace(t, ',', '');
BEGIN
  RETURN CASE WHEN n ~ '^-?\d+(\.\d+)?$' THEN trim_scale(n::numeric)::text ELSE t END;
END $$;

-- Public boards show "Aarav S.", never full names of minors.
CREATE FUNCTION private.public_name(p_name text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN cardinality(w) > 1 THEN w[1] || ' ' || upper(left(w[cardinality(w)], 1)) || '.' ELSE w[1] END
  FROM regexp_split_to_array(trim(p_name), '\s+') w
$$;

-- Everyone with points as at p_as_of (null = now), best first: points, then more solved, then whoever got there first.
-- Disabled accounts don't rank.
CREATE FUNCTION private.wall_players(p_as_of timestamptz)
RETURNS TABLE ("studentId" uuid, "name" text, "grade" int, "section" text, "avantraId" text, "schoolKey" text, "school" text,
  "points" int, "solved" int, "lastSolvedAt" timestamptz, "rank" bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s."userId", u."name", s."grade", s."section", s."avantraId", private.school_key(s."schoolName"), s."schoolName",
    sum(c."points")::int, count(*)::int, max(w."solvedAt"),
    row_number() OVER (ORDER BY sum(c."points") DESC, count(*) DESC, max(w."solvedAt"))
  FROM public."WallSolve" w
  JOIN public."WallChallenge" c ON c."id" = w."challengeId"
  JOIN public."Student" s ON s."userId" = w."studentId"
  JOIN public."User" u ON u."id" = s."userId"
  WHERE u."disabledAt" IS NULL AND w."solvedAt" <= coalesce(p_as_of, 'infinity')
  GROUP BY s."userId", u."name"
$$;

CREATE FUNCTION private.wall_schools(p_as_of timestamptz)
RETURNS TABLE ("schoolKey" text, "name" text, "points" int, "solved" int, "players" int, "rank" bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p."schoolKey", (array_agg(p."school" ORDER BY p."rank"))[1], sum(p."points")::int, sum(p."solved")::int, count(*)::int,
    row_number() OVER (ORDER BY sum(p."points") DESC, sum(p."solved") DESC, max(p."lastSolvedAt"))
  FROM private.wall_players(p_as_of) p
  GROUP BY p."schoolKey"
$$;

-- A student's own points, always live. While frozen, ranks (theirs and their school's) are as at the freeze.
CREATE FUNCTION private.wall_standing(p_student uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  frozen timestamptz := private.wall_frozen_at();
  my_points int;
  my_solved int;
  my_last timestamptz;
  my_rank bigint;
  total bigint;
  sch jsonb;
BEGIN
  SELECT coalesce(sum(c."points"), 0)::int, count(*)::int, max(w."solvedAt") INTO my_points, my_solved, my_last
  FROM public."WallSolve" w JOIN public."WallChallenge" c ON c."id" = w."challengeId" WHERE w."studentId" = p_student;
  SELECT count(*) INTO total FROM private.wall_players(frozen);
  IF frozen IS NOT NULL THEN
    SELECT p."rank" INTO my_rank FROM private.wall_players(frozen) p WHERE p."studentId" = p_student;
  ELSIF my_solved > 0 THEN
    SELECT count(*) + 1 INTO my_rank FROM private.wall_players(NULL) p
    WHERE p."studentId" <> p_student
      AND (p."points" > my_points OR (p."points" = my_points AND (p."solved" > my_solved OR (p."solved" = my_solved AND p."lastSolvedAt" < my_last))));
  END IF;
  SELECT jsonb_build_object('name', x."name", 'rank', x."rank", 'points', x."points") INTO sch
  FROM private.wall_schools(frozen) x JOIN public."Student" s ON private.school_key(s."schoolName") = x."schoolKey"
  WHERE s."userId" = p_student;
  RETURN jsonb_build_object('points', my_points, 'solved', my_solved, 'rank', my_rank, 'players', total, 'school', sch, 'frozenAt', frozen);
END $$;

-- What a student sees of a chit (never the answers) and how they're doing on it. 1 try for multiple choice, 3 for typed.
CREATE FUNCTION private.wall_progress(c public."WallChallenge", p_student uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH a AS (
    SELECT bool_or("correct") AS solved, count(*) FILTER (WHERE NOT "correct") AS wrong
    FROM public."WallAttempt" WHERE "challengeId" = c."id" AND "studentId" = p_student
  ), m AS (SELECT CASE WHEN cardinality(c."options") > 0 THEN 1 ELSE 3 END AS max)
  SELECT jsonb_build_object(
    'number', c."number", 'category', c."category", 'difficulty', c."difficulty", 'points', c."points", 'question', c."question",
    'options', coalesce(c."options", '{}'),
    'status', CASE WHEN a.solved THEN 'SOLVED' WHEN a.wrong >= m.max THEN 'LOCKED' ELSE 'OPEN' END,
    'attemptsLeft', CASE WHEN a.solved OR a.wrong >= m.max THEN 0 ELSE m.max - a.wrong END)
  FROM a, m
$$;

-- The chit a student typed or scanned. Rate limited per student so codes can't be guessed.
CREATE FUNCTION private.wall_playable(p_code text, OUT c public."WallChallenge", OUT uid uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  uid := private.my_student();
  PERFORM private.rate_limit('wall:' || uid, 30, 60);
  IF NOT private.wall_open() THEN RAISE EXCEPTION 'The Engagement Wall is closed right now' USING ERRCODE = 'PT403'; END IF;
  SELECT * INTO c FROM public."WallChallenge" WHERE "code" = upper(trim(p_code));
  IF c IS NULL THEN RAISE EXCEPTION 'No challenge with this code. Check the chit and try again' USING ERRCODE = 'PT404'; END IF;
  IF NOT c."active" THEN RAISE EXCEPTION 'This chit is no longer active: find another one' USING ERRCODE = 'PT410'; END IF;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.my_role() TO anon, authenticated; -- used inside RLS policies

CREATE FUNCTION public.wall_challenge(p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record := private.wall_playable(p_code);
BEGIN
  RETURN private.wall_progress(r.c, r.uid);
END $$;

CREATE FUNCTION public.wall_answer(p_code text, p_answer text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r record := private.wall_playable(p_code);
  v_answer text := trim(p_answer);
  correct boolean;
  before jsonb;
BEGIN
  IF v_answer IS NULL OR length(v_answer) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Type an answer' USING ERRCODE = 'PT400', HINT = 'answer'; END IF;
  -- Lock the student so two quick taps can't get an extra try or score twice.
  PERFORM 1 FROM public."Student" WHERE "userId" = r.uid FOR UPDATE;
  before := private.wall_progress(r.c, r.uid);
  IF before->>'status' = 'SOLVED' THEN RAISE EXCEPTION 'You already solved this one: find another chit' USING ERRCODE = 'PT409'; END IF;
  IF before->>'status' = 'LOCKED' THEN RAISE EXCEPTION 'No tries left on this challenge' USING ERRCODE = 'PT409'; END IF;
  correct := EXISTS (SELECT 1 FROM unnest((r.c)."answers") a WHERE private.normalize_answer(a) = private.normalize_answer(v_answer));
  INSERT INTO public."WallAttempt" ("challengeId", "studentId", "answer", "correct") VALUES ((r.c)."id", r.uid, v_answer, correct);
  IF correct THEN INSERT INTO public."WallSolve" ("challengeId", "studentId") VALUES ((r.c)."id", r.uid); END IF;
  RETURN jsonb_build_object('correct', correct, 'pointsEarned', CASE WHEN correct THEN (r.c)."points" ELSE 0 END)
    || (private.wall_progress(r.c, r.uid) - ARRAY['number', 'category', 'difficulty', 'points', 'question', 'options'])
    || jsonb_build_object('me', private.wall_standing(r.uid));
END $$;

-- My score, ranks and solved chits: the achievement screen and the share card.
CREATE FUNCTION public.wall_me() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('open', private.wall_open()) || private.wall_standing(uid) || jsonb_build_object('solves', coalesce((
    SELECT jsonb_agg(jsonb_build_object('number', c."number", 'category', c."category", 'difficulty', c."difficulty", 'points', c."points",
      'solvedAt', w."solvedAt") ORDER BY w."solvedAt" DESC)
    FROM public."WallSolve" w JOIN public."WallChallenge" c ON c."id" = w."challengeId" WHERE w."studentId" = uid), '[]'))
  FROM private.my_student() uid
$$;

-- The big screen and /wall/leaderboard. Public. The web serves it through a CDN-cached route, so phones don't each hit the database.
CREATE FUNCTION public.wall_leaderboard() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'open', private.wall_open(),
    'frozenAt', f,
    'players', coalesce((SELECT jsonb_agg(jsonb_build_object('rank', p."rank", 'name', private.public_name(p."name"), 'grade', p."grade",
        'school', p."school", 'points', p."points", 'solved', p."solved") ORDER BY p."rank")
      FROM private.wall_players(f) p WHERE p."rank" <= 50), '[]'),
    'schools', coalesce((SELECT jsonb_agg(jsonb_build_object('rank', s."rank", 'name', s."name", 'points', s."points", 'solved', s."solved",
        'players', s."players") ORDER BY s."rank")
      FROM private.wall_schools(f) s), '[]'))
  FROM private.wall_frozen_at() f
$$;

REVOKE ALL ON FUNCTION public.submit_upi_payment(text), public.wall_challenge(text), public.wall_answer(text, text), public.wall_me(),
  public.wall_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_upi_payment(text), public.wall_challenge(text), public.wall_answer(text, text), public.wall_me()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.wall_leaderboard() TO anon, authenticated;
