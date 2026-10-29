-- Admin files: rows for the CSV / Excel / PDF downloads, the UPI sheet import and the Wall sheet import.
-- The files themselves are made in Next route handlers (apps/web/app/admin/**/route.ts) with the admin's session;
-- these functions only hand over rows and apply decisions. Was reports.controller, admin.controller and wall.controller.

-- Rows for one download, as a JSON array (minors' data: admins only).
-- students | registrations (p_event_id = one event, null = all) | payments | upi | wall | chits
CREATE FUNCTION public.admin_export(p_kind text, p_event_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE res jsonb;
BEGIN
  PERFORM private.my_admin();
  CASE p_kind
  WHEN 'students' THEN
    SELECT jsonb_agg(jsonb_build_object('avantraId', s."avantraId", 'name', u."name", 'email', u."email", 'phone', u."phone", 'grade', s."grade",
      'school', s."schoolName", 'referralCode', s."referralCode", 'guardianPhone', s."guardianPhone", 'guardianEmail', s."guardianEmail",
      'feePaidAt', s."feePaidAt", 'paidBy', p."method", 'paymentRef', coalesce(p."razorpayPaymentId", p."utr", p."note"),
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
  -- Reconciliation with Razorpay settlements, the school's UPI statement and the cash box.
  WHEN 'payments' THEN
    SELECT jsonb_agg(jsonb_build_object('createdAt', p."createdAt", 'avantraId', s."avantraId", 'name', u."name", 'amountRupees', p."amountPaise" / 100.0,
      'method', p."method", 'status', p."status", 'razorpayOrderId', p."razorpayOrderId", 'razorpayPaymentId', p."razorpayPaymentId", 'utr', p."utr",
      'recordedBy', a."email", 'note', p."note") ORDER BY p."createdAt")
    INTO res
    FROM public."Payment" p JOIN public."Student" s ON s."userId" = p."studentId" JOIN public."User" u ON u."id" = s."userId"
    LEFT JOIN public."User" a ON a."id" = p."recordedById";
  -- UPI payments waiting for the school's check, for the .xlsx.
  WHEN 'upi' THEN
    SELECT jsonb_agg(jsonb_build_object('avantraId', s."avantraId", 'name', u."name", 'school', s."schoolName", 'grade', s."grade", 'section', s."section",
      'submittedAt', p."createdAt", 'utr', p."utr", 'amountPaise', p."amountPaise") ORDER BY p."createdAt")
    INTO res
    FROM public."Payment" p JOIN public."Student" s ON s."userId" = p."studentId" JOIN public."User" u ON u."id" = s."userId"
    WHERE p."method" = 'UPI' AND p."status" = 'CREATED';
  -- Full live standings with AVANTRA IDs, for prizes (ignores the freeze).
  WHEN 'wall' THEN
    SELECT jsonb_agg(jsonb_build_object('rank', w."rank", 'avantraId', w."avantraId", 'name', w."name", 'grade', w."grade", 'section', w."section",
      'school', w."school", 'points', w."points", 'solved', w."solved", 'lastSolvedAt', w."lastSolvedAt") ORDER BY w."rank")
    INTO res FROM private.wall_players(null) w;
  -- Active chits for printing: everything on the chit, never the answers.
  WHEN 'chits' THEN
    SELECT jsonb_agg(jsonb_build_object('number', c."number", 'code', c."code", 'category', c."category", 'difficulty', c."difficulty",
      'points', c."points", 'question', c."question", 'options', coalesce(c."options", '{}')) ORDER BY c."number")
    INTO res FROM public."WallChallenge" c WHERE c."active";
  ELSE RAISE EXCEPTION 'Unknown export' USING ERRCODE = 'PT404';
  END CASE;
  RETURN coalesce(res, '[]');
END $$;

-- The school's decisions from the UPI sheet: [{row, avantraId, utr, status: PAID | FAILED}].
-- Safe to import the same file twice: payments already decided come back as "already", not changed.
-- Each result: missing (no such UPI payment) | already | paid | double (paid, but the fee was already paid: refund one) | failed,
-- with the student's email so the caller can send "fee confirmed" / "try again".
CREATE FUNCTION public.admin_upi_decide(p_decisions jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  admin uuid := private.my_admin();
  d jsonb;
  p public."Payment";
  s public."Student";
  result text;
  results jsonb := '[]';
BEGIN
  FOR d IN SELECT * FROM jsonb_array_elements(p_decisions) LOOP
    IF d->>'status' NOT IN ('PAID', 'FAILED') THEN RAISE EXCEPTION 'status must be PAID or FAILED' USING ERRCODE = 'PT400'; END IF;
    SELECT x.* INTO p FROM public."Payment" x JOIN public."Student" y ON y."userId" = x."studentId"
    WHERE x."method" = 'UPI' AND x."utr" = d->>'utr' AND y."avantraId" = upper(d->>'avantraId')
    ORDER BY x."createdAt" DESC LIMIT 1 FOR UPDATE OF x; -- two admins importing at once can't both apply a row
    IF p IS NULL THEN
      result := 'missing';
    ELSIF p."status" <> 'CREATED' THEN
      result := 'already';
    ELSE
      UPDATE public."Payment" SET "status" = (d->>'status')::public."PaymentStatus", "recordedById" = admin, "updatedAt" = now() WHERE "id" = p."id";
      SELECT * INTO s FROM public."Student" WHERE "userId" = p."studentId" FOR UPDATE;
      IF d->>'status' = 'FAILED' THEN result := 'failed';
      ELSIF s."feePaidAt" IS NOT NULL THEN result := 'double';
      ELSE
        UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = s."userId";
        result := 'paid';
      END IF;
    END IF;
    results := results || jsonb_build_object('row', d->'row', 'avantraId', upper(d->>'avantraId'), 'utr', d->>'utr', 'result', result,
      'amountPaise', p."amountPaise", 'email', (SELECT "email" FROM public."User" WHERE "id" = p."studentId"));
    p := NULL;
  END LOOP;
  RETURN results;
END $$;

-- New Wall challenges from the admin's sheet (checked against WallChallengeInput in the route first). Each gets a fresh chit code. All or nothing.
CREATE FUNCTION public.admin_wall_add(p_challenges jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE taken text; made jsonb;
BEGIN
  PERFORM private.my_admin();
  IF jsonb_array_length(p_challenges) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION '1 to 500 challenges per upload' USING ERRCODE = 'PT400'; END IF;
  IF (SELECT count(DISTINCT x->>'number') <> count(*) FROM jsonb_array_elements(p_challenges) x) THEN
    RAISE EXCEPTION 'Challenge numbers repeat in this list' USING ERRCODE = 'PT400';
  END IF;
  SELECT string_agg(c."number"::text, ', ' ORDER BY c."number") INTO taken
  FROM public."WallChallenge" c WHERE c."number" IN (SELECT (x->>'number')::int FROM jsonb_array_elements(p_challenges) x);
  IF taken IS NOT NULL THEN RAISE EXCEPTION 'Challenge numbers already used: %', taken USING ERRCODE = 'PT409'; END IF;
  -- shortcut: a clash on the random 6-letter code (1 in ~10^9 per pair) fails the whole upload; the admin uploads again.
  WITH ins AS (
    INSERT INTO public."WallChallenge" ("code", "number", "category", "difficulty", "points", "question", "options", "answers")
    SELECT private.random_code(6), (x->>'number')::int, x->>'category', (x->>'difficulty')::int,
      coalesce((x->>'points')::int, 10 * (x->>'difficulty')::int), x->>'question',
      ARRAY(SELECT jsonb_array_elements_text(coalesce(x->'options', '[]'))), ARRAY(SELECT jsonb_array_elements_text(x->'answers'))
    FROM jsonb_array_elements(p_challenges) x
    RETURNING *)
  SELECT jsonb_agg(to_jsonb(ins) ORDER BY ins."number") INTO made FROM ins;
  RETURN made;
END $$;

REVOKE ALL ON FUNCTION public.admin_export(text, text), public.admin_upi_decide(jsonb), public.admin_wall_add(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_export(text, text), public.admin_upi_decide(jsonb), public.admin_wall_add(jsonb) TO authenticated;
