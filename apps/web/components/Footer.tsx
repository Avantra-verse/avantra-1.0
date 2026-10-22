"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { REGISTER_HREF } from "@/lib/api";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/venue", label: "Venue" },
  { href: "/contact", label: "Contact" },
  { href: REGISTER_HREF, label: "Registration" },
];

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/about" || pathname === "/contact") return null; // these pages have their own footer
  return (
    <footer className="relative z-30 border-t border-starlight/15 bg-void px-6 pt-14 pb-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 text-center md:flex-row md:items-start md:text-left">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <Link href="/" aria-label="AVANTRA home" className="inline-flex min-h-11 items-center">
            <img src="/brand/avantra-logo-500w.png" alt="AVANTRA" className="h-[42px] w-auto object-contain" />
          </Link>
          <p className="max-w-sm text-secondary">A Multiverse-themed inter-school science &amp; innovation festival</p>
          <p className="font-[family-name:var(--font-display)] text-sky">19–20 December 2026</p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 font-semibold text-secondary">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className="inline-flex min-h-11 min-w-11 items-center justify-center underline-offset-4 transition-colors hover:text-sky hover:underline aria-[current=page]:text-starlight"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col items-center justify-between gap-2 border-t border-starlight/10 pt-6 text-sm text-muted sm:flex-row">
        <p>AVANTRA 2026, hosted by SSRVM IEMS Sec-20</p>
        <p>Run by Arithi Innovation &amp; Technologies</p>
      </div>
    </footer>
  );
}
