-- Merch, from Vishesh's draft: order and payment emails, at most 3 QR codes, and deleting an item that has orders hides it.

CREATE FUNCTION private.merch_mail(p_order_id text, p_kind text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.queue_mail(u."email",
    CASE p_kind WHEN 'placed' THEN 'AVANTRA 2026 merch: order placed' ELSE 'AVANTRA 2026 merch: payment confirmed' END,
    format(E'Hi %s,\n\n%s\n\nTracking ID: %s\nTrack your order: https://avantra.arithi.in/merch/track/%s\n\nItems:\n%s\n\nTotal: ₹%s',
      u."name",
      CASE p_kind WHEN 'placed'
        THEN 'Your order is placed. We will confirm it once we have checked your UPI payment.'
        ELSE 'We have confirmed your payment. Your order is now being made.' END,
      o."trackingId", o."trackingId",
      (SELECT string_agg(format('- %s, size %s x %s: ₹%s', i."name", nullif(oi."size", ''), oi."quantity", oi."pricePaise" * oi."quantity" / 100), E'\n' ORDER BY i."name")
         FROM public."MerchOrderItem" oi JOIN public."MerchItem" i ON i."id" = oi."itemId" WHERE oi."orderId" = o."id"),
      o."totalPaise" / 100))
  FROM public."MerchOrder" o JOIN public."User" u ON u."id" = o."buyerId" WHERE o."id" = p_order_id
$$;
REVOKE ALL ON FUNCTION private.merch_mail(text, text) FROM PUBLIC, anon, authenticated;

-- Send the "placed" mail after the order and its lines are written.
CREATE FUNCTION private.merch_order_mail_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."totalPaise" = 0 AND NEW."totalPaise" > 0 THEN PERFORM private.merch_mail(NEW."id", 'placed'); END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'PENDING' AND NEW."status" = 'PAID' THEN PERFORM private.merch_mail(NEW."id", 'paid'); END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.merch_order_mail_trigger() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER "MerchOrder_mail" AFTER UPDATE ON public."MerchOrder" FOR EACH ROW EXECUTE FUNCTION private.merch_order_mail_trigger();

CREATE OR REPLACE FUNCTION public.admin_merch_delete_item(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF EXISTS (SELECT 1 FROM public."MerchOrderItem" WHERE "itemId" = p_id) THEN
    UPDATE public."MerchItem" SET "available" = false WHERE "id" = p_id;
    RETURN jsonb_build_object('ok', true, 'hidden', true);
  END IF;
  DELETE FROM public."MerchItem" WHERE "id" = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found' USING ERRCODE = 'PT404'; END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_merch_add_qr(p_label text, p_storage_path text, p_upi_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id text;
BEGIN
  PERFORM private.my_admin();
  PERFORM pg_advisory_xact_lock(hashtext('merch_qr'));
  IF (SELECT count(*) FROM public."MerchUpiQr") >= 3 THEN
    RAISE EXCEPTION 'You can keep at most 3 QR codes. Delete one first.' USING ERRCODE = 'PT409';
  END IF;
  INSERT INTO public."MerchUpiQr" ("label", "storagePath", "upiId", "isActive")
    VALUES (trim(p_label), p_storage_path, trim(p_upi_id), NOT EXISTS (SELECT 1 FROM public."MerchUpiQr" WHERE "isActive"))
    RETURNING "id" INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END $$;
