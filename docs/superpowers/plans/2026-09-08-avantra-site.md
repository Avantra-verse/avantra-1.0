# AVANTRA Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AVANTRA event site — a 5-page Next.js static site with a multiverse theme, portal-style page transitions, a start-of-site intro (video-with-animated-fallback), and a countdown timer.

**Architecture:** Next.js App Router + TypeScript, statically exported (no server). Tailwind CSS for styling, Framer Motion for animation. One typed config file (`content/site.ts`) holds all event copy/data so content edits never touch component code.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Vitest (unit test for the countdown logic only).

**Spec:** `docs/superpowers/specs/2026-09-08-avantra-site-design.md`

## Global Constraints

- Static export only: `next.config.js` must set `output: 'export'`. No API routes, no server actions.
- No contact form submission logic — Contact page is static info only.
- No CMS, no database, no auth.
- Countdown target date is a placeholder: `2026-12-01T00:00:00` — must live in `content/site.ts`, nowhere else.
- Missing images/video must never show a broken-asset icon — always a themed fallback.

---

## File Structure

```
package.json, tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js
vitest.config.ts
app/layout.tsx              root layout: Nav, Footer, PageTransition wrapper
app/globals.css             Tailwind directives + base theme
app/page.tsx                Home: IntroSequence, Hero, CountdownTimer
app/about/page.tsx          Overview, partner roles, 3-day structure, rules
app/venue/page.tsx          Venue & directions, prizes & certificates
app/sponsors/page.tsx       Sponsors & partners, funding model
app/contact/page.tsx        Static contact info + Gallery
components/Nav.tsx
components/Footer.tsx
components/CountdownTimer.tsx
components/IntroSequence.tsx    video-or-portal-fallback intro, skip button, session flag
components/PortalAnimation.tsx  code-driven fallback animation (also reused by IntroSequence)
components/PageTransition.tsx   AnimatePresence wrapper keyed by pathname
components/Gallery.tsx          grid + lightbox, placeholder-on-error
content/site.ts             typed event data (single source of content)
lib/countdown.ts            pure time-remaining calculation (unit tested)
lib/countdown.test.ts
public/video/intro.mp4      placeholder path; user supplies real file later
public/images/               placeholder gallery/sponsor images
```

---

### Task 1: Project scaffolding, Tailwind theme, static export config

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`, `app/layout.tsx` (minimal shell), `vitest.config.ts`

**Interfaces:**
- Produces: Tailwind theme color tokens (`bg-void`, `text-starlight`, `from-rift-purple`, `via-rift-pink`, `to-rift-cyan`) used by every later component.

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --eslint
```
Answer prompts with defaults if asked (this run is non-interactive-safe; if it errors on existing files, confirm overwrite of nothing — the directory only has `LICENSE`/`README.md`).

- [ ] **Step 2: Verify the dev server runs**

Run: `npm run dev` then `curl -s http://localhost:3000 | head -20`
Expected: HTML output containing `<!DOCTYPE html>`. Stop the dev server after confirming (Ctrl+C).

- [ ] **Step 3: Install Framer Motion and Vitest**

Run:
```bash
npm install framer-motion
npm install -D vitest
```

- [ ] **Step 4: Configure static export**

Edit `next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

module.exports = nextConfig;
```

- [ ] **Step 5: Add multiverse theme tokens to Tailwind**

Edit `tailwind.config.ts`, extend `theme.extend.colors`:
```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#05050f",
        starlight: "#f2f0ff",
        "rift-purple": "#7b2ff7",
        "rift-pink": "#f72fb6",
        "rift-cyan": "#2ff7e0",
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 6: Set base theme in globals.css**

Edit `app/globals.css` (append after Tailwind directives):
```css
body {
  background-color: #05050f;
  color: #f2f0ff;
}
```

- [ ] **Step 7: Add Vitest config for `lib/` unit tests**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

Add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with static export and multiverse theme"
```

---

### Task 2: Content config

**Files:**
- Create: `content/site.ts`

**Interfaces:**
- Produces: `siteConfig` object and its exported TypeScript types, imported by every page/component that needs event data. Shape:
```ts
export interface SiteConfig {
  eventName: string;
  tagline: string;
  eventDateISO: string;
  overview: string;
  partners: { name: string; role: string }[];
  days: { title: string; description: string }[];
  rules: string[];
  venue: { name: string; address: string; directions: string };
  prizes: { title: string; description: string }[];
  sponsors: { name: string; tier: string }[];
  contact: { org: string; email: string; phone: string }[];
  gallery: { src: string; alt: string }[];
  introVideoSrc: string;
}
export const siteConfig: SiteConfig;
```

