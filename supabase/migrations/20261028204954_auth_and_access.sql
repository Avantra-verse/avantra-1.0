-- Supabase Auth + who can read and write what.
-- Reads: supabase-js under RLS (own rows only). Writes: SECURITY DEFINER functions only; direct table writes are revoked.
-- Roles live in "User".role, never in user metadata (users can edit their own metadata).

-- ---- every auth user has a "User" row ----

ALTER TABLE "User" ADD CONSTRAINT "User_auth_fkey" FOREIGN KEY ("id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Helpers for policies and functions. Not exposed over the Data API (only public is).
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

-- Role from app_metadata, which only the service role can set (staff/admin accounts made by an admin). Everyone else is a STUDENT.
-- shortcut: email changes in Auth aren't copied to "User".email; add an update trigger if email change is ever allowed.
CREATE FUNCTION private.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public."User" ("id", "email", "name", "role")
  VALUES (
    NEW.id,
    lower(NEW.email),
    left(coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)), 100),
    coalesce((NEW.raw_app_meta_data->>'role')::public."Role", 'STUDENT')
  );
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

-- The caller's role, or null when logged out, switched off by an admin, or past the staff expiry.
CREATE FUNCTION private.my_role() RETURNS public."Role" LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT "role" FROM public."User"
  WHERE "id" = (SELECT auth.uid()) AND "disabledAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt" > now())
$$;
REVOKE ALL ON FUNCTION private.my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.my_role() TO anon, authenticated;

-- ---- table access ----

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;
-- Functions are callable by nobody unless granted below.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

CREATE POLICY "events are public" ON "Event" FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "own user row, admins all" ON "User" FOR SELECT TO authenticated
  USING ("id" = (SELECT auth.uid()) OR (SELECT private.my_role()) = 'ADMIN');
CREATE POLICY "own student row, admins all" ON "Student" FOR SELECT TO authenticated
  USING ("userId" = (SELECT auth.uid()) OR (SELECT private.my_role()) = 'ADMIN');
CREATE POLICY "own payments, admins all" ON "Payment" FOR SELECT TO authenticated
  USING ("studentId" = (SELECT auth.uid()) OR (SELECT private.my_role()) = 'ADMIN');
CREATE POLICY "own check-ins, admins all" ON "CheckIn" FOR SELECT TO authenticated
  USING ("studentId" = (SELECT auth.uid()) OR (SELECT private.my_role()) = 'ADMIN');
CREATE POLICY "own registrations, admins all" ON "Registration" FOR SELECT TO authenticated
  USING ("studentId" = (SELECT auth.uid()) OR (SELECT private.my_role()) = 'ADMIN');
-- Every other table: RLS on, no policy = no access until its pass adds one. WallChallenge must never expose "answers".

-- ---- functions ----

-- Events with spots left. Definer: counts every registration, returns only the count.
CREATE FUNCTION public.events_list() RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT to_jsonb(e) || jsonb_build_object('spotsLeft',
    CASE WHEN e."capacity" IS NULL THEN NULL
    ELSE greatest(0, e."capacity" - (SELECT count(*) FROM public."Registration" r WHERE r."eventId" = e."id")) END)
  FROM public."Event" e
  ORDER BY e."category", e."name"
$$;
REVOKE ALL ON FUNCTION public.events_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.events_list() TO anon, authenticated;

-- 6-character codes without 0/O/1/I, so they can be read aloud.
CREATE FUNCTION private.random_code(len int) RETURNS text LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + (get_byte(b, i) % 32), 1), '')
  FROM extensions.gen_random_bytes(len) b, generate_series(0, len - 1) i
$$;
REVOKE ALL ON FUNCTION private.random_code(int) FROM PUBLIC;

-- Profile step after sign-up. Same rules as StudentProfile in packages/shared; errors carry the field name in HINT.
CREATE FUNCTION public.create_student_profile(profile jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  v_phone text := profile->>'phone';
  v_grade int;
  v_school text := trim(profile->>'schoolName');
  v_section text := nullif(upper(trim(profile->>'section')), '');
  v_ref text := nullif(upper(trim(profile->>'referralCode')), '');
  v_g_email text := nullif(lower(trim(profile->>'guardianEmail')), '');
  v_g_phone text := nullif(profile->>'guardianPhone', '');
  s public."Student";
BEGIN
  IF private.my_role() IS DISTINCT FROM 'STUDENT' THEN RAISE EXCEPTION 'Log in as a student first' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public."Student" WHERE "userId" = uid) THEN RAISE EXCEPTION 'Profile already exists' USING ERRCODE = '23505'; END IF;
  IF v_phone IS NULL OR v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING HINT = 'phone'; END IF;
  BEGIN v_grade := (profile->>'grade')::int; EXCEPTION WHEN others THEN v_grade := NULL; END;
  IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Pick your class.' USING HINT = 'grade'; END IF;
  IF v_school IS NULL OR length(v_school) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Type your school name' USING HINT = 'schoolName'; END IF;
  IF length(v_section) > 10 THEN RAISE EXCEPTION 'At most 10 characters' USING HINT = 'section'; END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'Ambassador codes are 6 letters and numbers' USING HINT = 'referralCode'; END IF;
  IF v_g_email IS NOT NULL AND (length(v_g_email) > 254 OR v_g_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Enter a valid email' USING HINT = 'guardianEmail'; END IF;
  IF v_g_phone IS NOT NULL AND v_g_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING HINT = 'guardianPhone'; END IF;
  IF (profile->'guardianConsent') IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'A parent or guardian must agree before you can take part.' USING HINT = 'consent'; END IF;

  UPDATE public."User" SET "phone" = v_phone WHERE "id" = uid;
  FOR attempt IN 1..5 LOOP -- retry when a random ID clashes
    BEGIN
      INSERT INTO public."Student" ("userId", "schoolName", "referralCode", "grade", "section", "guardianEmail", "guardianPhone",
        "guardianConsentAt", "avantraId", "qrToken")
      VALUES (uid, v_school, v_ref, v_grade, v_section, v_g_email, v_g_phone, now(), 'AV26-' || private.random_code(5),
        translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_'))
      RETURNING * INTO s;
      RETURN to_jsonb(s);
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.create_student_profile(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_student_profile(jsonb) TO authenticated;
