"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { api, apiReady, LOGIN_HREF, REGISTER_HREF } from "@/lib/api";

// Log in only appears once accounts are live; until then it is one more "Opening soon".
const LINKS = [
  { href: "/about", label: "About" },
  { href: "/venue", label: "Venue" },
  { href: "/organizers", label: "Committee" },
  { href: "/ambassador", label: "Ambassadors" },
  { href: "/contact", label: "Contact" },
  { href: LOGIN_HREF, label: "Log in" },
  { href: REGISTER_HREF, label: "Registration" },
].filter((l) => apiReady || l.href !== LOGIN_HREF);

// Registration is the one call to action in every header.
export const REGISTER_PILL =
  "pill inline-flex min-h-11 items-center rounded-full border-2 border-sky bg-ember px-5 font-[family-name:var(--font-display)] text-white transition-[background-color,box-shadow] duration-200 hover:bg-ember-hot hover:shadow-[0_4px_18px_rgb(159_212_255/0.35)]";

export default function Nav() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/about" || pathname === "/contact") return null;
  if (pathname.startsWith("/dashboard")) return <AppNav links={DASH_LINKS} badge="STUDENT" loginHref={LOGIN_HREF} />;
  if (APP_PAGES.includes(pathname)) return null; // they render <AppNav> themselves, with tabs for the signed-in role

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" aria-label="AVANTRA home" className="inline-flex min-h-11 items-center">
          <img src="/brand/avantra-logo-500w.png" alt="AVANTRA" className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={
                link.href === REGISTER_HREF
                  ? REGISTER_PILL
                  : pathname === link.href
                    ? "text-starlight"
                    : "text-secondary transition-colors hover:text-starlight"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <MobileMenu className="md:hidden" />
      </div>
    </header>
  );
}