- [ ] **Step 1: Write `content/site.ts`**

```ts
export interface SiteConfig {
  eventName: string;
  tagline: string;
  eventDateISO: string;
  overview: string;
  partners: { name: string; role: string }[];
  days: { title: string; description: string }[];
  rules: string[];
  venue: { name: string; address: string; directions: string };
  prizes: { title: string; description: string }[];
  sponsors: { name: string; tier: string }[];
  contact: { org: string; email: string; phone: string }[];
  gallery: { src: string; alt: string }[];
  introVideoSrc: string;
}

export const siteConfig: SiteConfig = {
  eventName: "AVANTRA",
  tagline: "A Multiverse-Themed Science Fair & Exhibition",
  eventDateISO: "2026-12-01T00:00:00",
  overview:
    "AVANTRA is a three-day science fair and exhibition hosted by SSRVM IEMS, " +
    "organized in partnership with ARITHI. Student clubs from NIT Rourkela " +
    "showcase projects and run sessions, bringing college-level science " +
    "exposure to school students, all built around a Multiverse theme.",
  partners: [
    { name: "SSRVM IEMS", role: "Institutional Partner — hosts, provides venue and infrastructure, internal coordination." },
    { name: "ARITHI", role: "Event Partner — plans the event, brings sponsorship, coordinates NIT Rourkela clubs, runs execution." },
    { name: "Sponsors", role: "Fund and support the event to keep school spend low." },
    { name: "NIT Rourkela Clubs", role: "Showcase projects and conduct science events and sessions for students." },
  ],
  days: [
    { title: "Day 1", description: "Opening & science exhibition — exhibits from school students and NIT Rourkela clubs open to view; inaugural session." },
    { title: "Day 2", description: "Science-related competitive events and challenges run across the day, alongside continuing exhibition." },
    { title: "Day 3", description: "Remaining events, NIT Rourkela club showcases and sessions, results, and closing ceremony." },
  ],
  rules: [
    "Details to be published closer to the event by the organizing committee.",
  ],
  venue: {
    name: "SSRVM IEMS",
    address: "To be confirmed by the organizing committee.",
    directions: "Directions and map will be published closer to the event.",
  },
  prizes: [
    { title: "Certificates", description: "Certificates of participation and achievement will be issued to all exhibitors and event winners." },
  ],
  sponsors: [],
  contact: [
    { org: "ARITHI", email: "contact@arithi.example", phone: "" },
    { org: "SSRVM IEMS", email: "info@ssrvmiems.example", phone: "" },
  ],
  gallery: [],
  introVideoSrc: "/video/intro.mp4",
};
```

Note: rules/venue address/sponsors/gallery/contact details are placeholders pulled from what the proposal PDF does and doesn't specify — the proposal has no venue address, rules text, sponsor names, or contact details. Flag this to the user after the plan is approved; these are content gaps, not implementation gaps, and belong to whoever finalizes event details, not to this plan.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add content/site.ts
git commit -m "feat: add site content config"
```

---

### Task 3: Countdown pure function (TDD)

**Files:**
- Create: `lib/countdown.ts`, `lib/countdown.test.ts`

**Interfaces:**
- Produces: `getTimeRemaining(targetISO: string, now?: Date): TimeRemaining` and `TimeRemaining` interface, consumed by `components/CountdownTimer.tsx`.

- [ ] **Step 1: Write the failing test**

Create `lib/countdown.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getTimeRemaining } from "./countdown";

