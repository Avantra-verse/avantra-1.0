-- Super admin fee switch, only for students who paid by UPI and sent a UTR (Edit → Fee and the one-tap button).
-- Paid: their latest UPI payment with a UTR (waiting, or one the school marked not paid) becomes PAID + fee email.
-- Not paid: their PAID UPI payment becomes FAILED + the usual "try again" email, as when the school says Not paid.
-- Cash paid at the desk is never changed here.
CREATE OR REPLACE FUNCTION private.set_fee(p_student uuid, p_paid boolean, p_admin uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public."Student"; pay public."Payment";
BEGIN
  SELECT * INTO s FROM public."Student" WHERE "userId" = p_student FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'This account has no student profile yet' USING ERRCODE = 'PT404'; END IF;
  IF (s."feePaidAt" IS NOT NULL) = p_paid THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public."Payment" WHERE "studentId" = p_student AND "method" = 'OFFLINE' AND "status" = 'PAID') THEN
    RAISE EXCEPTION 'This fee was paid in cash at the desk, so it can''t be changed here' USING ERRCODE = 'PT409', HINT = 'feePaid';
  END IF;
  SELECT * INTO pay FROM public."Payment" WHERE "studentId" = p_student AND "method" = 'UPI' AND "utr" IS NOT NULL
    AND "status" = ANY (CASE WHEN p_paid THEN ARRAY['CREATED', 'FAILED']::public."PaymentStatus"[] ELSE ARRAY['PAID']::public."PaymentStatus"[] END)
  ORDER BY "createdAt" DESC LIMIT 1 FOR UPDATE;
  IF pay IS NULL THEN
    RAISE EXCEPTION 'Only students who paid by UPI and sent a UTR can be changed here' USING ERRCODE = 'PT409', HINT = 'feePaid';
  END IF;
  IF p_paid THEN
    UPDATE public."Payment" SET "status" = 'PAID', "recordedById" = p_admin, "updatedAt" = now(),
      "note" = concat_ws(' · ', "note", 'set paid by super admin') WHERE "id" = pay."id";
    UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = p_student;
    PERFORM private.fee_confirmed_mail(p_student, pay."amountPaise", 'UPI ' || pay."utr");
  ELSE
    UPDATE public."Payment" SET "status" = 'FAILED', "recordedById" = p_admin, "updatedAt" = now(),
      "note" = concat_ws(' · ', "note", 'set not paid by super admin') WHERE "id" = pay."id";
    UPDATE public."Student" SET "feePaidAt" = NULL WHERE "userId" = p_student;
    PERFORM private.upi_failed_mail(p_student, pay."utr");
  END IF;
END $function$;
REVOKE ALL ON FUNCTION private.set_fee(uuid, boolean, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_fee(p_user_id uuid, p_paid boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.set_fee(p_user_id, p_paid, private.my_super_admin());
END $function$;
REVOKE ALL ON FUNCTION public.admin_set_fee(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_fee(uuid, boolean) TO authenticated;
