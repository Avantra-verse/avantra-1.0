-- Students register (theme) before paying now, so the "fee received" email points straight to forming a team.
CREATE OR REPLACE FUNCTION private.fee_confirmed_mail(p_student uuid, p_amount_paise int, p_reference text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.queue_mail(u."email", 'AVANTRA 2026: exhibition fee received',
    format(E'Payment of ₹%s received. Your place in the Science & Innovation Exhibition is confirmed.\nYour AVANTRA ID: %s\n\nNext: create your team of 3 and share its code with your teammates, or join a friend''s team with their code. Open your dashboard and tap Create team.\nhttps://avantra.arithi.in/dashboard/teams\n\nYour entry badge is unlocked on your dashboard too.\nPayment reference: %s',
      p_amount_paise / 100, s."avantraId", p_reference))
  FROM public."User" u JOIN public."Student" s ON s."userId" = u."id" WHERE u."id" = p_student
$$;
