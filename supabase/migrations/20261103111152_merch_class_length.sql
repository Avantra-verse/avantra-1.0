-- The merch form offers "College / Undergraduate" (23 chars): allow a class up to 40 characters.
CREATE OR REPLACE FUNCTION public.place_merch_order(p_items jsonb, p_student_class text, p_school_name text, p_contact_no text,
  p_name_to_print text, p_is_coordinator boolean DEFAULT false, p_payment_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := private.my_student();
  v_order text;
  v_tracking text;
  v_total integer := 0;
  e jsonb;
  it public."MerchItem";
  v_qty integer;
BEGIN
  PERFORM private.rate_limit('merch_order:' || v_uid, 5, 3600);
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'Your cart is empty' USING ERRCODE = 'PT400';
  END IF;
  IF length(trim(coalesce(p_name_to_print, ''))) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Name to print must be 1 to 10 characters' USING ERRCODE = 'PT400';
  END IF;
  IF length(trim(coalesce(p_student_class, ''))) NOT BETWEEN 1 AND 40 OR length(trim(coalesce(p_school_name, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Enter your class and school' USING ERRCODE = 'PT400';
  END IF;
  IF regexp_replace(coalesce(p_contact_no, ''), '\D', '', 'g') !~ '^(91)?[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Enter a valid 10-digit mobile number' USING ERRCODE = 'PT400';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public."MerchUpiQr" WHERE "isActive") THEN
    RAISE EXCEPTION 'Payments are not open yet. Try again later.' USING ERRCODE = 'PT409';
  END IF;

  -- 40 random bits, no look-alike letters: the link is the only key to the tracking page.
  v_tracking := 'AVM-' || (SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 32)::int, 1), '')
    FROM generate_series(1, 8));
  INSERT INTO public."MerchOrder" ("trackingId", "buyerId", "totalPaise", "nameToPrint", "studentClass", "schoolName",
      "contactNo", "paymentNote", "isCoordinator")
    VALUES (v_tracking, v_uid, 0, trim(p_name_to_print), trim(p_student_class), trim(p_school_name), trim(p_contact_no),
      nullif(left(trim(coalesce(p_payment_note, '')), 200), ''), coalesce(p_is_coordinator, false))
    RETURNING "id" INTO v_order;

  FOR e IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO it FROM public."MerchItem" WHERE "id" = e->>'itemId' AND "available";
    IF NOT FOUND THEN RAISE EXCEPTION 'An item in your cart is no longer on sale' USING ERRCODE = 'PT409'; END IF;
    IF cardinality(it."sizes") > 0 AND NOT (e->>'size' = ANY (it."sizes")) THEN
      RAISE EXCEPTION 'Pick a valid size for %', it."name" USING ERRCODE = 'PT400';
    END IF;
    v_qty := CASE WHEN e->>'quantity' ~ '^\d{1,2}$' THEN (e->>'quantity')::int END;
    IF v_qty IS NULL OR v_qty NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Quantity must be 1 to 10' USING ERRCODE = 'PT400'; END IF;
    INSERT INTO public."MerchOrderItem" ("orderId", "itemId", "size", "quantity", "pricePaise")
      VALUES (v_order, it."id", coalesce(e->>'size', ''), v_qty, it."price");
    v_total := v_total + it."price" * v_qty;
  END LOOP;

  UPDATE public."MerchOrder" SET "totalPaise" = v_total WHERE "id" = v_order;
  RETURN jsonb_build_object('orderId', v_order, 'trackingId', v_tracking, 'totalPaise', v_total);
END $$;
