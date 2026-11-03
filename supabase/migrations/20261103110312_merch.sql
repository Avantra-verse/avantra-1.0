-- Merch shop: items, orders paid by UPI QR and checked by an admin, and the QR codes to show.
-- Prices are in paise and always come from MerchItem, never from the browser.

CREATE TABLE public."MerchItem" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" text NOT NULL CHECK (length(trim("name")) BETWEEN 1 AND 80),
  "type" text NOT NULL CHECK ("type" IN ('TSHIRT', 'ZIPPER', 'HOODIE', 'CAP', 'BADGE', 'OTHER')),
  "variant" text NOT NULL DEFAULT '',
  "price" integer NOT NULL CHECK ("price" > 0),
  "imageSrc" text NOT NULL DEFAULT '',
  "sizes" text[] NOT NULL DEFAULT '{}',
  "available" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public."MerchUpiQr" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "label" text NOT NULL,
  "storagePath" text NOT NULL,
  "upiId" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "MerchUpiQr_one_active" ON public."MerchUpiQr" ("isActive") WHERE "isActive";

CREATE TABLE public."MerchOrder" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "trackingId" text NOT NULL UNIQUE,
  "buyerId" uuid NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  "totalPaise" integer NOT NULL,
  "nameToPrint" text NOT NULL,
  "studentClass" text NOT NULL,
  "schoolName" text NOT NULL,
  "contactNo" text NOT NULL,
  "paymentNote" text,
  "isCoordinator" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "verifiedAt" timestamptz,
  "verifiedBy" uuid REFERENCES public."User"("id") ON DELETE SET NULL
);
CREATE INDEX "MerchOrder_buyerId_idx" ON public."MerchOrder" ("buyerId");
CREATE INDEX "MerchOrder_verifiedBy_idx" ON public."MerchOrder" ("verifiedBy");

CREATE TABLE public."MerchOrderItem" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId" text NOT NULL REFERENCES public."MerchOrder"("id") ON DELETE CASCADE,
  "itemId" text NOT NULL REFERENCES public."MerchItem"("id") ON DELETE RESTRICT,
  "size" text NOT NULL,
  "quantity" integer NOT NULL CHECK ("quantity" BETWEEN 1 AND 10),
  "pricePaise" integer NOT NULL
);
CREATE INDEX "MerchOrderItem_orderId_idx" ON public."MerchOrderItem" ("orderId");
CREATE INDEX "MerchOrderItem_itemId_idx" ON public."MerchOrderItem" ("itemId");

ALTER TABLE public."MerchItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchUpiQr" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchOrderItem" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."MerchItem", public."MerchUpiQr", public."MerchOrder", public."MerchOrderItem" FROM anon, authenticated;

-- The shop page reads items straight from the table: only items on sale.
GRANT SELECT ON public."MerchItem" TO anon, authenticated;
CREATE POLICY "MerchItem_on_sale" ON public."MerchItem" FOR SELECT TO anon, authenticated USING ("available");

-- ---- shop ----

CREATE FUNCTION private.merch_order_json(o public."MerchOrder", p_admin boolean) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', o."id", 'trackingId', o."trackingId", 'status', o."status", 'totalPaise', o."totalPaise",
      'nameToPrint', o."nameToPrint", 'studentClass', o."studentClass", 'schoolName', o."schoolName",
      'createdAt', o."createdAt", 'verifiedAt', o."verifiedAt",
      'items', coalesce((SELECT jsonb_agg(jsonb_build_object('name', i."name", 'type', i."type", 'size', oi."size",
          'quantity', oi."quantity", 'pricePaise', oi."pricePaise") ORDER BY i."name", oi."size")
        FROM public."MerchOrderItem" oi JOIN public."MerchItem" i ON i."id" = oi."itemId" WHERE oi."orderId" = o."id"), '[]'::jsonb))
    || CASE WHEN p_admin THEN jsonb_build_object('contactNo', o."contactNo", 'paymentNote', o."paymentNote",
         'isCoordinator', o."isCoordinator", 'buyerName', u."name", 'buyerEmail', u."email")
       ELSE '{}'::jsonb END
  FROM public."User" u WHERE u."id" = o."buyerId"
$$;

CREATE FUNCTION public.merch_active_qr() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('id', "id", 'label', "label", 'upiId', "upiId", 'storagePath', "storagePath")
  FROM public."MerchUpiQr" WHERE "isActive"
$$;

-- p_items: [{itemId, size, quantity}]; any pricePaise sent is ignored.
CREATE FUNCTION public.place_merch_order(p_items jsonb, p_student_class text, p_school_name text, p_contact_no text,
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
  IF length(trim(coalesce(p_student_class, ''))) NOT BETWEEN 1 AND 20 OR length(trim(coalesce(p_school_name, ''))) NOT BETWEEN 1 AND 120 THEN
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

CREATE FUNCTION public.my_merch_orders() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(private.merch_order_json(o, false) ORDER BY o."createdAt" DESC), '[]'::jsonb)
  FROM public."MerchOrder" o WHERE o."buyerId" = (SELECT auth.uid())
$$;

-- Public by design: anyone with the tracking link. No contact number or email.
CREATE FUNCTION public.merch_order_by_tracking(p_tracking_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public."MerchOrder";
BEGIN
  SELECT * INTO o FROM public."MerchOrder" WHERE "trackingId" = upper(trim(p_tracking_id));
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'PT404'; END IF;
  RETURN private.merch_order_json(o, false);
END $$;

-- ---- admin ----

CREATE FUNCTION public.admin_merch_orders() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(private.merch_order_json(o, true) ORDER BY o."createdAt" DESC) FROM public."MerchOrder" o), '[]'::jsonb);
END $$;

