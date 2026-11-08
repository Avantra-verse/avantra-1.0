-- Super admin "Fee paid" with no waiting UPI row recorded ₹299 even for students who chose the dormitory stay.
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
      VALUES (p_student, private.fee_paise(p_student), 'OFFLINE', 'PAID', p_admin, 'set paid by super admin') RETURNING * INTO pay;
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
