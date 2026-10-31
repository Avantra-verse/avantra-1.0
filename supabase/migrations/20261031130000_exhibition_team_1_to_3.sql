-- The exhibition now takes teams of 1, 2 or 3 (was exactly 3).
UPDATE "Event" SET "teamMin" = 1 WHERE "slug" = 'exhibition';
