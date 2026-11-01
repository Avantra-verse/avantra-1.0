-- Super admin can switch a student's fee between paid and not paid from People → Edit.
-- Paid: confirms their waiting UPI payment if there is one (so the school's sheet can't double it), else records
-- one as "set by super admin"; sends the usual fee email. Not paid: clears feePaidAt and marks their PAID
-- payments REFUNDED, so the totals drop. Team places are kept.
CREATE OR REPLACE FUNCTION private.set_fee(p_student uuid, p_paid boolean, p_admin uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public."Student"; pay public."Payment";
BEGIN
  SELECT * INTO s FROM public."Student" WHERE "userId" = p_student FOR UPDATE;
  IF s IS NULL OR (s."feePaidAt" IS NOT NULL) = p_paid THEN RETURN; END IF;
  IF p_paid THEN
    SELECT * INTO pay FROM public."Payment" WHERE "studentId" = p_student AND "method" = 'UPI' AND "status" = 'CREATED'
    ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE;
    IF pay IS NOT NULL THEN
      UPDATE public."Payment" SET "status" = 'PAID', "recordedById" = p_admin, "updatedAt" = now() WHERE "id" = pay."id";
    ELSE
      INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
      VALUES (p_student, 29900, 'OFFLINE', 'PAID', p_admin, 'set paid by super admin') RETURNING * INTO pay;
    END IF;
    UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = p_student;
    PERFORM private.fee_confirmed_mail(p_student, pay."amountPaise", coalesce('UPI ' || pay."utr", 'set by the organisers'));
  ELSE
    UPDATE public."Payment" SET "status" = 'REFUNDED', "recordedById" = p_admin, "updatedAt" = now(),
      "note" = concat_ws(' · ', "note", 'set not paid by super admin') WHERE "studentId" = p_student AND "status" = 'PAID';
    UPDATE public."Student" SET "feePaidAt" = NULL WHERE "userId" = p_student;
  END IF;
END $function$;
REVOKE ALL ON FUNCTION private.set_fee(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_person(p_user_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  me uuid := private.my_super_admin();
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
  IF p ? 'feePaid' AND p->>'feePaid' NOT IN ('yes', 'no') THEN RAISE EXCEPTION 'Pick paid or not paid' USING ERRCODE = 'PT400', HINT = 'feePaid'; END IF;
  UPDATE public."Student" SET "grade" = v_grade, "section" = v_section, "schoolName" = v_school, "referralCode" = v_ref,
    "guardianEmail" = v_g_email, "guardianPhone" = v_g_phone WHERE "userId" = p_user_id;
  IF p ? 'feePaid' THEN PERFORM private.set_fee(p_user_id, p->>'feePaid' = 'yes', me); END IF;
END $function$;
