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
  if (pathname.startsWith("/dashboard")) return <DashboardNav />;

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

// Signed-in students get an app-style bar: links on top from md up; on phones a slim top bar
// (logo + log out) and a bottom tab bar within thumb reach. No marketing links.
const DASH_LINKS: { href: string; label: string; icon: string; soon?: boolean }[] = [
  { href: "/dashboard", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/dashboard/pay", label: "Payment", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { href: "/dashboard/settings", label: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
  { href: "/events", label: "Events", icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4", soon: true }, // shown, not linked, until event sign-ups open
];

function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await api("/auth/logout", {}).catch(() => {});
    router.push(LOGIN_HREF);
  }
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-void/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link href="/" aria-label="AVANTRA home" className="inline-flex min-h-11 shrink-0 items-center">
            <img src="/brand/avantra-logo-500w.png" alt="AVANTRA" className="h-8 w-auto md:h-9" />
          </Link>
          <nav aria-label="Dashboard" className="hidden items-center gap-7 md:flex">
            {DASH_LINKS.map((l) =>
              l.soon ? (
                <span key={l.href} aria-disabled="true" className="cursor-default text-muted">
                  {l.label} <span className="text-xs uppercase tracking-wider">· soon</span>
                </span>
              ) : (
              <Link
                key={l.href}
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
                className={pathname === l.href ? "text-sky" : "text-secondary transition-colors hover:text-starlight"}
              >
                {l.label === "Home" ? "Dashboard" : l.label}
              </Link>
              ),
            )}
          </nav>
          <button type="button" onClick={logout} className="inline-flex min-h-11 items-center rounded-full border-2 border-sky px-4 text-starlight transition-colors hover:bg-sky/15">
            Log out
          </button>
        </div>
      </header>
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-void/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {DASH_LINKS.map((l) => {
            const on = pathname === l.href;
            const icon = (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={l.icon} />
              </svg>
            );
            if (l.soon)
              return (
                <li key={l.href}>
                  <span aria-disabled="true" className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-muted opacity-60">
                    {icon}
                    {l.label} soon
                  </span>
                </li>
              );
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${on ? "text-sky" : "text-secondary"}`}
                >
                  {icon}
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
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
