-- Wall difficulty is now 1–5 (was 1–8): levels 6–8 become 5. Points were stored when each challenge was made, so they stay.
UPDATE "WallChallenge" SET "difficulty" = 5 WHERE "difficulty" > 5;
