-- A student can correct a mistyped UTR while the payment is still under review: sending a new UTR
-- replaces the one on the waiting payment instead of being refused. Decided payments never change.
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
    UPDATE public."Payment" SET "utr" = v_utr, "updatedAt" = now()
    WHERE "studentId" = uid AND "method" = 'UPI' AND "status" = 'CREATED'
    RETURNING * INTO p;
    IF NOT FOUND THEN
      INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "utr") VALUES (uid, 29900, 'UPI', v_utr) RETURNING * INTO p;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This UTR has already been sent. Check the number in your UPI app.' USING ERRCODE = 'PT409', HINT = 'utr';
  END;
  RETURN jsonb_build_object('method', p."method", 'status', p."status", 'utr', p."utr", 'createdAt', p."createdAt");
END $function$;