// Signed-in students get an app shell: a sidebar from md up; on phones a slim top bar
// (logo + log out) and a bottom tab bar within thumb reach. No marketing links.
const DASH_LINKS: { href: string; label: string; icon: string }[] = [
  { href: "/dashboard", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/dashboard/events", label: "Events", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4" },
  { href: "/dashboard/teams", label: "Teams", icon: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.1a4 4 0 010 7.8M22 21v-1a6 6 0 00-4-5.7" },
  { href: "/dashboard/pay", label: "Payment", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { href: "/dashboard/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
];

// Signed-in app screens other than the student dashboard. Add a page here and render <AppNav> in it;
// links with a #hash are tabs on that page (useHashTab in app/admin/ui.tsx). The footer hides on these too.
export const APP_PAGES = ["/admin", "/staff"];

// Admin is one page with #hash tabs (app/admin/page.tsx listens for hashchange); plain <a> so the hash event fires.
export const ADMIN_LINKS: DashLink[] = [
  { href: "/admin#overview", label: "Overview", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { href: "/admin#referrals", label: "Referrals", icon: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01" },
  { href: "/admin#payments", label: "UPI payments", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { href: "/admin#desk", label: "Desk", icon: "M9 4h6v3H9zM6 5H5v16h14V5h-1M9 13h6M9 17h4" },
  { href: "/admin#staff", label: "Staff", icon: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M16 3.1a4 4 0 010 7.8M22 21v-1a6 6 0 00-4-5.7" },
  { href: "/admin#events", label: "Results", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4" },
  { href: "/admin#wall", label: "Wall", icon: "M3 5h18v14H3zM3 12h18M9 5v7M15 12v7" },
  { href: "/admin#admins", label: "Admins", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" }, // super admin only
];

// Current #hash, kept in step with tab clicks and back/forward.
function useHash() {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    on();
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export type DashLink = { href: string; label: string; icon: string };

function Item({ l, on, className, children }: { l: DashLink; on: boolean; className: string; children: React.ReactNode }) {
  const current = on ? ("page" as const) : undefined;
  return l.href.includes("#") ? (
    <a href={l.href} aria-current={current} className={className}>{children}</a>
  ) : (
    <Link href={l.href} aria-current={current} className={className}>{children}</Link>
  );
}

function Icon({ d, size }: { d: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

// Pages that render this themselves (admin, staff) sit inside PageTransition's transformed wrapper, which would
// pin the fixed bars to it; so they pass `portal` and the bars mount straight into <body> after hydration.
export function AppNav({ links, badge, loginHref, portal }: { links: DashLink[]; badge: string; loginHref: string; portal?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pathname = usePathname();
  const hash = useHash();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const bar = links.length > 5 ? links.slice(0, 4) : links;
  const rest = links.slice(bar.length);
  useEffect(() => setMore(false), [hash]); // picking a tab closes the sheet
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [more]);
  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.push(loginHref);
  }
  // Hash links are active on their hash; the first one also when there is none yet.
  const isOn = (href: string, i: number) => {
    const [path, h] = href.split("#");
    if (h === undefined) return pathname === href;
    return pathname === path && (hash === `#${h}` || (i === 0 && !links.some((l) => l.href === path + hash)));
  };
  const nav = (
    <>
      {/* md and up: a sidebar, like the Arithi dashboard. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/10 bg-[#171210] md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Link href="/" aria-label="AVANTRA home" className="inline-flex min-h-11 items-center">
            <img src="/brand/avantra-logo-500w.png" alt="AVANTRA" className="h-9 w-auto" />
          </Link>
          <span className="rounded-full border border-sky/60 px-2 py-0.5 text-[11px] font-bold tracking-wider text-sky">{badge}</span>
        </div>
        <nav aria-label="Dashboard" className="flex-1 space-y-1.5 overflow-y-auto px-3 py-5">
          {links.map((l, i) => {
            const on = isOn(l.href, i);
            return (
              <Item
                key={l.href}
                l={l}
                on={on}
                className={`flex min-h-11 items-center gap-3 rounded-xl border-2 px-3.5 font-semibold transition-colors ${
                  on ? "border-sky bg-ember text-white shadow-[3px_3px_0_0_rgb(159_212_255/0.35)]" : "border-transparent text-secondary hover:bg-white/5 hover:text-starlight"
                }`}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={l.icon} />
                </svg>
                {l.label}
              </Item>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-3 py-3">
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl border-2 border-transparent px-3.5 font-semibold text-secondary transition-colors hover:bg-white/5 hover:text-starlight"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
            Log out
          </button>
        </div>
      </aside>
      {/* Phones: slim top bar; the tabs sit at the bottom. */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-void/80 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" aria-label="AVANTRA home" className="inline-flex min-h-11 shrink-0 items-center">
            <img src="/brand/avantra-logo-500w.png" alt="AVANTRA" className="h-8 w-auto" />
          </Link>
          <button type="button" onClick={logout} className="inline-flex min-h-11 items-center rounded-full border-2 border-sky px-4 text-starlight transition-colors hover:bg-sky/15">
            Log out
          </button>
        </div>
      </header>
      {/* More than 5 tabs (admin): 4 in the bar, the rest in a "More" sheet just above it. */}
      {more && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMore(false)}>
          <ul
            id="more-tabs"
            className="absolute inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] space-y-1.5 rounded-2xl border-2 border-sky/40 bg-[#171210] p-2.5 shadow-[4px_4px_0_0_rgb(159_212_255/0.25)]"
          >
            {rest.map((l) => {
              const on = isOn(l.href, links.indexOf(l));
              return (
                <li key={l.href}>
                  <Item
                    l={l}
                    on={on}
                    className={`flex min-h-12 items-center gap-3 rounded-xl border-2 px-3.5 font-semibold ${on ? "border-sky bg-ember text-white" : "border-transparent text-secondary"}`}
                  >
                    <Icon d={l.icon} size={20} />
                    {l.label}
                  </Item>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {bar.length > 1 && (
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-void/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${bar.length + (rest.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {bar.map((l, i) => {
            const on = isOn(l.href, i);
            return (
              <li key={l.href}>
                <Item l={l} on={on} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 whitespace-nowrap px-1 text-xs ${on ? "text-sky" : "text-secondary"}`}>
                  <Icon d={l.icon} size={22} />
                  {l.label}
                </Item>
              </li>
            );
          })}
          {rest.length > 0 && (
            <li>
              <button
                type="button"
                aria-expanded={more}
                aria-controls="more-tabs"
                onClick={() => setMore((v) => !v)}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs ${more || rest.some((l) => isOn(l.href, links.indexOf(l))) ? "text-sky" : "text-secondary"}`}
              >
                <Icon d="M5 12h.01M12 12h.01M19 12h.01" size={22} />
                More
              </button>
            </li>
          )}
        </ul>
      </nav>
      )}
    </>
  );
  if (!portal) return nav;
  return mounted ? createPortal(nav, document.body) : null;
}

// Hamburger + full-screen link list. Shared by every header (this one, the
// home page's and the about/contact room) so phones get one consistent menu.
export function MobileMenu({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="-mr-2 flex h-11 w-11 items-center justify-center text-starlight"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {/* Portalled: a header's backdrop-filter would otherwise trap this fixed overlay inside the bar. */}
      {typeof document !== "undefined" && createPortal(
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Main"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex flex-col justify-center gap-1 overscroll-contain bg-void/95 px-8 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex h-11 w-11 items-center justify-center text-starlight"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {LINKS.map((link, i) => (
              <motion.div
                key={link.href}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.25 }}
              >
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={
                    "block border-b border-white/8 py-4 text-3xl font-bold tracking-[-0.02em] " +
                    (pathname === link.href ? "text-starlight" : "text-secondary")
                  }
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  );
}
