-- Auth's admin createUser saves app_metadata in a second write after the insert, so handle_new_user sees no role
-- and every staff account started as STUDENT. Copy the role across when app_metadata changes too.
-- Only the secret key can write app_metadata; users can't reach it.
CREATE FUNCTION private.handle_user_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public."User" SET "role" = (NEW.raw_app_meta_data->>'role')::public."Role"
  WHERE "id" = NEW.id AND "role" IS DISTINCT FROM (NEW.raw_app_meta_data->>'role')::public."Role";
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.handle_user_role() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_role AFTER UPDATE OF raw_app_meta_data ON auth.users FOR EACH ROW
  WHEN (NEW.raw_app_meta_data->>'role' IS NOT NULL AND NEW.raw_app_meta_data->>'role' IS DISTINCT FROM OLD.raw_app_meta_data->>'role')
  EXECUTE FUNCTION private.handle_user_role();
