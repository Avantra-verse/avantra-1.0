// Usage: pnpm --filter @avantra/api seed-events
// Creates the brochure's events, or updates them by slug. Safe to re-run.
// Placeholders to confirm with the team: team sizes, capacities, and fees for ARITHI-led events (0 = free).
import { PrismaClient, type EventCategory } from '@prisma/client';

try {
  process.loadEnvFile();
} catch {}
type Seed = { slug: string; name: string; category: EventCategory; feePaise: number; teamMin: number; teamMax: number; capacity?: number };
const events: Seed[] = [
  { slug: 'exhibition', name: 'Science & Innovation Exhibition', category: 'EXHIBITION', feePaise: 19900, teamMin: 1, teamMax: 4 },
  { slug: 'drone', name: 'Drone Technology', category: 'TECHNOLOGY', feePaise: 0, teamMin: 1, teamMax: 4 },
  { slug: 'robotics', name: 'Robotics', category: 'TECHNOLOGY', feePaise: 0, teamMin: 1, teamMax: 4 },
  { slug: 'satellite', name: 'Satellite & Space Technology', category: 'TECHNOLOGY', feePaise: 0, teamMin: 1, teamMax: 4 },
  { slug: 'astronomy', name: 'Astronomy Experience', category: 'TECHNOLOGY', feePaise: 0, teamMin: 1, teamMax: 1 },
  { slug: 'vr', name: 'VR & Immersive Technology', category: 'TECHNOLOGY', feePaise: 0, teamMin: 1, teamMax: 1 },
  { slug: 'escape-school', name: 'Escape School', category: 'EXPERIENCE', feePaise: 0, teamMin: 2, teamMax: 5 },
  { slug: 'treasure-hunt', name: 'Treasure Hunt', category: 'EXPERIENCE', feePaise: 0, teamMin: 2, teamMax: 5 },
  { slug: 'workshops', name: 'Workshops', category: 'WORKSHOP', feePaise: 0, teamMin: 1, teamMax: 1 },
];
const prisma = new PrismaClient();
for (const e of events) await prisma.event.upsert({ where: { slug: e.slug }, create: e, update: e });
await prisma.$disconnect();
console.log(`Seeded ${events.length} events`);
