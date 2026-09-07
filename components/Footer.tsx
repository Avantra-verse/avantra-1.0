import { siteConfig } from "@/content/site";

export default function Footer() {
  return (
    <footer className="border-t border-rift-purple/30 mt-16 py-6 text-center text-starlight/60 text-sm">
      {siteConfig.eventName} — {siteConfig.tagline}
    </footer>
  );
}
