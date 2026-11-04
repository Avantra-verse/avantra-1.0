-- Admin can reject a merch payment: PENDING -> CANCELLED, and the buyer gets a "payment not found" email.

CREATE OR REPLACE FUNCTION public.admin_merch_update_order_status(p_order_id text, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF p_status NOT IN ('SHIPPED', 'DELIVERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Status must be SHIPPED, DELIVERED or CANCELLED' USING ERRCODE = 'PT400';
  END IF;
  UPDATE public."MerchOrder" SET "status" = p_status
    WHERE "id" = p_order_id
      AND "status" = CASE p_status WHEN 'SHIPPED' THEN 'PAID' WHEN 'DELIVERED' THEN 'SHIPPED' ELSE 'PENDING' END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, or it is not ready for that step' USING ERRCODE = 'PT409';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION private.merch_mail(p_order_id text, p_kind text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.queue_mail(u."email",
    CASE p_kind WHEN 'placed' THEN 'AVANTRA 2026 merch: order placed'
      WHEN 'rejected' THEN 'AVANTRA 2026 merch: payment not received'
      ELSE 'AVANTRA 2026 merch: payment confirmed' END,
    format(E'Hi %s,\n\n%s\n\nTracking ID: %s\nTrack your order: https://avantra.arithi.in/merch/track/%s\n\nItems:\n%s\n\nTotal: ₹%s',
      u."name",
      CASE p_kind WHEN 'placed'
        THEN 'Your order is placed. We will confirm it once we have checked your UPI payment.'
        WHEN 'rejected'
        THEN 'We could not find your UPI payment for this order, so it has been cancelled. If you did pay, reply to this email with your payment screenshot or UTR. Otherwise you can place a new order on the merch page.'
        ELSE 'We have confirmed your payment. Your order is now being made.' END,
      o."trackingId", o."trackingId",
      (SELECT string_agg(format('- %s, size %s x %s: ₹%s', i."name", nullif(oi."size", ''), oi."quantity", oi."pricePaise" * oi."quantity" / 100), E'\n' ORDER BY i."name")
         FROM public."MerchOrderItem" oi JOIN public."MerchItem" i ON i."id" = oi."itemId" WHERE oi."orderId" = o."id"),
      o."totalPaise" / 100))
  FROM public."MerchOrder" o JOIN public."User" u ON u."id" = o."buyerId" WHERE o."id" = p_order_id
$$;
REVOKE ALL ON FUNCTION private.merch_mail(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.merch_order_mail_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."totalPaise" = 0 AND NEW."totalPaise" > 0 THEN PERFORM private.merch_mail(NEW."id", 'placed'); END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'PENDING' AND NEW."status" = 'PAID' THEN PERFORM private.merch_mail(NEW."id", 'paid'); END IF;
  IF TG_OP = 'UPDATE' AND OLD."status" = 'PENDING' AND NEW."status" = 'CANCELLED' THEN PERFORM private.merch_mail(NEW."id", 'rejected'); END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.merch_order_mail_trigger() FROM PUBLIC, anon, authenticated;
