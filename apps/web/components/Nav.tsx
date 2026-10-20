"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/venue", label: "Venue" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Log in" },
  { href: "/registration", label: "Registration" },
];

export default function Nav() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/about" || pathname === "/contact") return null;

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-void/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" aria-label="AVANTRA home">
          <img src="/brand/avantra-logo-500w.png" alt="AVANTRA" className="h-9 w-auto" />
        </Link>

        <nav className="hidden gap-8 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={
                pathname === link.href
                  ? "text-starlight"
                  : "text-muted transition-colors hover:text-starlight"
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
