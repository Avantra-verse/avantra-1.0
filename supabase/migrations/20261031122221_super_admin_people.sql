-- Super admin: look up any account (student, volunteer, judge, admin), fix its details, or delete it for good.
-- Email stays as is: it's the Auth login, so changing it here would split the two.

CREATE FUNCTION public.admin_people() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_super_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', u."id", 'name', u."name", 'email', u."email", 'phone', u."phone",
      'role', u."role", 'superAdmin', u."superAdmin", 'disabledAt', u."disabledAt", 'avantraId', s."avantraId",
      'schoolName', s."schoolName", 'feePaid', s."feePaidAt" IS NOT NULL) ORDER BY u."createdAt" DESC)
    FROM public."User" u LEFT JOIN public."Student" s ON s."userId" = u."id"), '[]');
END $$;

-- Everything about one account. The badge's qrToken stays in the database.
CREATE FUNCTION public.admin_person(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE res jsonb;
BEGIN
  PERFORM private.my_super_admin();
  SELECT jsonb_build_object(
    'user', to_jsonb(u) || jsonb_build_object('assignedEvent', (SELECT e."name" FROM public."Event" e WHERE e."id" = u."assignedEventId")),
    'student', (SELECT to_jsonb(s) - 'qrToken' FROM public."Student" s WHERE s."userId" = u."id"),
    'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('method', p."method", 'status', p."status", 'amountPaise', p."amountPaise",
        'utr', p."utr", 'note', p."note", 'createdAt', p."createdAt") ORDER BY p."createdAt" DESC)
      FROM public."Payment" p WHERE p."studentId" = u."id"), '[]'),
    'registrations', coalesce((SELECT jsonb_agg(jsonb_build_object('event', e."name", 'team', t."name", 'isLeader', m."isLeader",
        'certificateCode', r."certificateCode") ORDER BY r."createdAt")
      FROM public."Registration" r JOIN public."Event" e ON e."id" = r."eventId"
      LEFT JOIN public."TeamMember" m ON m."registrationId" = r."id" LEFT JOIN public."Team" t ON t."id" = m."teamId"
      WHERE r."studentId" = u."id"), '[]'),
    'checkIns', (SELECT count(*) FROM public."CheckIn" c WHERE c."studentId" = u."id"),
    'scansDone', (SELECT count(*) FROM public."CheckIn" c WHERE c."scannedById" = u."id"),
    'scoresGiven', (SELECT count(*) FROM public."Score" x WHERE x."judgeId" = u."id"))
  INTO res FROM public."User" u WHERE u."id" = p_user_id;
  IF res IS NULL THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404'; END IF;
  RETURN res;
END $$;

