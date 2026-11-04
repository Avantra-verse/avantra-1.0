-- Add multi-image gallery support to MerchItem.
-- imageSrc remains as the primary/thumbnail image.
-- images holds ALL image URLs (admin can include imageSrc here too).

ALTER TABLE public."MerchItem"
  ADD COLUMN IF NOT EXISTS "images" text[] NOT NULL DEFAULT '{}';

-- Admin update function: add images param
CREATE OR REPLACE FUNCTION public.admin_merch_create_item(
  p_name text,
  p_type text,
  p_variant text,
  p_price integer,
  p_image_src text,
  p_sizes text[],
  p_available boolean,
  p_images text[] DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id text;
BEGIN
  PERFORM private.my_admin();
  INSERT INTO public."MerchItem" ("name","type","variant","price","imageSrc","sizes","available","images")
  VALUES (trim(p_name), p_type, trim(p_variant), p_price, trim(p_image_src), p_sizes, p_available, p_images)
  RETURNING "id" INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_merch_update_item(
  p_id text,
  p_name text,
  p_type text,
  p_variant text,
  p_price integer,
  p_image_src text,
  p_sizes text[],
  p_available boolean,
  p_images text[] DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  UPDATE public."MerchItem"
  SET
    "name"      = trim(p_name),
    "type"      = p_type,
    "variant"   = trim(p_variant),
    "price"     = p_price,
    "imageSrc"  = trim(p_image_src),
    "sizes"     = p_sizes,
    "available" = p_available,
    "images"    = COALESCE(p_images, "images")
  WHERE "id" = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

