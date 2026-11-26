-- Super admin can fix a paid merch order's details (print names, class, school, contact, sizes).
-- Items, quantities, prices and status stay as they are; no email is sent.

-- Same as before, plus each line's id (the edit form sends it back).
CREATE OR REPLACE FUNCTION private.merch_order_json(o public."MerchOrder", p_admin boolean)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', o."id", 'trackingId', o."trackingId", 'status', o."status", 'totalPaise', o."totalPaise",
      'nameToPrint', o."nameToPrint", 'studentClass', o."studentClass", 'schoolName', o."schoolName",
      'createdAt', o."createdAt", 'verifiedAt', o."verifiedAt",
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('id', oi."id", 'name', i."name", 'type', i."type", 'size', oi."size",
          'quantity', oi."quantity", 'pricePaise', oi."pricePaise", 'nameToPrint', coalesce(oi."nameToPrint", o."nameToPrint"))
          ORDER BY i."name", oi."size")
        FROM public."MerchOrderItem" oi JOIN public."MerchItem" i ON i."id" = oi."itemId" WHERE oi."orderId" = o."id"), '[]'::jsonb))
    || CASE WHEN p_admin THEN jsonb_build_object('contactNo', o."contactNo", 'paymentNote', o."paymentNote",
         'isCoordinator', o."isCoordinator", 'buyerName', u."name", 'buyerEmail', u."email")
       ELSE '{}'::jsonb END
  FROM public."User" u WHERE u."id" = o."buyerId"
$$;

-- p_items: [{ "id": <MerchOrderItem id>, "size": "...", "nameToPrint": "..." }]; lines not listed stay unchanged.
CREATE FUNCTION public.admin_merch_edit_order(p_order_id text, p_name_to_print text, p_student_class text,
  p_school_name text, p_contact_no text, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e jsonb;
  oi public."MerchOrderItem";
  it public."MerchItem";
  v_name text;
BEGIN
  PERFORM private.my_super_admin();
  IF length(trim(coalesce(p_name_to_print, ''))) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Name to print must be 1 to 10 characters' USING ERRCODE = 'PT400';
  END IF;
  IF length(trim(coalesce(p_student_class, ''))) NOT BETWEEN 1 AND 40 OR length(trim(coalesce(p_school_name, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Enter the class and school' USING ERRCODE = 'PT400';
  END IF;
  IF regexp_replace(coalesce(p_contact_no, ''), '\D', '', 'g') !~ '^(91)?[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'Enter a valid 10-digit mobile number' USING ERRCODE = 'PT400';
  END IF;
  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) IS DISTINCT FROM 'array' OR jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'Bad item list' USING ERRCODE = 'PT400';
  END IF;

  UPDATE public."MerchOrder"
    SET "nameToPrint" = trim(p_name_to_print), "studentClass" = trim(p_student_class),
        "schoolName" = trim(p_school_name), "contactNo" = trim(p_contact_no)
    WHERE "id" = p_order_id AND "status" IN ('PAID', 'SHIPPED', 'DELIVERED');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, or it is not paid' USING ERRCODE = 'PT409';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    SELECT * INTO oi FROM public."MerchOrderItem" WHERE "id" = e->>'id' AND "orderId" = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is not part of this order' USING ERRCODE = 'PT400'; END IF;
    SELECT * INTO it FROM public."MerchItem" WHERE "id" = oi."itemId";
    IF cardinality(it."sizes") > 0 AND NOT (coalesce(e->>'size', '') = ANY (it."sizes")) THEN
      RAISE EXCEPTION 'Size for % must be one of %', it."name", array_to_string(it."sizes", ', ') USING ERRCODE = 'PT400';
    END IF;
    v_name := nullif(upper(trim(coalesce(e->>'nameToPrint', ''))), '');
    IF length(v_name) > 10 THEN
      RAISE EXCEPTION 'Name to print on % must be 10 characters or less', it."name" USING ERRCODE = 'PT400';
    END IF;
    UPDATE public."MerchOrderItem"
      SET "size" = CASE WHEN cardinality(it."sizes") > 0 THEN e->>'size' ELSE "size" END,
          "nameToPrint" = coalesce(v_name, upper(trim(p_name_to_print)))
      WHERE "id" = oi."id";
  END LOOP;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.admin_merch_edit_order(text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merch_edit_order(text, text, text, text, text, jsonb) TO authenticated;
