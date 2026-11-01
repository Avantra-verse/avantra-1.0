// "Join the multiverse": AVANTRA's WhatsApp channel and Instagram, as two big tappable cards.
// Used on the student dashboard and the home page footer.
import { siteConfig } from "@/content/site";
import s from "./Community.module.css";

const LINKS = [
  {
    href: siteConfig.whatsappChannel,
    tone: "wa",
    kicker: "WhatsApp channel",
    title: "Get every update first",
    sub: "Dates, results and event-day news, straight to your phone.",
    cta: "Follow the channel",
    // WhatsApp-style chat bubble
    icon: "M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3zm4.4 12.6c-.2.5-1.1 1-1.6 1-.4.1-.9.1-1.5-.1-2.6-1-4.3-3.6-4.4-3.8-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.3 0 .5l-.3.4-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.8-1c.2-.2.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.6-.1 1z",
  },
  {
    href: siteConfig.instagram,
    tone: "ig",
    kicker: "Instagram",
    title: "@avantra.verse",
    sub: "Behind the scenes, sneak peeks and reshares of your stories.",
    cta: "Follow on Instagram",
    // Camera glyph
    icon: "M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5.3-1.8a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z",
  },
] as const;

export function Community({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${s.wrap} ${compact ? s.compact : ""}`} aria-labelledby="community">
      <p className={s.eyebrow}>Every universe has a doorway</p>
      <h2 id="community" className={s.title}>Join the multiverse</h2>
      <div className={s.grid}>
        {LINKS.map((l) => (
          <a key={l.tone} href={l.href} target="_blank" rel="noopener noreferrer" className={s.card} data-tone={l.tone}>
            <span className={s.icon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26"><path d={l.icon} fill="currentColor" /></svg>
            </span>
            <span className={s.kicker}>{l.kicker}</span>
            <span className={s.cardTitle}>{l.title}</span>
            {!compact && <span className={s.sub}>{l.sub}</span>}
            <span className={s.cta}>
              {l.cta} <span aria-hidden="true">→</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
