-- ====================================================================
-- AVANTRA 2026 — COMPLETE MERCHANDISE E-COMMERCE & ADMIN SYSTEM
-- Run this entire script in Supabase SQL Editor.
-- Safe to re-run: tables, types, functions, and policies use IF NOT EXISTS
-- or CREATE OR REPLACE.
-- ====================================================================

-- 1. TABLES
CREATE TABLE IF NOT EXISTS public."MerchItem" (
  "id"        text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"      text        NOT NULL,
  "type"      text        NOT NULL DEFAULT 'TSHIRT', -- 'TSHIRT' | 'ZIPPER' | 'HOODIE' | etc.
  "variant"   text        NOT NULL DEFAULT 'STANDARD', -- 'BLUE' | 'RED_GIRLS' | 'RED_BOYS' | etc.
  "price"     integer     NOT NULL, -- in paise (e.g. 59900 = ₹599)
  "imageSrc"  text        NOT NULL,
  "available" boolean     NOT NULL DEFAULT true,
  "sizes"     text[]      NOT NULL DEFAULT ARRAY['S','M','L','XL','XXL'],
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."MerchOrder" (
  "id"             text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "trackingId"     text        NOT NULL UNIQUE,
  "userId"         uuid        NOT NULL REFERENCES public."User"("id"),
  "studentClass"   text        NOT NULL,
  "schoolName"     text        NOT NULL,
  "contactNo"      text        NOT NULL,
  "nameToPrint"    text        NOT NULL,
  "isCoordinator"  boolean     NOT NULL DEFAULT false,
  "status"         text        NOT NULL DEFAULT 'PENDING', -- PENDING | PAID | SHIPPED | DELIVERED | CANCELLED
  "totalPaise"     integer     NOT NULL,
  "paymentNote"    text,
  "verifiedAt"     timestamptz,
  "verifiedById"   uuid        REFERENCES public."User"("id"),
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."MerchOrderItem" (
  "id"         text    PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "orderId"    text    NOT NULL REFERENCES public."MerchOrder"("id") ON DELETE CASCADE,
  "itemId"     text    NOT NULL REFERENCES public."MerchItem"("id") ON DELETE RESTRICT,
  "size"       text    NOT NULL,
  "quantity"   integer NOT NULL DEFAULT 1,
  "pricePaise" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public."MerchUpiQr" (
  "id"          text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "label"       text        NOT NULL,
  "storagePath" text        NOT NULL,
  "upiId"       text        NOT NULL,
  "isActive"    boolean     NOT NULL DEFAULT false,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS "MerchOrder_userId_idx"      ON public."MerchOrder"("userId");
CREATE INDEX IF NOT EXISTS "MerchOrderItem_orderId_idx" ON public."MerchOrderItem"("orderId");

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public."MerchItem"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchOrder"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MerchUpiQr"     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'merch_items_public_read') THEN
    CREATE POLICY "merch_items_public_read" ON public."MerchItem" FOR SELECT USING ("available" = true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'merch_orders_own_read') THEN
    CREATE POLICY "merch_orders_own_read" ON public."MerchOrder" FOR SELECT USING (auth.uid() = "userId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'merch_order_items_own_read') THEN
    CREATE POLICY "merch_order_items_own_read" ON public."MerchOrderItem" FOR SELECT
      USING (EXISTS (SELECT 1 FROM public."MerchOrder" o WHERE o."id" = "orderId" AND o."userId" = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'merch_upi_qr_public_read') THEN
    CREATE POLICY "merch_upi_qr_public_read" ON public."MerchUpiQr" FOR SELECT USING ("isActive" = true);
  END IF;
END $$;

-- 4. PRIVATE EMAIL HELPERS
CREATE OR REPLACE FUNCTION private.merch_order_confirm_mail(p_order_id text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_email      text;
  v_name       text;
  v_tracking   text;
  v_total      integer;
  v_items_text text;
BEGIN
  SELECT u."email", u."name", o."trackingId", o."totalPaise"
    INTO v_email, v_name, v_tracking, v_total
    FROM public."MerchOrder" o
    JOIN public."User" u ON u."id" = o."userId"
   WHERE o."id" = p_order_id;

  SELECT string_agg(
    format('  • %s × %s (Size: %s) — ₹%s', mi."name", oi."quantity", oi."size", (oi."pricePaise" * oi."quantity") / 100),
    E'\n' ORDER BY oi."id"
  )
    INTO v_items_text
    FROM public."MerchOrderItem" oi
    JOIN public."MerchItem" mi ON mi."id" = oi."itemId"
   WHERE oi."orderId" = p_order_id;

  PERFORM private.queue_mail(
    v_email,
    'AVANTRA 2026 Merch — Order Confirmed',
    format(
      E'Hi %s,\n\nYour AVANTRA 2026 merch order has been placed successfully!\n\nTracking ID: %s\nTrack your order: https://avantra.in/merch/track/%s\n\nItems ordered:\n%s\n\nTotal: ₹%s\n\nNext step: Complete the UPI payment shown on the merch page and enter your UTR so we can verify it. Your order ships once payment is confirmed.\n\nFor any questions, reply to this email.\n\nSee you at AVANTRA 2026! 🚀',
      v_name, v_tracking, v_tracking,
      v_items_text,
      v_total / 100
    )
  );
END $$;

CREATE OR REPLACE FUNCTION private.merch_payment_verified_mail(p_order_id text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_email    text;
  v_name     text;
  v_tracking text;
  v_total    integer;
BEGIN
  SELECT u."email", u."name", o."trackingId", o."totalPaise"
    INTO v_email, v_name, v_tracking, v_total
    FROM public."MerchOrder" o
    JOIN public."User" u ON u."id" = o."userId"
   WHERE o."id" = p_order_id;

  PERFORM private.queue_mail(
    v_email,
    'AVANTRA 2026 Merch — Payment Verified ✅',
    format(
      E'Hi %s,\n\nGreat news! Your payment of ₹%s for your AVANTRA 2026 merch order has been verified.\n\nTracking ID: %s\nTrack your order: https://avantra.in/merch/track/%s\n\nYour order is now being processed and will be shipped soon. You will receive another update when it ships.\n\nThank you for supporting AVANTRA 2026! 🎉',
      v_name, v_total / 100,
      v_tracking, v_tracking
    )
  );
END $$;

-- 5. PUBLIC CLIENT RPCS

CREATE OR REPLACE FUNCTION public.place_merch_order(
  p_items         jsonb,
  p_student_class text,
  p_school_name   text,
  p_contact_no    text,
  p_name_to_print text,
  p_is_coordinator boolean,
  p_payment_note  text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller   uuid := auth.uid();
  v_tracking text;
  v_order_id text;
  v_total    integer := 0;
  v_item     jsonb;
  v_price    integer;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE = 'PT401';
  END IF;
  IF trim(p_name_to_print) = '' THEN
    RAISE EXCEPTION 'Name to print is required' USING ERRCODE = 'PT400';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No items in order' USING ERRCODE = 'PT400';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT "price" INTO v_price FROM public."MerchItem"
     WHERE "id" = (v_item->>'itemId') AND "available" = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item not found or unavailable' USING ERRCODE = 'PT400';
    END IF;
    v_total := v_total + v_price * (v_item->>'quantity')::integer;
  END LOOP;

  LOOP
    v_tracking := 'MERCH-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public."MerchOrder" WHERE "trackingId" = v_tracking);
  END LOOP;

  INSERT INTO public."MerchOrder"
    ("trackingId","userId","studentClass","schoolName","contactNo","nameToPrint","isCoordinator","totalPaise","paymentNote")
  VALUES
    (v_tracking, v_caller, p_student_class, p_school_name, p_contact_no, trim(p_name_to_print), p_is_coordinator, v_total, p_payment_note)
  RETURNING "id" INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT "price" INTO v_price FROM public."MerchItem" WHERE "id" = (v_item->>'itemId');
    INSERT INTO public."MerchOrderItem" ("orderId","itemId","size","quantity","pricePaise")
    VALUES (v_order_id, v_item->>'itemId', v_item->>'size', (v_item->>'quantity')::integer, v_price);
  END LOOP;

  PERFORM private.merch_order_confirm_mail(v_order_id);

  RETURN jsonb_build_object('orderId', v_order_id, 'trackingId', v_tracking, 'totalPaise', v_total);
END $$;

CREATE OR REPLACE FUNCTION public.my_merch_orders()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Login required' USING ERRCODE = 'PT401';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id',             o."id",
        'trackingId',     o."trackingId",
        'status',         o."status",
        'totalPaise',     o."totalPaise",
        'nameToPrint',    o."nameToPrint",
        'createdAt',      o."createdAt",
        'verifiedAt',     o."verifiedAt",
        'items', (
          SELECT jsonb_agg(jsonb_build_object(
            'name',       mi."name",
            'size',       oi."size",
            'quantity',   oi."quantity",
            'pricePaise', oi."pricePaise"
          ))
          FROM public."MerchOrderItem" oi
          JOIN public."MerchItem" mi ON mi."id" = oi."itemId"
          WHERE oi."orderId" = o."id"
        )
      ) ORDER BY o."createdAt" DESC
    )
    FROM public."MerchOrder" o WHERE o."userId" = v_caller),
    '[]'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.merch_order_by_tracking(p_tracking_id text)
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',           o."id",
    'trackingId',   o."trackingId",
    'status',       o."status",
    'totalPaise',   o."totalPaise",
    'nameToPrint',  o."nameToPrint",
    'studentClass', o."studentClass",
    'schoolName',   o."schoolName",
    'createdAt',    o."createdAt",
    'verifiedAt',   o."verifiedAt",
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'name',       mi."name",
        'size',       oi."size",
        'quantity',   oi."quantity",
        'pricePaise', oi."pricePaise"
      ))
      FROM public."MerchOrderItem" oi
      JOIN public."MerchItem" mi ON mi."id" = oi."itemId"
      WHERE oi."orderId" = o."id"
    )
  )
    INTO v_order
    FROM public."MerchOrder" o
   WHERE o."trackingId" = p_tracking_id;

  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN v_order;
END $$;

CREATE OR REPLACE FUNCTION public.merch_active_qr()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row jsonb;
BEGIN
  SELECT jsonb_build_object('id', q."id", 'upiId', q."upiId", 'storagePath', q."storagePath", 'label', q."label")
    INTO v_row FROM public."MerchUpiQr" q WHERE q."isActive" = true LIMIT 1;
  RETURN v_row;
END $$;

-- 6. ADMIN PRODUCT MANAGEMENT RPCS

-- Get all products (admin sees both available & unavailable)
CREATE OR REPLACE FUNCTION public.admin_merch_items()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id',        m."id",
        'name',      m."name",
        'type',      m."type",
        'variant',   m."variant",
        'price',     m."price",
        'imageSrc',  m."imageSrc",
        'available', m."available",
        'sizes',     m."sizes",
        'createdAt', m."createdAt"
      ) ORDER BY m."createdAt" DESC
    ) FROM public."MerchItem" m),
    '[]'::jsonb
  );
