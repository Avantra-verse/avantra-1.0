-- Every admin can view People (list + one account); editing and deleting stay super admin only
-- (admin_update_person / admin_delete_person keep private.my_super_admin()).
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.admin_people()', 'public.admin_person(uuid)'] LOOP
    EXECUTE replace(pg_get_functiondef(f::regprocedure), 'PERFORM private.my_super_admin();', 'PERFORM private.my_admin();');
  END LOOP;
END $$;