describe("getTimeRemaining", () => {
  it("computes days/hours/minutes/seconds remaining", () => {
    const now = new Date("2026-11-30T00:00:00Z");
    const result = getTimeRemaining("2026-12-01T00:00:00Z", now);
    expect(result).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 0, isPast: false });
  });

  it("returns isPast true once the target has passed", () => {
    const now = new Date("2026-12-02T00:00:00Z");
    const result = getTimeRemaining("2026-12-01T00:00:00Z", now);
    expect(result.isPast).toBe(true);
  });

  it("handles partial units correctly", () => {
    const now = new Date("2026-11-30T22:30:15Z");
    const result = getTimeRemaining("2026-12-01T00:00:00Z", now);
    expect(result).toEqual({ days: 0, hours: 1, minutes: 29, seconds: 45, isPast: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/countdown.test.ts`
Expected: FAIL — `Cannot find module './countdown'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/countdown.ts`:
```ts
export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

export function getTimeRemaining(targetISO: string, now: Date = new Date()): TimeRemaining {
  const diffMs = new Date(targetISO).getTime() - now.getTime();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    isPast: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/countdown.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/countdown.ts lib/countdown.test.ts
git commit -m "feat: add countdown time-remaining calculation with tests"
```

---

### Task 4: CountdownTimer component

**Files:**
- Create: `components/CountdownTimer.tsx`

**Interfaces:**
- Consumes: `getTimeRemaining` from `lib/countdown.ts`, `siteConfig.eventDateISO` from `content/site.ts`.
- Produces: `<CountdownTimer />` (no props — reads the date from config), used by `app/page.tsx`.

- [ ] **Step 1: Write the component**

Create `components/CountdownTimer.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getTimeRemaining, type TimeRemaining } from "@/lib/countdown";
import { siteConfig } from "@/content/site";

const UNITS: { key: keyof Omit<TimeRemaining, "isPast">; label: string }[] = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

export default function CountdownTimer() {
  const [remaining, setRemaining] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    const tick = () => setRemaining(getTimeRemaining(siteConfig.eventDateISO));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!remaining) return null;
  if (remaining.isPast) {
    return <p className="text-starlight text-xl">AVANTRA has begun!</p>;
  }

  return (
    <div className="flex gap-4">
      {UNITS.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center">
          <motion.span
            key={remaining[key]}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-4xl font-bold bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan bg-clip-text text-transparent"
          >
            {String(remaining[key]).padStart(2, "0")}
          </motion.span>
          <span className="text-sm text-starlight/70">{label}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/CountdownTimer.tsx
git commit -m "feat: add CountdownTimer component"
```

---

### Task 5: Nav, Footer, root layout

**Files:**
- Create: `components/Nav.tsx`, `components/Footer.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `<Nav />`, `<Footer />` rendered in every page via root layout.

- [ ] **Step 1: Write Nav**

Create `components/Nav.tsx`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/venue", label: "Venue" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-void/80 backdrop-blur border-b border-rift-purple/30">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
        <span className="font-bold text-starlight">AVANTRA</span>

        <nav className="hidden md:flex gap-6">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-rift-cyan"
                  : "text-starlight/80 hover:text-starlight"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className="md:hidden text-starlight"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="md:hidden flex flex-col px-4 pb-3 gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={
                pathname === link.href
                  ? "text-rift-cyan"
                  : "text-starlight/80 hover:text-starlight"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Write Footer**

Create `components/Footer.tsx`:
```tsx
import { siteConfig } from "@/content/site";

export default function Footer() {
  return (
    <footer className="border-t border-rift-purple/30 mt-16 py-6 text-center text-starlight/60 text-sm">
      {siteConfig.eventName} — {siteConfig.tagline}
    </footer>
  );
}
```

- [ ] **Step 3: Wire into root layout**

Edit `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";

export const metadata: Metadata = {
  title: "AVANTRA — Multiverse Science Fair & Exhibition",
  description: "A Multiverse-Themed Science Fair & Exhibition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="pt-16 max-w-5xl mx-auto px-4">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
```

(`PageTransition` is built in Task 6 — this task will not compile until then; that's expected, it's completed by the next commit.)

- [ ] **Step 4: Commit**

```bash
git add components/Nav.tsx components/Footer.tsx app/layout.tsx
git commit -m "feat: add Nav, Footer, and wire into root layout"
```

---

### Task 6: PageTransition wrapper

**Files:**
- Create: `components/PageTransition.tsx`

**Interfaces:**
- Consumes: `usePathname` from `next/navigation`.
- Produces: `<PageTransition>{children}</PageTransition>`, used by `app/layout.tsx` (Task 5).

- [ ] **Step 1: Write the component**

Create `components/PageTransition.tsx`:
```tsx
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: build succeeds (this also confirms Task 5's layout now compiles).

- [ ] **Step 3: Commit**

```bash
git add components/PageTransition.tsx
git commit -m "feat: add portal-style page transition wrapper"
```

---

### Task 7: PortalAnimation + IntroSequence

**Files:**
- Create: `components/PortalAnimation.tsx`, `components/IntroSequence.tsx`

**Interfaces:**
- Produces: `<PortalAnimation onComplete={() => void} />`, `<IntroSequence />`.
- `IntroSequence` reads `siteConfig.introVideoSrc`, writes/reads `localStorage["avantra-intro-seen"]`.

- [ ] **Step 1: Write the code-driven fallback animation**

Create `components/PortalAnimation.tsx`:
```tsx
"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";

export default function PortalAnimation({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-void flex items-center justify-center overflow-hidden">
      <motion.div
        initial={{ scale: 0, opacity: 0.8 }}
        animate={{ scale: 8, opacity: 0 }}
        transition={{ duration: 2.2, ease: "easeIn" }}
        className="w-24 h-24 rounded-full bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan"
      />
    </div>
  );
}
```

- [ ] **Step 2: Write IntroSequence**

Create `components/IntroSequence.tsx`:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/content/site";
import PortalAnimation from "./PortalAnimation";

const SEEN_KEY = "avantra-intro-seen";

export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<"checking" | "video" | "fallback" | "done">("checking");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const seen = typeof window !== "undefined" && localStorage.getItem(SEEN_KEY) === "1";
    setMode(seen ? "done" : "video");
  }, []);

  useEffect(() => {
    if (mode === "done") onComplete();
  }, [mode, onComplete]);

  const finish = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setMode("done");
  };

  if (mode === "checking" || mode === "done") return null;

  return (
    <div className="fixed inset-0 z-50 bg-void">
      {mode === "video" && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src={siteConfig.introVideoSrc}
          autoPlay
          muted
          playsInline
          onEnded={finish}
          onError={() => setMode("fallback")}
        />
      )}
      {mode === "fallback" && <PortalAnimation onComplete={finish} />}
      <button
        onClick={finish}
        className="absolute bottom-6 right-6 text-starlight/80 hover:text-starlight border border-starlight/40 rounded px-4 py-2"
      >
        Skip
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/PortalAnimation.tsx components/IntroSequence.tsx
git commit -m "feat: add intro sequence with video-or-portal fallback"
```

---

### Task 8: Home page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `IntroSequence`, `CountdownTimer`, `siteConfig`.

- [ ] **Step 1: Write the home page**

Replace `app/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import IntroSequence from "@/components/IntroSequence";
import CountdownTimer from "@/components/CountdownTimer";
import { siteConfig } from "@/content/site";

export default function Home() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      <IntroSequence onComplete={() => setIntroDone(true)} />
      {introDone && (
        <section className="flex flex-col items-center text-center gap-6 py-24">
          <h1 className="text-5xl font-extrabold bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan bg-clip-text text-transparent">
            {siteConfig.eventName}
          </h1>
          <p className="text-xl text-starlight/80 max-w-xl">{siteConfig.tagline}</p>
          <CountdownTimer />
          <p className="max-w-2xl text-starlight/70">{siteConfig.overview}</p>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 2: Manual check**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: intro plays (falls back to portal animation since no real video exists yet at `public/video/intro.mp4`), skip button works, hero + countdown render after.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: build home page with intro, hero, and countdown"
```

---

### Task 9: About page

**Files:**
- Create: `app/about/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { siteConfig } from "@/content/site";

export default function About() {
  return (
    <section className="py-16 flex flex-col gap-12">
      <div>
        <h1 className="text-3xl font-bold text-rift-cyan mb-4">About AVANTRA</h1>
        <p className="text-starlight/80 max-w-2xl">{siteConfig.overview}</p>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Partners</h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {siteConfig.partners.map((p) => (
            <li key={p.name} className="border border-rift-purple/30 rounded p-4">
              <p className="font-semibold text-starlight">{p.name}</p>
              <p className="text-starlight/70 text-sm">{p.role}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Event Structure</h2>
        <ul className="grid sm:grid-cols-3 gap-4">
          {siteConfig.days.map((d) => (
            <li key={d.title} className="border border-rift-purple/30 rounded p-4">
              <p className="font-semibold text-starlight">{d.title}</p>
              <p className="text-starlight/70 text-sm">{d.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Rules</h2>
        <ul className="list-disc list-inside text-starlight/80">
          {siteConfig.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/about/page.tsx
git commit -m "feat: add About page"
```

---

### Task 10: Venue page

**Files:**
- Create: `app/venue/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { siteConfig } from "@/content/site";

export default function Venue() {
  return (
    <section className="py-16 flex flex-col gap-12">
      <div>
        <h1 className="text-3xl font-bold text-rift-cyan mb-4">Venue & Directions</h1>
        <p className="text-starlight font-semibold">{siteConfig.venue.name}</p>
        <p className="text-starlight/70">{siteConfig.venue.address}</p>
        <p className="text-starlight/70 mt-2">{siteConfig.venue.directions}</p>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Prizes & Certificates</h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {siteConfig.prizes.map((p) => (
            <li key={p.title} className="border border-rift-purple/30 rounded p-4">
              <p className="font-semibold text-starlight">{p.title}</p>
              <p className="text-starlight/70 text-sm">{p.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/venue/page.tsx
git commit -m "feat: add Venue page"
```

---

### Task 11: Sponsors page

**Files:**
- Create: `app/sponsors/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { siteConfig } from "@/content/site";

export default function Sponsors() {
  return (
    <section className="py-16 flex flex-col gap-8">
      <h1 className="text-3xl font-bold text-rift-cyan mb-4">Sponsors & Partners</h1>
      <p className="text-starlight/80 max-w-2xl">
        AVANTRA is made possible through sponsorship coordinated by ARITHI, keeping the
        cost to the school minimal while bringing NIT Rourkela student clubs in to
        showcase real college-level science to students.
      </p>

      {siteConfig.sponsors.length === 0 ? (
        <p className="text-starlight/60 italic">Sponsor list to be announced.</p>
      ) : (
        <ul className="grid sm:grid-cols-3 gap-4">
          {siteConfig.sponsors.map((s) => (
            <li key={s.name} className="border border-rift-purple/30 rounded p-4 text-center">
              <p className="font-semibold text-starlight">{s.name}</p>
              <p className="text-starlight/60 text-sm">{s.tier}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/sponsors/page.tsx
git commit -m "feat: add Sponsors page"
```

---

### Task 12: Gallery component

**Files:**
- Create: `components/Gallery.tsx`

**Interfaces:**
- Consumes: `siteConfig.gallery` (`{ src: string; alt: string }[]`).
- Produces: `<Gallery />`, used by `app/contact/page.tsx` (Task 13).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { siteConfig } from "@/content/site";

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="aspect-square bg-void border border-rift-purple/30 flex items-center justify-center text-starlight/40 text-sm rounded">
        Image coming soon
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="aspect-square object-cover rounded cursor-pointer hover:scale-105 transition-transform"
    />
  );
}

export default function Gallery() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (siteConfig.gallery.length === 0) {
    return <p className="text-starlight/60 italic">Gallery photos coming soon.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {siteConfig.gallery.map((img) => (
          <div key={img.src} onClick={() => setLightbox(img.src)}>
            <GalleryImage src={img.src} alt={img.alt} />
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Gallery.tsx
git commit -m "feat: add Gallery component with lightbox and placeholder fallback"
```

---

### Task 13: Contact page

**Files:**
- Create: `app/contact/page.tsx`

**Interfaces:**
- Consumes: `Gallery`, `siteConfig.contact`.

- [ ] **Step 1: Write the page**

```tsx
import { siteConfig } from "@/content/site";
import Gallery from "@/components/Gallery";

export default function Contact() {
  return (
    <section className="py-16 flex flex-col gap-12">
      <div>
        <h1 className="text-3xl font-bold text-rift-cyan mb-4">Contact & Support</h1>
        <ul className="grid sm:grid-cols-2 gap-4">
          {siteConfig.contact.map((c) => (
            <li key={c.org} className="border border-rift-purple/30 rounded p-4">
              <p className="font-semibold text-starlight">{c.org}</p>
              {c.email && <p className="text-starlight/70 text-sm">{c.email}</p>}
              {c.phone && <p className="text-starlight/70 text-sm">{c.phone}</p>}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Gallery</h2>
        <Gallery />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/contact/page.tsx
git commit -m "feat: add Contact page with gallery"
```

---

### Task 14: Static export verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (3 from Task 3).

- [ ] **Step 2: Build the static export**

Run: `npm run build`
Expected: build succeeds, produces an `out/` directory (static export output).

- [ ] **Step 3: Serve and manually check all 5 pages**

Run: `npx serve out` (or `python3 -m http.server --directory out 8080`)
Visit `/`, `/about`, `/venue`, `/sponsors`, `/contact`. Confirm: nav works, page transitions animate, countdown ticks, intro shows once per session (check by reloading — should not replay), gallery shows "coming soon" placeholders (no broken images), contact info displays.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: verify static export build"
```

(If nothing changed, skip this commit — verification-only tasks don't always produce a diff.)

---

## Self-Review Notes

- **Spec coverage:** §3 routes → Tasks 8–13. §4 visuals/transitions → Tasks 1 (theme), 6 (transitions), 4 (timer). §5 intro → Task 7. §6 content config → Task 2. §7 structure → matches File Structure section above. §8 error handling → Gallery placeholder (Task 12) + IntroSequence `onError` fallback (Task 7). §9 testing → Task 3 (unit test) + Task 14 (manual + build verification).
- **Content gap flagged in Task 2:** rules text, venue address, sponsor names, and contact details are not in the source proposal PDF. Config ships with honest placeholders/empty-state UI (not fake data) rather than blocking implementation on unavailable content.
- **Type consistency checked:** `TimeRemaining` (Task 3) matches usage in `CountdownTimer` (Task 4); `SiteConfig` fields (Task 2) match every consuming page/component.
