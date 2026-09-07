# AVANTRA Site — Design Spec

Date: 2026-09-08
Status: Approved for implementation planning

## 1. Background

AVANTRA is a 3-day Multiverse-themed science fair/exhibition (proposed December 2026), hosted by SSRVM IEMS and organized/sponsored via ARITHI, with NIT Rourkela student clubs running exhibits and sessions. Source: `ANANTRA Science Exhibition Proposal.pdf`.

This site promotes the event and gives attendees, sponsors, and the school community the info they need: what it is, the rules, where it is, prizes, sponsors, and contact info.

## 2. Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion
- **Output:** Static export (`output: 'export'`) — deployable to any static host (GitHub Pages / Netlify / Vercel), no backend/server required.

Chosen because nothing in scope needs server-side logic (contact page is static info, not a live form), so static export gets free/simple hosting with zero maintenance.

## 3. Routes & Page Content

| Route | Content |
|---|---|
| `/` | Intro sequence (see §5), hero (AVANTRA title + multiverse visual), countdown timer to event date, short event blurb, nav links |
| `/about` | Event overview, partner roles (SSRVM IEMS / ARITHI / NIT Rourkela clubs), 3-day structure, competition rules |
| `/venue` | Venue & directions (address/map), prizes & certificates info |
| `/sponsors` | Sponsors & partners, funding model blurb, NIT Rourkela club showcase |
| `/contact` | Static contact info (email/phone/social for ARITHI & SSRVM IEMS), photo/exhibit gallery grid |

Nav: fixed header, links to all 5 pages, active-page highlight, mobile hamburger menu.

## 4. Visual & Animation Direction

- **Theme:** dark space background (navy/black), portal/rift accents in purple-pink-cyan gradients, glowing edges.
- **Page transitions:** portal "warp" effect (scale + fade + blur) between pages via Framer Motion `AnimatePresence`.
- **Scroll animations:** staggered fade/slide-in reveals on About, Venue, Sponsors, Gallery.
- **Countdown timer:** animated flip/tick digits, reads target date from config.
- **Gallery:** grid with hover zoom + click-to-open lightbox.

## 5. Start Intro Sequence

One `IntroSequence` component, shown on landing at `/`:

- If a video file exists at the configured path, it plays as the intro.
- If no video file is present, or it fails to load (`onError`), the component falls back automatically to a code-driven portal animation (particles converging into a rift, warp-zoom into the site) — same visual language as the page-transition effect.
- Skip button always available.
- Plays once per browser session (localStorage flag) — repeat page loads within the same session skip straight to the home page content.
- Video asset does not exist yet; placeholder path in config, user will supply the real file later.

## 6. Content & Config

- Single `content/site.ts` holds: event date, page copy, sponsor list, gallery image list, contact info. One place to edit, no hunting through components.
- Countdown timer target date: placeholder `2026-12-01T00:00:00`, read from this config — update in one place once the real date is confirmed.
- Images/gallery/sponsor logos/intro video: placeholder folders under `public/`, real assets to be dropped in later by the user.

## 7. Project Structure

```
app/            5 routes (page.tsx per route above)
components/     Nav, Footer, CountdownTimer, IntroSequence, PageTransition, Gallery
content/        site.ts (config data)
public/         video/, images/ (placeholders)
```

## 8. Error Handling

- Intro video load failure → automatic fallback to animated portal (no broken UI, no user-visible error).
- Missing gallery/sponsor images → themed placeholder box, not a broken-image icon.

## 9. Testing

- Manual browser check of all 5 pages (nav, transitions, responsiveness).
- One unit test for the countdown timer's pure calculation function (time-remaining logic is easy to silently break, e.g. off-by-one on days/hours rollover).

## 10. Out of Scope

- Working contact form / email sending (static info only, per decision).
- CMS or dynamic content editing.
- User accounts, registration, or any backend/database.
