-- The brochure's events (was apps/api/scripts/seed-events.ts). Updates by slug, safe to re-run.
-- Teams of 3: required for the exhibition, optional (1 to 3) for the other team events. Only the exhibition needs the ₹199 fee.
INSERT INTO "Event" ("slug", "name", "category", "teamMin", "teamMax") VALUES
  ('exhibition', 'Science & Innovation Exhibition', 'EXHIBITION', 3, 3),
  ('drone', 'Drone Technology', 'TECHNOLOGY', 1, 3),
  ('robotics', 'Robotics', 'TECHNOLOGY', 1, 3),
  ('satellite', 'Satellite & Space Technology', 'TECHNOLOGY', 1, 3),
  ('astronomy', 'Astronomy Experience', 'TECHNOLOGY', 1, 1),
  ('vr', 'VR & Immersive Technology', 'TECHNOLOGY', 1, 1),
  ('escape-school', 'Escape School', 'EXPERIENCE', 1, 3),
  ('treasure-hunt', 'Treasure Hunt', 'EXPERIENCE', 1, 3),
  ('workshops', 'Workshops', 'WORKSHOP', 1, 1)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category",
  "teamMin" = EXCLUDED."teamMin", "teamMax" = EXCLUDED."teamMax";