END $$;

-- Create product
CREATE OR REPLACE FUNCTION public.admin_merch_create_item(
  p_name      text,
  p_type      text,
  p_variant   text,
  p_price     integer,
  p_image_src text,
  p_sizes     text[],
  p_available boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Product name is required' USING ERRCODE = 'PT400';
  END IF;
  IF p_price <= 0 THEN
    RAISE EXCEPTION 'Price must be greater than zero' USING ERRCODE = 'PT400';
  END IF;

  INSERT INTO public."MerchItem" ("name", "type", "variant", "price", "imageSrc", "sizes", "available")
  VALUES (trim(p_name), upper(trim(p_type)), upper(trim(p_variant)), p_price, trim(p_image_src), p_sizes, p_available)
  RETURNING "id" INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'ok', true);
END $$;

-- Update product
CREATE OR REPLACE FUNCTION public.admin_merch_update_item(
  p_id        text,
  p_name      text,
  p_type      text,
  p_variant   text,
  p_price     integer,
  p_image_src text,
  p_sizes     text[],
  p_available boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  IF trim(p_name) = '' THEN
    RAISE EXCEPTION 'Product name is required' USING ERRCODE = 'PT400';
  END IF;

  UPDATE public."MerchItem"
     SET "name" = trim(p_name),
         "type" = upper(trim(p_type)),
         "variant" = upper(trim(p_variant)),
         "price" = p_price,
         "imageSrc" = trim(p_image_src),
         "sizes" = p_sizes,
         "available" = p_available
   WHERE "id" = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'PT404';
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

-- Quick toggle product availability
CREATE OR REPLACE FUNCTION public.admin_merch_toggle_item(p_id text, p_available boolean)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  UPDATE public."MerchItem" SET "available" = p_available WHERE "id" = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Delete product (fails gracefully if product has existing orders)
CREATE OR REPLACE FUNCTION public.admin_merch_delete_item(p_id text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  IF EXISTS (SELECT 1 FROM public."MerchOrderItem" WHERE "itemId" = p_id) THEN
    -- If product is in past orders, soft-delete by marking unavailable
    UPDATE public."MerchItem" SET "available" = false WHERE "id" = p_id;
    RETURN jsonb_build_object('ok', true, 'softDeleted', true);
  END IF;

  DELETE FROM public."MerchItem" WHERE "id" = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true, 'deleted', true);
END $$;

-- 7. ADMIN ORDERS & QR RPCS

CREATE OR REPLACE FUNCTION public.admin_merch_orders()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object(
        'id',            o."id",
        'trackingId',    o."trackingId",
        'status',        o."status",
        'totalPaise',    o."totalPaise",
        'nameToPrint',   o."nameToPrint",
        'studentClass',  o."studentClass",
        'schoolName',    o."schoolName",
        'contactNo',     o."contactNo",
        'paymentNote',   o."paymentNote",
        'isCoordinator', o."isCoordinator",
        'createdAt',     o."createdAt",
        'verifiedAt',    o."verifiedAt",
        'buyerName',     u."name",
        'buyerEmail',    u."email",
        'items', (
          SELECT jsonb_agg(jsonb_build_object(
            'name',       mi."name",
            'type',       mi."type",
            'size',       oi."size",
            'quantity',   oi."quantity",
            'pricePaise', oi."pricePaise"
          ))
          FROM public."MerchOrderItem" oi
          JOIN public."MerchItem" mi ON mi."id" = oi."itemId"
          WHERE oi."orderId" = o."id"
        )
      ) ORDER BY o."createdAt" DESC
    )
    FROM public."MerchOrder" o
    JOIN public."User" u ON u."id" = o."userId"),
    '[]'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_merch_verify_payment(p_order_id text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_status text;
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  SELECT "status" INTO v_status FROM public."MerchOrder" WHERE "id" = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'PT404';
  END IF;
  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'Order is already %', v_status USING ERRCODE = 'PT400';
  END IF;

  UPDATE public."MerchOrder"
     SET "status" = 'PAID', "verifiedAt" = now(), "verifiedById" = v_caller
   WHERE "id" = p_order_id;

  PERFORM private.merch_payment_verified_mail(p_order_id);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_merch_upi_qrs()
  RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(
      jsonb_build_object('id', q."id", 'label', q."label", 'storagePath', q."storagePath",
                         'upiId', q."upiId", 'isActive', q."isActive", 'createdAt', q."createdAt")
      ORDER BY q."createdAt" DESC
    ) FROM public."MerchUpiQr" q),
    '[]'::jsonb
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_merch_add_qr(p_label text, p_storage_path text, p_upi_id text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  IF (SELECT count(*) FROM public."MerchUpiQr") >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 QR codes allowed. Delete one first.' USING ERRCODE = 'PT400';
  END IF;
  INSERT INTO public."MerchUpiQr" ("label", "storagePath", "upiId")
  VALUES (p_label, p_storage_path, p_upi_id)
  RETURNING "id" INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_merch_set_active_qr(p_qr_id text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  UPDATE public."MerchUpiQr" SET "isActive" = ("id" = p_qr_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_merch_delete_qr(p_qr_id text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.my_admin() THEN
    RAISE EXCEPTION 'Admin only' USING ERRCODE = 'PT403';
  END IF;
  DELETE FROM public."MerchUpiQr" WHERE "id" = p_qr_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
