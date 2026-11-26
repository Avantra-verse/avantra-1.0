-- Super admin can correct a merch order's status (e.g. PAID by mistake -> PENDING / CANCELLED / NOT_ORDERED).
-- Only from a non-PENDING status: the mail trigger fires on PENDING -> PAID/CANCELLED only, so no email is ever sent.
-- PENDING orders keep the normal Verify / Reject / Tried-not-ordered buttons.
CREATE FUNCTION public.admin_merch_set_status(p_order_id text, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_admin uuid := private.my_super_admin();
BEGIN
  IF p_status NOT IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'NOT_ORDERED') THEN
    RAISE EXCEPTION 'Unknown status' USING ERRCODE = 'PT400';
  END IF;
  UPDATE public."MerchOrder"
    SET "status" = p_status,
        "verifiedAt" = CASE WHEN p_status IN ('PAID', 'SHIPPED', 'DELIVERED') THEN coalesce("verifiedAt", now()) END,
        "verifiedBy" = CASE WHEN p_status IN ('PAID', 'SHIPPED', 'DELIVERED') THEN coalesce("verifiedBy", v_admin) END
    WHERE "id" = p_order_id AND "status" <> 'PENDING' AND "status" <> p_status;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found, already in that status, or still pending (use the pending buttons)' USING ERRCODE = 'PT409';
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.admin_merch_set_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_merch_set_status(text, text) TO authenticated;
