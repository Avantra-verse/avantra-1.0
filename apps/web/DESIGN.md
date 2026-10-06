# AVANTRA design: "Ember"

How every AVANTRA page should look. Taken from Meena's shipped pages: the home page
(`public/index.html`), Registration (`app/registration/`) and the room experience
(`components/RoomExperience*`, used by About and Contact). New pages copy these, not the older
"Void" style described further down.

## Feel

Warm, cinematic, a little hand-made. A dark, ember-lit room with cream type, deep red and sky
blue. Display type is Devanagari-flavoured (Yatra One), accents are italic serif. Multiverse
wording: "Every universe has a doorway", "step through", "your universe".

## Colour

One set of values. The registration and room styles drift slightly from these; new work uses these.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#120e0c` | Page background |
| `--panel` | `#1b1613` | Cards, raised areas |
| `--ink` | `#f4ead9` | Main text (cream) |
| `--mute` | `#b9ab9a` | Secondary text, captions |
| `--line` | `rgba(244,234,217,.16)` | Hairlines, dividers |
| `--red` | `#b3121e` | Primary buttons, selected states, outer card ring |
| `--red2` | `#ff5560` | Hover, highlights |
| `--blue` | `#9fd4ff` | Labels, card borders, focus rings, link hover |
| `--blue2` | `#5aa9e6` | Secondary accent |
| `--field` | `#4a6f88` | Input and chip borders at rest |
| `--err` | `#ff8a8a` | Error text and borders |

Background glow (behind content): `radial-gradient(circle at 20% 30%, rgba(159,212,255,.07), transparent 40%), radial-gradient(circle at 85% 80%, rgba(179,18,30,.18), transparent 45%)`.

Progress / accent gradient: `linear-gradient(90deg, var(--red), var(--red2), var(--blue))`.

## Type

Loaded from Google Fonts (see `public/index.html` and `app/layout.tsx`).

| Role | Font | Notes |
|---|---|---|
| Display (page titles, labels, buttons) | **Yatra One** | Title: ~2.5rem, colour `--red2`, 2px `--blue` outline via text-shadow |
| Body | **Mukta** 400/600 | 17–18px, line-height 1.5–1.55 |
| Accent (dates, quotes, loaders) | **Cormorant Garamond** italic | `--mute`, ~1.15–1.3rem |
| Handwritten (room experience only) | Gaegu | Sparingly |

Numbers that update (scores, counters): `font-variant-numeric: tabular-nums`.

## Components

Copy from `app/registration/registration.module.css`; it is the reference implementation.

- **Card** (`.card`): `--panel` fill, 3px `--blue` border, 26px radius, padding ~36px, outer ring `0 0 0 6px var(--red)` plus a soft drop shadow.
- **Page heading** (`.heading`): Yatra One, red fill with a sky-blue outline.
- **Label** (`.label`): Yatra One ~1.05rem in `--blue`, above the field.
- **Input** (`.input`): `--bg` fill, 2px `--field` border, 12px radius. Focus: border `--blue` + 3px red glow. Error: border and text `--err`, message under the field.
- **Primary button** (`.submitBtn`): full-width pill (999px), Yatra One ~1.25rem, `--red` fill, 3px `--blue` border; hover brighter red + blue glow; disabled 60% opacity.
- **Choice chips** (`.chipLabel` with radio): 2px `--field` border, 14px radius; selected = red fill, blue border, blue glow.
- **Links**: cream, underline; hover `--blue`.
- **Top bar**: fixed, logo left, nav links Mukta 600; fades from `rgba(18,14,12,.78)` to transparent.

## Surfaces and motion

- Film-grain overlay (`.grain` in `public/index.html`): fixed, 9% opacity, overlay blend.
- Starfield: a few 1–1.5px white and sky dots, fixed, ~70% opacity (`.starfieldLayer`).
- Page enter: `components/PageTransition.tsx`; reveal on scroll: `components/Reveal.tsx`.
- Home page only: preloader, scroll-scrubbed frame sequences, cursor lens. Don't repeat these on working pages (forms, dashboards); keep those calm and fast.
- Respect `prefers-reduced-motion`: no scrubbing, no parallax, instant transitions.

## Accessibility

- Contrast on `--bg` / `--panel` (WCAG AA needs 4.5:1 for text): `--ink` 16.1 / 15.0, `--blue` 12.2 / 11.4,
  `--mute` 8.6 / 8.0, `--err` 8.5 / 7.9, `--red2` 6.1 / 5.7. **`--red` is 2.8 / 2.6: never use it for text**,
  only for fills (white text on a `--red` button is 6.9).
- Visible focus everywhere: 2px `--blue` outline, 3–4px offset.
- Every input has a label; errors are text, not colour alone, and are linked with `aria-describedby`.
- Skip link to `#main` (already in `app/layout.tsx`).

## Building a new inner page

1. Start from the Registration page: page wrapper + glow + starfield, then content in one or more Cards.
2. Use the tokens above (add them to a CSS module or `:root`), Yatra One headings, Mukta body.
3. Forms: Label + Input + error text, primary pill button at the end.
4. Lists and data (events, teams, leaderboards): rows inside a Card separated by `--line` hairlines; numbers tabular.
5. Mobile first: single column under ~820px, 16px side padding.

## Older "Void" style (do not extend)

`app/globals.css` (purple `#7b2ff7` on `#07070e`, Archivo, "no boxes, no radius"), used by Venue,
Sponsors, Nav and Footer, comes from the earlier frontend. Those pages should move to Ember over time.
