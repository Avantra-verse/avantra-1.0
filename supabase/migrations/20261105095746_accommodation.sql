-- Dormitory accommodation with food (2 days, ₹599) for Science Exhibition students, paid in the same UPI payment
-- as the ₹299 fee. Chosen before paying; locked once a UTR is sent or the fee is paid.
ALTER TABLE public."Student" ADD COLUMN "accommodation" boolean NOT NULL DEFAULT false;

-- What this student owes: the exhibition fee, plus the stay if they chose it and are in the exhibition.
CREATE OR REPLACE FUNCTION private.fee_paise(p_student uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT 29900 + CASE WHEN s."accommodation" AND EXISTS (
    SELECT 1 FROM public."Registration" r JOIN public."Event" e ON e."id" = r."eventId"
    WHERE r."studentId" = s."userId" AND e."slug" = 'exhibition') THEN 59900 ELSE 0 END
  FROM public."Student" s WHERE s."userId" = p_student
$function$;
REVOKE ALL ON FUNCTION private.fee_paise(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_accommodation(p_on boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.my_student();
BEGIN
  PERFORM private.rate_limit('stay:' || uid, 20, 60);
  PERFORM 1 FROM public."Student" WHERE "userId" = uid FOR UPDATE;
  IF (SELECT "feePaidAt" FROM public."Student" WHERE "userId" = uid) IS NOT NULL THEN
    RAISE EXCEPTION 'Your fee is paid, so accommodation can''t be changed. Write to the team if you need to.' USING ERRCODE = 'PT409', HINT = 'accommodation';
  END IF;
  IF EXISTS (SELECT 1 FROM public."Payment" WHERE "studentId" = uid AND "method" = 'UPI' AND "status" = 'CREATED' AND "utr" IS NOT NULL) THEN
    RAISE EXCEPTION 'Your payment is under review, so accommodation can''t be changed now' USING ERRCODE = 'PT409', HINT = 'accommodation';
  END IF;
  IF p_on AND NOT EXISTS (SELECT 1 FROM public."Registration" r JOIN public."Event" e ON e."id" = r."eventId"
                          WHERE r."studentId" = uid AND e."slug" = 'exhibition') THEN
    RAISE EXCEPTION 'Accommodation is for Science Exhibition students. Register for the exhibition first.' USING ERRCODE = 'PT409', HINT = 'accommodation';
  END IF;
  UPDATE public."Student" SET "accommodation" = coalesce(p_on, false) WHERE "userId" = uid;
  RETURN jsonb_build_object('accommodation', coalesce(p_on, false), 'feePaise', private.fee_paise(uid));
END $function$;
REVOKE ALL ON FUNCTION public.set_accommodation(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_accommodation(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_upi_payment(p_utr text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.my_student();
  v_utr text := regexp_replace(coalesce(p_utr, ''), '\s', '', 'g');
  p public."Payment";
BEGIN
  PERFORM private.rate_limit('upi:' || uid, 10, 60);
  IF v_utr !~ '^[0-9]{12}$' THEN
    RAISE EXCEPTION 'The UTR is the 12-digit number in your UPI app''s payment details' USING ERRCODE = 'PT400', HINT = 'utr';
  END IF;
  PERFORM 1 FROM public."Student" WHERE "userId" = uid FOR UPDATE;
  IF (SELECT "feePaidAt" FROM public."Student" WHERE "userId" = uid) IS NOT NULL THEN
    RAISE EXCEPTION 'Exhibition fee already paid' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    UPDATE public."Payment" SET "utr" = v_utr, "amountPaise" = private.fee_paise(uid), "updatedAt" = now()
    WHERE "studentId" = uid AND "method" = 'UPI' AND "status" = 'CREATED'
    RETURNING * INTO p;
    IF NOT FOUND THEN
      INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "utr") VALUES (uid, private.fee_paise(uid), 'UPI', v_utr) RETURNING * INTO p;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This UTR has already been sent. Check the number in your UPI app.' USING ERRCODE = 'PT409', HINT = 'utr';
  END;
  RETURN jsonb_build_object('method', p."method", 'status', p."status", 'utr', p."utr", 'createdAt', p."createdAt");
END $function$;

CREATE OR REPLACE FUNCTION public.admin_mark_paid(p_avantra_id text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  admin uuid := private.my_admin();
  v_note text := nullif(trim(p_note), '');
  s public."Student";
  v_paise integer;
BEGIN
  IF length(v_note) > 200 THEN RAISE EXCEPTION 'At most 200 characters' USING ERRCODE = 'PT400', HINT = 'note'; END IF;
  SELECT * INTO s FROM public."Student" WHERE "avantraId" = upper(trim(p_avantra_id)) FOR UPDATE; -- two admins clicking at once
  IF s IS NULL THEN RAISE EXCEPTION 'Unknown AVANTRA ID' USING ERRCODE = 'PT404'; END IF;
  IF s."feePaidAt" IS NOT NULL THEN RAISE EXCEPTION 'Fee already paid' USING ERRCODE = 'PT409'; END IF;
  v_paise := private.fee_paise(s."userId");
  UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = s."userId";
  INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
  VALUES (s."userId", v_paise, 'OFFLINE', 'PAID', admin, v_note);
  PERFORM private.fee_confirmed_mail(s."userId", v_paise, coalesce(v_note, 'cash at desk'));
  RETURN jsonb_build_object('avantraId', s."avantraId", 'name', (SELECT "name" FROM public."User" WHERE "id" = s."userId"), 'feePaid', true);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_export(p_kind text, p_event_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE res jsonb;
BEGIN
  PERFORM private.my_admin();
  CASE p_kind
  WHEN 'students' THEN
    SELECT jsonb_agg(jsonb_build_object('avantraId', s."avantraId", 'name', u."name", 'email', u."email", 'phone', u."phone", 'grade', s."grade",
      'school', s."schoolName", 'referralCode', s."referralCode", 'guardianPhone', s."guardianPhone", 'guardianEmail', s."guardianEmail",
      'feePaidAt', s."feePaidAt", 'paidBy', p."method", 'paymentRef', coalesce(p."razorpayPaymentId", p."utr", p."note"),
      'accommodation', private.fee_paise(s."userId") > 29900,
      'checkIns', (SELECT count(*) FROM public."CheckIn" c WHERE c."studentId" = s."userId"), 'signedUpAt', u."createdAt") ORDER BY s."avantraId")
    INTO res
    FROM public."Student" s JOIN public."User" u ON u."id" = s."userId"
    LEFT JOIN LATERAL (SELECT * FROM public."Payment" x WHERE x."studentId" = s."userId" AND x."status" = 'PAID' ORDER BY x."createdAt" LIMIT 1) p ON true;
  WHEN 'registrations' THEN
    SELECT jsonb_agg(jsonb_build_object('event', e."name", 'avantraId', s."avantraId", 'name', u."name", 'grade', s."grade", 'school', s."schoolName",
      'team', t."name", 'teamLeader', m."isLeader", 'projectTitle', t."projectTitle", 'topic', t."topic", 'rank', t."rank",
      'certificateCode', r."certificateCode", 'registeredAt', r."createdAt") ORDER BY e."name", r."createdAt")
    INTO res
    FROM public."Registration" r JOIN public."Event" e ON e."id" = r."eventId"
    JOIN public."Student" s ON s."userId" = r."studentId" JOIN public."User" u ON u."id" = s."userId"
    LEFT JOIN public."TeamMember" m ON m."registrationId" = r."id" LEFT JOIN public."Team" t ON t."id" = m."teamId"
    WHERE p_event_id IS NULL OR r."eventId" = p_event_id;
  WHEN 'payments' THEN
    SELECT jsonb_agg(jsonb_build_object('createdAt', p."createdAt", 'avantraId', s."avantraId", 'name', u."name", 'amountRupees', p."amountPaise" / 100.0,
      'method', p."method", 'status', p."status", 'razorpayOrderId', p."razorpayOrderId", 'razorpayPaymentId', p."razorpayPaymentId", 'utr', p."utr",
      'recordedBy', a."email", 'note', p."note") ORDER BY p."createdAt")
    INTO res
    FROM public."Payment" p JOIN public."Student" s ON s."userId" = p."studentId" JOIN public."User" u ON u."id" = s."userId"
    LEFT JOIN public."User" a ON a."id" = p."recordedById";
  WHEN 'upi' THEN
    SELECT jsonb_agg(jsonb_build_object('avantraId', s."avantraId", 'name', u."name", 'school', s."schoolName", 'grade', s."grade", 'section', s."section",
      'submittedAt', p."createdAt", 'utr', p."utr", 'amountPaise', p."amountPaise") ORDER BY p."createdAt")
    INTO res
    FROM public."Payment" p JOIN public."Student" s ON s."userId" = p."studentId" JOIN public."User" u ON u."id" = s."userId"
    WHERE p."method" = 'UPI' AND p."status" = 'CREATED';
  WHEN 'wall' THEN
    SELECT jsonb_agg(jsonb_build_object('rank', w."rank", 'avantraId', w."avantraId", 'name', w."name", 'grade', w."grade", 'section', w."section",
      'school', w."school", 'points', w."points", 'solved', w."solved", 'lastSolvedAt', w."lastSolvedAt") ORDER BY w."rank")
    INTO res FROM private.wall_players(null) w;
  WHEN 'chits' THEN
    SELECT jsonb_agg(jsonb_build_object('number', c."number", 'code', c."code", 'category', c."category", 'difficulty', c."difficulty",
      'points', c."points", 'question', c."question", 'options', coalesce(c."options", '{}')) ORDER BY c."number")
    INTO res FROM public."WallChallenge" c WHERE c."active";
  ELSE RAISE EXCEPTION 'Unknown export' USING ERRCODE = 'PT404';
  END CASE;
  RETURN coalesce(res, '[]');
END $function$;