-- Same rules as update_student_profile, except the super admin may also change a referral code that's already set.
CREATE FUNCTION public.admin_update_person(p_user_id uuid, p jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  is_student boolean;
  v_name text := trim(p->>'name');
  v_phone text := nullif(trim(p->>'phone'), '');
  v_grade int;
  v_school text := trim(p->>'schoolName');
  v_section text := nullif(upper(trim(p->>'section')), '');
  v_ref text := nullif(upper(trim(p->>'referralCode')), '');
  v_g_email text := nullif(lower(trim(p->>'guardianEmail')), '');
  v_g_phone text := nullif(trim(p->>'guardianPhone'), '');
BEGIN
  PERFORM private.my_super_admin();
  SELECT EXISTS (SELECT 1 FROM public."Student" WHERE "userId" = p_user_id) INTO is_student;
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE "id" = p_user_id) THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404'; END IF;
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Type the full name' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF (is_student AND v_phone IS NULL) OR v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING ERRCODE = 'PT400', HINT = 'phone'; END IF;
  UPDATE public."User" SET "name" = v_name, "phone" = v_phone WHERE "id" = p_user_id;
  IF NOT is_student THEN RETURN; END IF;

  BEGIN v_grade := (p->>'grade')::int; EXCEPTION WHEN others THEN v_grade := NULL; END;
  IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Pick a class.' USING ERRCODE = 'PT400', HINT = 'grade'; END IF;
  IF v_school IS NULL OR length(v_school) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Type the school name' USING ERRCODE = 'PT400', HINT = 'schoolName'; END IF;
  IF length(v_section) > 10 THEN RAISE EXCEPTION 'At most 10 characters' USING ERRCODE = 'PT400', HINT = 'section'; END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Z]{3}[A-Z0-9]{3}$' THEN RAISE EXCEPTION 'That is not an ambassador code' USING ERRCODE = 'PT400', HINT = 'referralCode'; END IF;
  IF v_g_email IS NOT NULL AND (length(v_g_email) > 254 OR v_g_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Enter a valid email' USING ERRCODE = 'PT400', HINT = 'guardianEmail'; END IF;
  IF v_g_phone IS NOT NULL AND v_g_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING ERRCODE = 'PT400', HINT = 'guardianPhone'; END IF;
  UPDATE public."Student" SET "grade" = v_grade, "section" = v_section, "schoolName" = v_school, "referralCode" = v_ref,
    "guardianEmail" = v_g_email, "guardianPhone" = v_g_phone WHERE "userId" = p_user_id;
END $$;

-- Deletes the account and everything that hangs off it, in one go (all or nothing). Never a super admin.
-- Staff who scanned badges or scored teams are refused: that history must stay, so switch them off instead.
-- A student's teams: the next member becomes leader (like leave_team); a team left empty goes too, unless it was scored.
CREATE FUNCTION public.admin_delete_person(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE m record; next_reg text;
BEGIN
  PERFORM private.my_super_admin();
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE "id" = p_user_id AND NOT "superAdmin") THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404';
  END IF;
  IF EXISTS (SELECT 1 FROM public."CheckIn" WHERE "scannedById" = p_user_id) OR EXISTS (SELECT 1 FROM public."Score" WHERE "judgeId" = p_user_id) THEN
    RAISE EXCEPTION 'This account has scanned badges or scored teams, which must be kept. Switch it off instead.' USING ERRCODE = 'PT409';
  END IF;
  FOR m IN SELECT tm.* FROM public."TeamMember" tm JOIN public."Registration" r ON r."id" = tm."registrationId" WHERE r."studentId" = p_user_id LOOP
    PERFORM 1 FROM public."Team" WHERE "id" = m."teamId" FOR UPDATE;
    DELETE FROM public."TeamMember" WHERE "registrationId" = m."registrationId";
    SELECT "registrationId" INTO next_reg FROM public."TeamMember" WHERE "teamId" = m."teamId" ORDER BY "joinedAt" LIMIT 1;
    IF next_reg IS NULL THEN
      IF EXISTS (SELECT 1 FROM public."Score" WHERE "teamId" = m."teamId") THEN
        RAISE EXCEPTION 'This student''s team has been scored and has no one else. Switch the account off instead.' USING ERRCODE = 'PT409';
      END IF;
      DELETE FROM public."Team" WHERE "id" = m."teamId";
    ELSIF m."isLeader" THEN
      UPDATE public."TeamMember" SET "isLeader" = true WHERE "registrationId" = next_reg;
    END IF;
  END LOOP;
  DELETE FROM public."Registration" WHERE "studentId" = p_user_id;
  DELETE FROM public."CheckIn" WHERE "studentId" = p_user_id;
  -- Cascades to User, Student, Payment, Wall attempts and solves, sessions and identities.
  DELETE FROM auth.users WHERE "id" = p_user_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_people(), public.admin_person(uuid), public.admin_update_person(uuid, jsonb), public.admin_delete_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_people(), public.admin_person(uuid), public.admin_update_person(uuid, jsonb), public.admin_delete_person(uuid) TO authenticated;