CREATE FUNCTION public.admin_merch_verify_payment(p_order_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_admin uuid := private.my_admin();
BEGIN
  UPDATE public."MerchOrder" SET "status" = 'PAID', "verifiedAt" = now(), "verifiedBy" = v_admin
    WHERE "id" = p_order_id AND "status" = 'PENDING';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or already verified' USING ERRCODE = 'PT409'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE FUNCTION public.admin_merch_items() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."type", i."name", i."variant") FROM public."MerchItem" i), '[]'::jsonb);
END $$;

CREATE FUNCTION public.admin_merch_create_item(p_name text, p_type text, p_variant text, p_price integer, p_image_src text,
  p_sizes text[], p_available boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public."MerchItem";
BEGIN
  PERFORM private.my_admin();
  INSERT INTO public."MerchItem" ("name", "type", "variant", "price", "imageSrc", "sizes", "available")
    VALUES (trim(p_name), p_type, coalesce(trim(p_variant), ''), p_price, coalesce(trim(p_image_src), ''),
      coalesce(p_sizes, '{}'), coalesce(p_available, true))
    RETURNING * INTO i;
  RETURN to_jsonb(i);
END $$;

CREATE FUNCTION public.admin_merch_update_item(p_id text, p_name text, p_type text, p_variant text, p_price integer,
  p_image_src text, p_sizes text[], p_available boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public."MerchItem";
BEGIN
  PERFORM private.my_admin();
  UPDATE public."MerchItem" SET "name" = trim(p_name), "type" = p_type, "variant" = coalesce(trim(p_variant), ''),
      "price" = p_price, "imageSrc" = coalesce(trim(p_image_src), ''), "sizes" = coalesce(p_sizes, '{}'),
      "available" = coalesce(p_available, "available")
    WHERE "id" = p_id RETURNING * INTO i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'PT404'; END IF;
  RETURN to_jsonb(i);
END $$;

CREATE FUNCTION public.admin_merch_toggle_item(p_id text, p_available boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  UPDATE public."MerchItem" SET "available" = p_available WHERE "id" = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE FUNCTION public.admin_merch_delete_item(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF EXISTS (SELECT 1 FROM public."MerchOrderItem" WHERE "itemId" = p_id) THEN
    RAISE EXCEPTION 'This item has orders. Hide it instead of deleting it.' USING ERRCODE = 'PT409';
  END IF;
  DELETE FROM public."MerchItem" WHERE "id" = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE FUNCTION public.admin_merch_upi_qrs() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC) FROM public."MerchUpiQr" q), '[]'::jsonb);
END $$;

-- Called by the /admin/merch/upi-qrs route handler after it stores the image. The first QR becomes active.
CREATE FUNCTION public.admin_merch_add_qr(p_label text, p_storage_path text, p_upi_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  PERFORM private.my_admin();
  INSERT INTO public."MerchUpiQr" ("label", "storagePath", "upiId", "isActive")
    VALUES (trim(p_label), p_storage_path, trim(p_upi_id), NOT EXISTS (SELECT 1 FROM public."MerchUpiQr" WHERE "isActive"))
    RETURNING "id" INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

CREATE FUNCTION public.admin_merch_set_active_qr(p_qr_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF NOT EXISTS (SELECT 1 FROM public."MerchUpiQr" WHERE "id" = p_qr_id) THEN
    RAISE EXCEPTION 'QR not found' USING ERRCODE = 'PT404';
  END IF;
  UPDATE public."MerchUpiQr" SET "isActive" = false WHERE "isActive" AND "id" <> p_qr_id;
  UPDATE public."MerchUpiQr" SET "isActive" = true WHERE "id" = p_qr_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE FUNCTION public.admin_merch_delete_qr(p_qr_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  DELETE FROM public."MerchUpiQr" WHERE "id" = p_qr_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---- grants ----

REVOKE ALL ON FUNCTION private.merch_order_json(public."MerchOrder", boolean) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.merch_active_qr(), public.merch_order_by_tracking(text),
  public.place_merch_order(jsonb, text, text, text, text, boolean, text), public.my_merch_orders(),
  public.admin_merch_orders(), public.admin_merch_verify_payment(text), public.admin_merch_items(),
  public.admin_merch_create_item(text, text, text, integer, text, text[], boolean),
  public.admin_merch_update_item(text, text, text, text, integer, text, text[], boolean),
  public.admin_merch_toggle_item(text, boolean), public.admin_merch_delete_item(text), public.admin_merch_upi_qrs(),
  public.admin_merch_add_qr(text, text, text), public.admin_merch_set_active_qr(text), public.admin_merch_delete_qr(text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.merch_active_qr(), public.merch_order_by_tracking(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_merch_order(jsonb, text, text, text, text, boolean, text), public.my_merch_orders(),
  public.admin_merch_orders(), public.admin_merch_verify_payment(text), public.admin_merch_items(),
  public.admin_merch_create_item(text, text, text, integer, text, text[], boolean),
  public.admin_merch_update_item(text, text, text, text, integer, text, text[], boolean),
  public.admin_merch_toggle_item(text, boolean), public.admin_merch_delete_item(text), public.admin_merch_upi_qrs(),
  public.admin_merch_add_qr(text, text, text), public.admin_merch_set_active_qr(text), public.admin_merch_delete_qr(text)
  TO authenticated;

-- ---- storage: public-read buckets, written only by admin route handlers with the secret key ----

INSERT INTO storage.buckets ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('merch-products', 'merch-products', true, 5242880, '{image/png,image/jpeg,image/webp}'),
       ('merch-upi-qrs', 'merch-upi-qrs', true, 2097152, '{image/png,image/jpeg,image/webp}')
ON CONFLICT ("id") DO NOTHING;
