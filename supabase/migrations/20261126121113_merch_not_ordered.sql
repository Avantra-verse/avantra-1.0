-- Admin can mark a pending merch order "tried, not ordered" (PENDING -> NOT_ORDERED): no payment, no email to the buyer.
ALTER TABLE public."MerchOrder" DROP CONSTRAINT "MerchOrder_status_check";
ALTER TABLE public."MerchOrder" ADD CONSTRAINT "MerchOrder_status_check"
  CHECK ("status" IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'NOT_ORDERED'));

CREATE OR REPLACE FUNCTION public.admin_merch_update_order_status(p_order_id text, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  IF p_status NOT IN ('SHIPPED', 'DELIVERED', 'CANCELLED', 'NOT_ORDERED') THEN
    RAISE EXCEPTION 'Status must be SHIPPED, DELIVERED, CANCELLED or NOT_ORDERED' USING ERRCODE = 'PT400';
  END IF;
  UPDATE public."MerchOrder" SET "status" = p_status
    WHERE "id" = p_order_id
      AND "status" = CASE p_status WHEN 'SHIPPED' THEN 'PAID' WHEN 'DELIVERED' THEN 'SHIPPED' ELSE 'PENDING' END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, or it is not ready for that step' USING ERRCODE = 'PT409';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
