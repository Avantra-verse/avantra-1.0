-- Contact form messages land in an admin "Messages" tab instead of being emailed to every admin.
-- Private schema + RLS on and no grants: only the SECURITY DEFINER functions below reach it.
CREATE TABLE private.contact_message (
  "id" bigserial PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "school" text,
  "message" text NOT NULL,
  "category" text CHECK ("category" IN ('REGISTRATION', 'PAYMENT', 'EVENTS', 'SPONSORSHIP', 'OTHER')), -- null = not sorted yet
  "resolvedAt" timestamptz,
  "resolvedBy" uuid REFERENCES public."User"("id") ON DELETE SET NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.contact_message ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON private.contact_message ("createdAt" DESC);
CREATE INDEX ON private.contact_message ("resolvedBy");

-- Same checks and rate limits as before; stores the message, sends no email.
CREATE OR REPLACE FUNCTION public.contact_message(p_name text, p_email text, p_message text, p_school text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_message text := trim(p_message);
  v_school text := nullif(trim(p_school), '');
  -- Supabase's gateway sets the caller's IP first in x-forwarded-for.
  v_ip text := split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1);
BEGIN
  PERFORM private.rate_limit('contact:' || v_ip, 3, 60);
  PERFORM private.rate_limit('contact', 30, 3600); -- all senders together, so a bot with many IPs can't flood the inbox
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Enter your name' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email' USING ERRCODE = 'PT400', HINT = 'email'; END IF;
  IF v_message IS NULL OR length(v_message) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Write a little more' USING ERRCODE = 'PT400', HINT = 'message'; END IF;
  IF length(v_school) > 150 THEN RAISE EXCEPTION 'At most 150 characters' USING ERRCODE = 'PT400', HINT = 'school'; END IF;
  INSERT INTO private.contact_message ("name", "email", "school", "message") VALUES (v_name, v_email, v_school, v_message);
END $$;

-- Newest first; any admin.
CREATE FUNCTION public.admin_messages() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', m."id", 'name', m."name", 'email', m."email", 'school', m."school",
      'message', m."message", 'category', m."category", 'resolvedAt', m."resolvedAt", 'resolvedBy', u."name", 'createdAt', m."createdAt")
    ORDER BY m."createdAt" DESC)
    FROM private.contact_message m LEFT JOIN public."User" u ON u."id" = m."resolvedBy"), '[]'::jsonb);
END $$;

-- Set the category (null clears it) and resolved state together; the page sends both every time.
CREATE FUNCTION public.admin_message_update(p_id bigint, p_category text, p_resolved boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE admin uuid := private.my_admin();
BEGIN
  IF p_category IS NOT NULL AND p_category NOT IN ('REGISTRATION', 'PAYMENT', 'EVENTS', 'SPONSORSHIP', 'OTHER') THEN
    RAISE EXCEPTION 'Unknown category' USING ERRCODE = 'PT400';
  END IF;
  UPDATE private.contact_message SET "category" = p_category,
    "resolvedAt" = CASE WHEN p_resolved THEN coalesce("resolvedAt", now()) END,
    "resolvedBy" = CASE WHEN p_resolved THEN coalesce("resolvedBy", admin) END
  WHERE "id" = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found' USING ERRCODE = 'PT404'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.admin_messages(), public.admin_message_update(bigint, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_messages(), public.admin_message_update(bigint, text, boolean) TO authenticated;
