-- Admin Teams tab: every team with its members' class, school and fee status. Any admin can read.
CREATE FUNCTION public.admin_teams() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.my_admin();
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', t."id", 'name', t."name", 'eventId', e."id", 'event', e."name",
      'projectTitle', t."projectTitle", 'topic', t."topic", 'rank', t."rank", 'createdAt', t."createdAt",
      'members', coalesce((SELECT jsonb_agg(jsonb_build_object('name', u."name", 'avantraId', s."avantraId", 'grade', s."grade",
          'section', s."section", 'school', s."schoolName", 'isLeader', m."isLeader", 'paid', s."feePaidAt" IS NOT NULL)
          ORDER BY m."isLeader" DESC, m."joinedAt")
        FROM public."TeamMember" m JOIN public."Registration" r ON r."id" = m."registrationId"
        JOIN public."Student" s ON s."userId" = r."studentId" JOIN public."User" u ON u."id" = s."userId"
        WHERE m."teamId" = t."id"), '[]'::jsonb))
    ORDER BY e."name", t."createdAt" DESC)
    FROM public."Team" t JOIN public."Event" e ON e."id" = t."eventId"), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.admin_teams() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_teams() TO authenticated;
