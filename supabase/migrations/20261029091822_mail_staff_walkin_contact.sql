-- Emails, staff accounts, walk-ins and the contact form: the last parts of the old API.
-- Emails: functions add rows to private.mail_outbox in the same transaction as the change they report, so a rolled-back
-- change sends nothing. The send-mail Edge Function (supabase/functions/send-mail) sends them over SMTP and retries failures.
-- Staff and walk-in accounts: the site's route handlers make the Auth user with the secret key, then call the admin functions below.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ---- outbox ----

CREATE TABLE private.mail_outbox (
  "id" bigserial PRIMARY KEY,
  "to" text NOT NULL,
  "subject" text NOT NULL,
  "text" text NOT NULL,
  "replyTo" text,
  "attempts" int NOT NULL DEFAULT 0, -- given up after 5; "lastError" says why
  "nextTryAt" timestamptz NOT NULL DEFAULT now(),
  "sentAt" timestamptz,
  "lastError" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_outbox_due ON private.mail_outbox ("nextTryAt") WHERE "sentAt" IS NULL AND "attempts" < 5;
ALTER TABLE private.mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mail_outbox FROM PUBLIC, anon, authenticated;

-- Wakes the send-mail function. Its URL is the Vault secret "send_mail_url" (set once per project, see README); unset = no-op.
-- pg_net sends after commit, so a rolled-back change never wakes it.
CREATE FUNCTION private.kick_mail() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_url text := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'send_mail_url');
BEGIN
  IF v_url IS NOT NULL THEN PERFORM net.http_post(v_url, '{}'::jsonb, timeout_milliseconds => 1000); END IF;
END $$;

CREATE FUNCTION private.kick_mail_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.kick_mail();
  RETURN NULL;
END $$;
CREATE TRIGGER mail_outbox_kick AFTER INSERT ON private.mail_outbox FOR EACH STATEMENT EXECUTE FUNCTION private.kick_mail_trigger();

-- Retries: once a minute, only when something is due.
SELECT cron.schedule('send-mail-retry', '* * * * *', $$
  SELECT private.kick_mail() WHERE EXISTS (SELECT 1 FROM private.mail_outbox WHERE "sentAt" IS NULL AND "attempts" < 5 AND "nextTryAt" <= now())
$$);

CREATE FUNCTION private.queue_mail(p_to text, p_subject text, p_text text, p_reply_to text DEFAULT NULL) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO private.mail_outbox ("to", "subject", "text", "replyTo") VALUES (p_to, p_subject, p_text, p_reply_to)
$$;

