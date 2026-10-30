-- Super admin: an admin who can also add, switch off and remove other admins. Regular admins can't touch
-- admin accounts (admin_set_disabled already skips ADMIN rows). The flag is only set here, by migration:
-- no API role can write "User" directly, and no function sets it.
ALTER TABLE public."User" ADD COLUMN "superAdmin" boolean NOT NULL DEFAULT false;
UPDATE public."User" SET "superAdmin" = true WHERE "email" = 'adarshanshuman6@gmail.com' AND "role" = 'ADMIN';

CREATE FUNCTION private.my_super_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.my_role() IS DISTINCT FROM 'ADMIN' OR NOT (SELECT "superAdmin" FROM public."User" WHERE "id" = auth.uid()) THEN
    RAISE EXCEPTION 'Only the super admin can manage admins' USING ERRCODE = 'PT403';
  END IF;
  RETURN auth.uid();
END $$;

-- An admin account the super admin may change: another admin, never a super admin (so never themselves).
CREATE FUNCTION private.managed_admin(p_user_id uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_super_admin();
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE "id" = p_user_id AND "role" = 'ADMIN' AND NOT "superAdmin") THEN
    RAISE EXCEPTION 'Admin not found' USING ERRCODE = 'PT404';
  END IF;
END $$;

CREATE FUNCTION public.admin_admins() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_super_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', "id", 'name', "name", 'email', "email", 'superAdmin', "superAdmin",
      'disabledAt', "disabledAt", 'createdAt', "createdAt") ORDER BY "superAdmin" DESC, "name")
    FROM public."User" WHERE "role" = 'ADMIN'), '[]');
END $$;

-- Finishes an admin account the route handler just made with the secret key (app/admin/admins/route.ts).
CREATE FUNCTION public.admin_admin_setup(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_super_admin();
  IF NOT EXISTS (SELECT 1 FROM public."User" WHERE "id" = p_user_id AND "role" = 'ADMIN' AND NOT "superAdmin"
      AND "createdAt" > now() - interval '10 minutes') THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'PT404';
  END IF;
  RETURN (SELECT jsonb_build_object('id', "id", 'name', "name", 'email', "email") FROM public."User" WHERE "id" = p_user_id);
END $$;

CREATE FUNCTION public.admin_set_admin_disabled(p_user_id uuid, p_disabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.managed_admin(p_user_id);
  UPDATE public."User" SET "disabledAt" = CASE WHEN p_disabled THEN coalesce("disabledAt", now()) END WHERE "id" = p_user_id;
  IF p_disabled THEN DELETE FROM auth.sessions WHERE "user_id" = p_user_id; END IF;
END $$;

-- The route handler calls this before deleting the Auth user, so only the super admin can remove an admin.
CREATE FUNCTION public.admin_check_removable(p_user_id uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.managed_admin(p_user_id);
END $$;

REVOKE ALL ON FUNCTION private.my_super_admin(), private.managed_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_admins(), public.admin_admin_setup(uuid), public.admin_set_admin_disabled(uuid, boolean),
  public.admin_check_removable(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_admins(), public.admin_admin_setup(uuid), public.admin_set_admin_disabled(uuid, boolean),
  public.admin_check_removable(uuid) TO authenticated;
