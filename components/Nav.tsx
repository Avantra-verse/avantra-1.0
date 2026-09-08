"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import CountdownTimer from "@/components/CountdownTimer";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/venue", label: "Venue" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  // Gets out of the way going down, returns the moment you scroll back up.
  useMotionValueEvent(scrollY, "change", (y) => {
    if (open) return;
    const previous = scrollY.getPrevious() ?? 0;
    setHidden(y > 120 && y > previous);
  });

  return (
    <motion.header
      animate={{ y: hidden && !reduce ? "-100%" : "0%" }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-40 border-b border-white/8 bg-void/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-[-0.02em] text-starlight"
        >
          AVANTRA
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <CountdownTimer />
          <span aria-hidden="true" className="h-5 w-px bg-white/15" />
        </div>

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

        <button
          className="text-starlight md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="flex flex-col overflow-hidden px-6 pb-4 md:hidden"
          >
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={
                  "border-t border-white/8 py-3 " +
                  (pathname === link.href ? "text-starlight" : "text-muted")
                }
              >
                {link.label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
