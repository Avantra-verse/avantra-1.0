-- Ambassador codes are 3 letters of the name + 3 letters or numbers (the Google Sheet's addCodes script), e.g. GRDN6T.
-- Refuse anything else so junk like 123456 never reaches the referral counts. Same rule as ReferralCode in packages/shared.
CREATE OR REPLACE FUNCTION private.insert_student(uid uuid, profile jsonb)
 RETURNS "Student"
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_phone text := profile->>'phone';
  v_grade int;
  v_school text := trim(profile->>'schoolName');
  v_section text := nullif(upper(trim(profile->>'section')), '');
  v_ref text := nullif(upper(trim(profile->>'referralCode')), '');
  v_g_email text := nullif(lower(trim(profile->>'guardianEmail')), '');
  v_g_phone text := nullif(profile->>'guardianPhone', '');
  s public."Student";
BEGIN
  IF v_phone IS NULL OR v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING HINT = 'phone'; END IF;
  BEGIN v_grade := (profile->>'grade')::int; EXCEPTION WHEN others THEN v_grade := NULL; END;
  IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Pick your class.' USING HINT = 'grade'; END IF;
  IF v_school IS NULL OR length(v_school) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Type your school name' USING HINT = 'schoolName'; END IF;
  IF length(v_section) > 10 THEN RAISE EXCEPTION 'At most 10 characters' USING HINT = 'section'; END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Z]{3}[A-Z0-9]{3}$' THEN RAISE EXCEPTION 'That is not an ambassador code. Check it, or leave it blank.' USING HINT = 'referralCode'; END IF;
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
      RETURN s;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $function$;
