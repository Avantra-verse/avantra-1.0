-- Admin order status steps, a print name per cart line, and checkout prefill.

-- ---- order status: PAID -> SHIPPED -> DELIVERED only ----

CREATE OR REPLACE FUNCTION public.admin_merch_update_order_status(p_order_id text, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF p_status NOT IN ('SHIPPED', 'DELIVERED') THEN
    RAISE EXCEPTION 'Status must be SHIPPED or DELIVERED' USING ERRCODE = 'PT400';
  END IF;
  UPDATE public."MerchOrder" SET "status" = p_status
    WHERE "id" = p_order_id
      AND "status" = CASE p_status WHEN 'SHIPPED' THEN 'PAID' ELSE 'SHIPPED' END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, or it is not ready for that step' USING ERRCODE = 'PT409';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---- a print name per cart line (falls back to the order's name) ----

ALTER TABLE public."MerchOrderItem" ADD COLUMN IF NOT EXISTS "nameToPrint" text;

CREATE OR REPLACE FUNCTION public.place_merch_order(p_items jsonb, p_student_class text, p_school_name text,
  p_contact_no text, p_name_to_print text, p_is_coordinator boolean DEFAULT false, p_payment_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := private.my_student();
  v_order text;
  v_tracking text;
  v_total integer := 0;
  e jsonb;
  it public."MerchItem";
  v_qty integer;
  v_name text;
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
    v_name := nullif(upper(trim(coalesce(e->>'nameToPrint', ''))), '');
    IF length(v_name) > 10 THEN
      RAISE EXCEPTION 'Name to print on % must be 10 characters or less', it."name" USING ERRCODE = 'PT400';
    END IF;
    INSERT INTO public."MerchOrderItem" ("orderId", "itemId", "size", "quantity", "pricePaise", "nameToPrint")
      VALUES (v_order, it."id", coalesce(e->>'size', ''), v_qty, it."price", coalesce(v_name, upper(trim(p_name_to_print))));
    v_total := v_total + it."price" * v_qty;
  END LOOP;

  UPDATE public."MerchOrder" SET "totalPaise" = v_total WHERE "id" = v_order;
  RETURN jsonb_build_object('orderId', v_order, 'trackingId', v_tracking, 'totalPaise', v_total);
END $$;

-- Same as before, plus each line's nameToPrint.
CREATE OR REPLACE FUNCTION private.merch_order_json(o public."MerchOrder", p_admin boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', o."id", 'trackingId', o."trackingId", 'status', o."status", 'totalPaise', o."totalPaise",
      'nameToPrint', o."nameToPrint", 'studentClass', o."studentClass", 'schoolName', o."schoolName",
      'createdAt', o."createdAt", 'verifiedAt', o."verifiedAt",
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('name', i."name", 'type', i."type", 'size', oi."size",
          'quantity', oi."quantity", 'pricePaise', oi."pricePaise", 'nameToPrint', coalesce(oi."nameToPrint", o."nameToPrint"))
          ORDER BY i."name", oi."size")
        FROM public."MerchOrderItem" oi JOIN public."MerchItem" i ON i."id" = oi."itemId" WHERE oi."orderId" = o."id"), '[]'::jsonb))
    || CASE WHEN p_admin THEN jsonb_build_object('contactNo', o."contactNo", 'paymentNote', o."paymentNote",
         'isCoordinator', o."isCoordinator", 'buyerName', u."name", 'buyerEmail', u."email")
       ELSE '{}'::jsonb END
  FROM public."User" u WHERE u."id" = o."buyerId"
$$;

-- ---- checkout prefill: own profile + own last order (the order tables have no read policy) ----

CREATE OR REPLACE FUNCTION public.merch_profile_defaults()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'schoolName', coalesce(s."schoolName", o."schoolName", ''),
    'grade', s."grade",
    'studentClass', coalesce(CASE WHEN s."grade" IS NOT NULL THEN 'Class ' || s."grade" END, o."studentClass", ''),
    'contactNo', coalesce(o."contactNo", ''),
    'nameToPrint', coalesce(o."nameToPrint", ''))
  FROM (SELECT (SELECT auth.uid()) AS uid) me
  LEFT JOIN public."Student" s ON s."userId" = me.uid
  LEFT JOIN LATERAL (SELECT * FROM public."MerchOrder" WHERE "buyerId" = me.uid ORDER BY "createdAt" DESC LIMIT 1) o ON true
$$;

-- ---- grants ----

REVOKE ALL ON FUNCTION private.merch_order_json(public."MerchOrder", boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_merch_update_order_status(text, text), public.merch_profile_defaults(),
  public.place_merch_order(jsonb, text, text, text, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merch_update_order_status(text, text), public.merch_profile_defaults(),
  public.place_merch_order(jsonb, text, text, text, text, boolean, text) TO authenticated;