-- Same email for every way of paying: UPI (school's check imported) and cash (admin desk). Text as in the old API.
CREATE FUNCTION private.fee_confirmed_mail(p_student uuid, p_amount_paise int, p_reference text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.queue_mail(u."email", 'AVANTRA 2026: exhibition fee received',
    format(E'Payment of ₹%s received. You can now register for the Science & Innovation Exhibition.\nYour AVANTRA ID: %s\n\nNext: register for the exhibition and form your team.\nPayment reference: %s',
      p_amount_paise / 100, s."avantraId", p_reference))
  FROM public."User" u JOIN public."Student" s ON s."userId" = u."id" WHERE u."id" = p_student
$$;

-- The school's bank statement doesn't show this UPI payment: the student can check the UTR and send it again.
CREATE FUNCTION private.upi_failed_mail(p_student uuid, p_utr text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.queue_mail(u."email", 'AVANTRA 2026: we could not confirm your payment',
    format(E'The school could not find your ₹199 UPI payment with UTR %s in its bank statement.\nYour AVANTRA ID: %s\n\nOpen your dashboard to check the UTR and send it again, or pay again if the payment did not go through.',
      p_utr, s."avantraId"))
  FROM public."User" u JOIN public."Student" s ON s."userId" = u."id" WHERE u."id" = p_student
$$;

-- ---- fee emails on the existing admin functions ----

CREATE OR REPLACE FUNCTION public.admin_mark_paid(p_avantra_id text, p_note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  admin uuid := private.my_admin();
  v_note text := nullif(trim(p_note), '');
  s public."Student";
BEGIN
  IF length(v_note) > 200 THEN RAISE EXCEPTION 'At most 200 characters' USING ERRCODE = 'PT400', HINT = 'note'; END IF;
  SELECT * INTO s FROM public."Student" WHERE "avantraId" = upper(trim(p_avantra_id)) FOR UPDATE; -- two admins clicking at once
  IF s IS NULL THEN RAISE EXCEPTION 'Unknown AVANTRA ID' USING ERRCODE = 'PT404'; END IF;
  IF s."feePaidAt" IS NOT NULL THEN RAISE EXCEPTION 'Fee already paid' USING ERRCODE = 'PT409'; END IF;
  UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = s."userId";
  INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
  VALUES (s."userId", 19900, 'OFFLINE', 'PAID', admin, v_note);
  PERFORM private.fee_confirmed_mail(s."userId", 19900, coalesce(v_note, 'cash at desk'));
  RETURN jsonb_build_object('avantraId', s."avantraId", 'name', (SELECT "name" FROM public."User" WHERE "id" = s."userId"), 'feePaid', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_upi_decide(p_decisions jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  admin uuid := private.my_admin();
  d jsonb;
  p public."Payment";
  s public."Student";
  result text;
  results jsonb := '[]';
BEGIN
  FOR d IN SELECT * FROM jsonb_array_elements(p_decisions) LOOP
    IF d->>'status' NOT IN ('PAID', 'FAILED') THEN RAISE EXCEPTION 'status must be PAID or FAILED' USING ERRCODE = 'PT400'; END IF;
    SELECT x.* INTO p FROM public."Payment" x JOIN public."Student" y ON y."userId" = x."studentId"
    WHERE x."method" = 'UPI' AND x."utr" = d->>'utr' AND y."avantraId" = upper(d->>'avantraId')
    ORDER BY x."createdAt" DESC LIMIT 1 FOR UPDATE OF x; -- two admins importing at once can't both apply a row
    IF p IS NULL THEN
      result := 'missing';
    ELSIF p."status" <> 'CREATED' THEN
      result := 'already';
    ELSE
      UPDATE public."Payment" SET "status" = (d->>'status')::public."PaymentStatus", "recordedById" = admin, "updatedAt" = now() WHERE "id" = p."id";
      SELECT * INTO s FROM public."Student" WHERE "userId" = p."studentId" FOR UPDATE;
      IF d->>'status' = 'FAILED' THEN
        result := 'failed';
        PERFORM private.upi_failed_mail(s."userId", p."utr");
      ELSIF s."feePaidAt" IS NOT NULL THEN result := 'double'; -- no email: the admin refunds one
      ELSE
        UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = s."userId";
        result := 'paid';
        PERFORM private.fee_confirmed_mail(s."userId", p."amountPaise", 'UPI ' || p."utr");
      END IF;
    END IF;
    results := results || jsonb_build_object('row', d->'row', 'avantraId', upper(d->>'avantraId'), 'utr', d->>'utr', 'result', result);
    p := NULL;
  END LOOP;
  RETURN results;
END $$;

-- ---- student profile, shared by the profile step and walk-ins ----

-- Same rules as StudentProfile in packages/shared; errors carry the field name in HINT.
CREATE FUNCTION private.insert_student(uid uuid, profile jsonb) RETURNS public."Student" LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_phone text := profile->>'phone';
  v_grade int;
  v_school text := trim(profile->>'schoolName');
  v_section text := nullif(upper(trim(profile->>'section')), '');
  v_ref text := nullif(upper(trim(profile->>'referralCode')), '');
  v_g_email text := nullif(lower(trim(profile->>'guardianEmail')), '');
  v_g_phone text := nullif(profile->>'guardianPhone', '');
  s public."Student";
BEGIN
  IF v_phone IS NULL OR v_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING HINT = 'phone'; END IF;
  BEGIN v_grade := (profile->>'grade')::int; EXCEPTION WHEN others THEN v_grade := NULL; END;
  IF v_grade IS NULL OR v_grade NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Pick your class.' USING HINT = 'grade'; END IF;
  IF v_school IS NULL OR length(v_school) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Type your school name' USING HINT = 'schoolName'; END IF;
  IF length(v_section) > 10 THEN RAISE EXCEPTION 'At most 10 characters' USING HINT = 'section'; END IF;
  IF v_ref IS NOT NULL AND v_ref !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'Ambassador codes are 6 letters and numbers' USING HINT = 'referralCode'; END IF;
  IF v_g_email IS NOT NULL AND (length(v_g_email) > 254 OR v_g_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'Enter a valid email' USING HINT = 'guardianEmail'; END IF;
  IF v_g_phone IS NOT NULL AND v_g_phone !~ '^[6-9][0-9]{9}$' THEN RAISE EXCEPTION 'Enter a 10-digit Indian mobile number' USING HINT = 'guardianPhone'; END IF;
  IF (profile->'guardianConsent') IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'A parent or guardian must agree before you can take part.' USING HINT = 'consent'; END IF;

  UPDATE public."User" SET "phone" = v_phone WHERE "id" = uid;
  FOR attempt IN 1..5 LOOP -- retry when a random ID clashes
    BEGIN
      INSERT INTO public."Student" ("userId", "schoolName", "referralCode", "grade", "section", "guardianEmail", "guardianPhone",
        "guardianConsentAt", "avantraId", "qrToken")
      VALUES (uid, v_school, v_ref, v_grade, v_section, v_g_email, v_g_phone, now(), 'AV26-' || private.random_code(5),
        translate(encode(extensions.gen_random_bytes(16), 'base64'), '+/=', '-_'))
      RETURNING * INTO s;
      RETURN s;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_student_profile(profile jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.my_role() IS DISTINCT FROM 'STUDENT' THEN RAISE EXCEPTION 'Log in as a student first' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public."Student" WHERE "userId" = auth.uid()) THEN RAISE EXCEPTION 'Profile already exists' USING ERRCODE = '23505'; END IF;
  RETURN to_jsonb(private.insert_student(auth.uid(), profile));
END $$;

-- ---- accounts made by an admin (route handlers create the Auth user first) ----
-- Both only touch an account made in the last 10 minutes, so they can't take over an existing one.

-- Staff: the role comes from app_metadata (handle_new_user); this sets the judge's event and the end date.
-- Staff accounts stop working the day after the event unless the admin sets another date.
CREATE FUNCTION public.admin_staff_setup(p_user_id uuid, p_event_id text DEFAULT NULL, p_expires_at timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public."Role";
BEGIN
  PERFORM private.my_admin();
  SELECT "role" INTO r FROM public."User" WHERE "id" = p_user_id AND "role" IN ('VOLUNTEER', 'JUDGE') AND "createdAt" > now() - interval '10 minutes';
  IF r IS NULL THEN RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404'; END IF;
  IF p_expires_at <= now() THEN RAISE EXCEPTION 'Pick a date in the future' USING ERRCODE = 'PT400', HINT = 'expiresAt'; END IF;
  IF r = 'JUDGE' AND NOT EXISTS (SELECT 1 FROM public."Event" WHERE "id" = p_event_id) THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'PT404', HINT = 'eventId';
  END IF;
  UPDATE public."User" SET "assignedEventId" = CASE WHEN r = 'JUDGE' THEN p_event_id END,
    "expiresAt" = coalesce(p_expires_at, '2026-12-21T23:59:59+05:30') WHERE "id" = p_user_id;
  RETURN private.staff_json(p_user_id);
END $$;

-- Walk-in at the desk: profile + cash fee for an Auth user just made without a password. They set one with "Forgot password".
CREATE FUNCTION public.admin_walk_in(p_user_id uuid, p_profile jsonb, p_note text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  admin uuid := private.my_admin();
  v_note text := nullif(trim(p_note), '');
  u public."User";
  s public."Student";
BEGIN
  IF length(v_note) > 200 THEN RAISE EXCEPTION 'At most 200 characters' USING ERRCODE = 'PT400', HINT = 'note'; END IF;
  SELECT * INTO u FROM public."User" WHERE "id" = p_user_id AND "role" = 'STUDENT' AND "createdAt" > now() - interval '10 minutes' FOR UPDATE;
  IF u IS NULL OR EXISTS (SELECT 1 FROM public."Student" WHERE "userId" = p_user_id) THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404';
  END IF;
  s := private.insert_student(p_user_id, p_profile);
  UPDATE public."Student" SET "feePaidAt" = now() WHERE "userId" = p_user_id;
  INSERT INTO public."Payment" ("studentId", "amountPaise", "method", "status", "recordedById", "note")
  VALUES (p_user_id, 19900, 'OFFLINE', 'PAID', admin, v_note);
  PERFORM private.queue_mail(u."email", 'AVANTRA 2026: exhibition fee received',
    format(E'%s is registered for AVANTRA 2026 and the Science Exhibition (paid ₹199 at the desk).\nAVANTRA ID: %s\n\nTo log in, open the AVANTRA site, choose "Forgot password" and enter this email to set a password.',
      u."name", s."avantraId"));
  RETURN jsonb_build_object('avantraId', s."avantraId", 'qrToken', s."qrToken", 'name', u."name");
END $$;

-- ---- "Write to the team" ----

-- Emailed to the Setting "contactTo" (comma-separated), or to every active admin until that's set. Reply-to = the sender.
CREATE FUNCTION public.contact_message(p_name text, p_email text, p_message text, p_school text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text := trim(p_name);
  v_email text := lower(trim(p_email));
  v_message text := trim(p_message);
  v_school text := nullif(trim(p_school), '');
  -- Supabase's gateway sets the caller's IP first in x-forwarded-for.
  v_ip text := split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1);
  v_to text := coalesce(private.setting('contactTo'),
    (SELECT string_agg("email", ', ') FROM public."User" WHERE "role" = 'ADMIN' AND "disabledAt" IS NULL));
BEGIN
  PERFORM private.rate_limit('contact:' || v_ip, 3, 60);
  PERFORM private.rate_limit('contact', 30, 3600); -- all senders together, so a bot with many IPs can't flood the inbox
  IF v_name IS NULL OR length(v_name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Enter your name' USING ERRCODE = 'PT400', HINT = 'name'; END IF;
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email' USING ERRCODE = 'PT400', HINT = 'email'; END IF;
  IF v_message IS NULL OR length(v_message) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Write a little more' USING ERRCODE = 'PT400', HINT = 'message'; END IF;
  IF length(v_school) > 150 THEN RAISE EXCEPTION 'At most 150 characters' USING ERRCODE = 'PT400', HINT = 'school'; END IF;
  IF v_to IS NULL THEN RETURN; END IF;
  -- Name has no line breaks, so it can't add lines to the subject.
  PERFORM private.queue_mail(v_to, 'AVANTRA website: message from ' || regexp_replace(v_name, '\s+', ' ', 'g'),
    format(E'%s <%s>%s\n\n%s\n\nReply to this email to answer them.', v_name, v_email, coalesce(E'\nSchool: ' || v_school, ''), v_message), v_email);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.my_role() TO anon, authenticated; -- used inside RLS policies
REVOKE ALL ON FUNCTION public.admin_staff_setup(uuid, text, timestamptz), public.admin_walk_in(uuid, jsonb, text), public.contact_message(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_staff_setup(uuid, text, timestamptz), public.admin_walk_in(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contact_message(text, text, text, text) TO anon, authenticated;
