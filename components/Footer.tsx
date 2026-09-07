import Link from "next/link";
import { siteConfig } from "@/content/site";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/venue", label: "Venue" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-xl font-extrabold tracking-[-0.02em] text-starlight">
            {siteConfig.eventName}
          </p>
          <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-dim">
            {siteConfig.tagline}
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-7 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-dim transition-colors hover:text-starlight"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
