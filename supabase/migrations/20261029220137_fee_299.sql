-- Exhibition fee ₹199 -> ₹299 (per student). Same functions as before; only the amount and its wording change.
-- Payments already recorded keep the amount they were made for.

CREATE OR REPLACE FUNCTION private.upi_failed_mail(p_student uuid, p_utr text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.queue_mail(u."email", 'AVANTRA 2026: we could not confirm your payment',
    format(E'The school could not find your ₹299 UPI payment with UTR %s in its bank statement.\nYour AVANTRA ID: %s\n\nOpen your dashboard to check the UTR and send it again, or pay again if the payment did not go through.',
      p_utr, s."avantraId"))
  FROM public."User" u JOIN public."Student" s ON s."userId" = u."id" WHERE u."id" = p_student
$function$;

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
BEGIN
  IF length(v_note) > 200 THEN RAISE EXCEPTION 'At most 200 characters' USING ERRCODE = 'PT400', HINT = 'note'; END IF;
  SELECT * INTO s FROM public."Student" WHERE "avantraId" = upper(trim(p_avantra_id)) FOR UPDATE; -- two admins clicking at once
  IF s IS NULL THEN RAISE EXCEPTION 'Unknown AVANTRA ID' USING ERRCODE = 'PT404'; END IF;
  IF s."feePaidAt" IS NOT NULL THEN RAISE EXCEPTION 'Fee already paid' USING ERRCODE = 'PT409'; END IF;
  UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = s."userId";
  INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
  VALUES (s."userId", 29900, 'OFFLINE', 'PAID', admin, v_note);
  PERFORM private.fee_confirmed_mail(s."userId", 29900, coalesce(v_note, 'cash at desk'));
  RETURN jsonb_build_object('avantraId', s."avantraId", 'name', (SELECT "name" FROM public."User" WHERE "id" = s."userId"), 'feePaid', true);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_walk_in(p_user_id uuid, p_profile jsonb, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  admin uuid := private.my_admin();
  v_note text := nullif(trim(p_note), '');
  u public."User";
  s public."Student";
BEGIN
  IF length(v_note) > 200 THEN RAISE EXCEPTION 'At most 200 characters' USING ERRCODE = 'PT400', HINT = 'note'; END IF;
  SELECT * INTO u FROM public."User" WHERE "id" = p_user_id AND "role" = 'STUDENT' AND "createdAt" > now() - interval '10 minutes' FOR UPDATE;
  IF u IS NULL OR EXISTS (SELECT 1 FROM public."Student" WHERE "userId" = p_user_id) THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404';
  END IF;
  s := private.insert_student(p_user_id, p_profile);
  UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = p_user_id;
  INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
  VALUES (p_user_id, 29900, 'OFFLINE', 'PAID', admin, v_note);
  PERFORM private.queue_mail(u."email", 'AVANTRA 2026: exhibition fee received',
    format(E'%s is registered for AVANTRA 2026 and the Science Exhibition (paid ₹299 at the desk).\nAVANTRA ID: %s\n\nTo log in, open the AVANTRA site, choose "Forgot password" and enter this email to set a password.',
      u."name", s."avantraId"));
  RETURN jsonb_build_object('avantraId', s."avantraId", 'qrToken', s."qrToken", 'name', u."name");
END $function$;

CREATE OR REPLACE FUNCTION public.register_event(p_event_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  uid uuid := private.my_student();
  ev public."Event";
  rid text;
BEGIN
  SELECT * INTO ev FROM public."Event" WHERE "id" = p_event_id FOR UPDATE;
  IF ev IS NULL THEN RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404'; END IF;
  IF NOT ev."registrationOpen" THEN RAISE EXCEPTION 'Registration for this event is closed' USING ERRCODE = 'PT400'; END IF;
  IF ev."category" = 'EXHIBITION' AND (SELECT "feePaidAt" FROM public."Student" WHERE "userId" = uid) IS NULL THEN
    RAISE EXCEPTION 'Pay the ₹299 exhibition fee first' USING ERRCODE = 'PT403';
  END IF;
  IF ev."capacity" IS NOT NULL AND (SELECT count(*) FROM public."Registration" WHERE "eventId" = ev."id") >= ev."capacity" THEN
    RAISE EXCEPTION 'This event is full' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."Registration" ("eventId", "studentId") VALUES (ev."id", uid) RETURNING "id" INTO rid;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'You are already registered for this event' USING ERRCODE = 'PT409';
  END;
  IF ev."teamMax" = 1 THEN
    PERFORM private.new_team(ev."id", (SELECT "name" FROM public."User" WHERE "id" = uid), NULL, NULL, rid);
  END IF;
  RETURN rid;
END $function$;

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
  IF EXISTS (SELECT 1 FROM public."Payment" WHERE "studentId" = uid AND "method" = 'UPI' AND "status" = 'CREATED') THEN
    RAISE EXCEPTION 'Your payment is already being checked' USING ERRCODE = 'PT409';
  END IF;
  BEGIN
    INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "utr") VALUES (uid, 29900, 'UPI', v_utr) RETURNING * INTO p;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This UTR has already been sent. Check the number in your UPI app.' USING ERRCODE = 'PT409', HINT = 'utr';
  END;
  RETURN jsonb_build_object('method', p."method", 'status', p."status", 'utr', p."utr", 'createdAt', p."createdAt");
END $function$;
