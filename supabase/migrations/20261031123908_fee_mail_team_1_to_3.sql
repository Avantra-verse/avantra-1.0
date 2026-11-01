-- Fee email: exhibition teams are now 1, 2 or 3 students (was exactly 3).
CREATE OR REPLACE FUNCTION private.fee_confirmed_mail(p_student uuid, p_amount_paise integer, p_reference text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT private.queue_mail(u."email", 'AVANTRA 2026: exhibition fee received',
    format(E'Payment of ₹%s received. Your place in the Science & Innovation Exhibition is confirmed.\nYour AVANTRA ID: %s\n\nNext: create your team (1, 2 or 3 students) and share its code with your teammates, or join a friend''s team with their code. Entering on your own? Create a team anyway: a team of 1 is fine. Open your dashboard and tap Create team.\nhttps://avantra.arithi.in/dashboard/teams\n\nYour entry badge is unlocked on your dashboard too.\nPayment reference: %s',
      p_amount_paise / 100, s."avantraId", p_reference))
  FROM public."User" u JOIN public."Student" s ON s."userId" = u."id" WHERE u."id" = p_student
$function$;
