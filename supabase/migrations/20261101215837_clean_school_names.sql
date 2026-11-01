-- One-time cleanup of typed school names (decided with the organisers 2026-11-02). Exact old values only,
-- so anything typed later is untouched. Plain "SSRVM Rourkela" and "SSRVM IEMS, Sec-29" = the host school.
UPDATE public."Student" SET "schoolName" = CASE
  WHEN "schoolName" IN ('Ssrvm iems', 'SSRVM IEMS', 'SSRVM IEMS SECTOR-20,ROURKELA', 'SSRVM IEMS, Sec-29',
    'SSRVM Ispat English Medium School', 'SSRVM ISPAT ENGLISH MEDIUM SCHOOL', 'SSRVM ispat english medium school',
    'ISPAT ENGLISH MEDIUM SCHOOL', 'SSRVM ROURKELA', 'Ssrvm rourkela', 'SSRVM Rourkela', 'SSRVM,  Rourkela', 'SSRVM , Rourkela')
    THEN 'SSRVM IEMS, Sector 20, Rourkela'
  WHEN "schoolName" = 'SSRVM Ispat Vidya Mandir, Sector-19' THEN 'SSRVM Ispat Vidya Mandir, Sector 19, Rourkela'
  WHEN "schoolName" IN ('Delhi Public School,Rourkela', 'DPS') THEN 'Delhi Public School, Rourkela'
  WHEN "schoolName" = 'krishna vikash ind global school' THEN 'Krishna Vikash Ind Global School'
  ELSE "schoolName" END
WHERE "schoolName" IN ('Ssrvm iems', 'SSRVM IEMS', 'SSRVM IEMS SECTOR-20,ROURKELA', 'SSRVM IEMS, Sec-29',
    'SSRVM Ispat English Medium School', 'SSRVM ISPAT ENGLISH MEDIUM SCHOOL', 'SSRVM ispat english medium school',
    'ISPAT ENGLISH MEDIUM SCHOOL', 'SSRVM ROURKELA', 'Ssrvm rourkela', 'SSRVM Rourkela', 'SSRVM,  Rourkela', 'SSRVM , Rourkela',
    'SSRVM Ispat Vidya Mandir, Sector-19', 'Delhi Public School,Rourkela', 'DPS', 'krishna vikash ind global school');
