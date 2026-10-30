-- Dashboard settings: a student edits their own name and profile details (same checks as sign-up).
-- Email, AVANTRA ID, QR, referral code and fee status are not editable here.
CREATE FUNCTION public.update_student_profile(profile jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := private.my_student();
  v_name text := trim(profile->>'name');
  v_phone text := profile->>'phone';
  v_grade int;
  v_school text := trim(profile->>'schoolName');
  v_section text := nullif(upper(trim(profile->>'section')), '');
  v_g_email text := nullif(lower(trim(profile->>'guardianEmail')), '');
  v_g_phone text := nullif(profile->>'guardianPhone', '');
BEGIN
  PERFORM private.rate_limit('profile:' || uid, 20, 60);
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Type your full name' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF v_phone IS NULL OR v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING ERRCODE = 'PT400', HINT = 'phone'; END IF;
  BEGIN v_grade := (profile->>'grade')::int; EXCEPTION WHEN others THEN v_grade := NULL; END;
  IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Pick your class.' USING ERRCODE = 'PT400', HINT = 'grade'; END IF;
  IF v_school IS NULL OR length(v_school) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Type your school name' USING ERRCODE = 'PT400', HINT = 'schoolName'; END IF;
  IF length(v_section) > 10 THEN RAISE EXCEPTION 'At most 10 characters' USING ERRCODE = 'PT400', HINT = 'section'; END IF;
  IF v_g_email IS NOT NULL AND (length(v_g_email) > 254 OR v_g_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Enter a valid email' USING ERRCODE = 'PT400', HINT = 'guardianEmail'; END IF;
  IF v_g_phone IS NOT NULL AND v_g_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING ERRCODE = 'PT400', HINT = 'guardianPhone'; END IF;

  UPDATE public."User" SET "name" = v_name, "phone" = v_phone WHERE "id" = uid;
  UPDATE public."Student" SET "grade" = v_grade, "section" = v_section, "schoolName" = v_school,
    "guardianEmail" = v_g_email, "guardianPhone" = v_g_phone
  WHERE "userId" = uid;
END $$;

REVOKE ALL ON FUNCTION public.update_student_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_student_profile(jsonb) TO authenticated;
