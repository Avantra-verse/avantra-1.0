import { siteConfig } from "@/content/site";
import Gallery from "@/components/Gallery";
import Reveal from "@/components/Reveal";
import HoverCard from "@/components/HoverCard";
import PageHeader from "@/components/PageHeader";

export default function Contact() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-28">
      <PageHeader
        title="Contact and support"
        lead="Reach the organizing team for participation, sponsorship, or press."
      />

      <section className="pb-20">
        <ul className="grid gap-4 sm:grid-cols-2">
          {siteConfig.contact.map((c, i) => (
            <li key={c.org}>
              <Reveal delay={i * 0.08}>
                <HoverCard className="panel h-full px-6 py-6">
                  <p className="font-display text-lg font-semibold text-starlight">{c.org}</p>
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="mt-3 block text-sm text-rift-cyan/90 transition-colors hover:text-rift-cyan"
                    >
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="mt-1 block text-sm text-starlight/70 transition-colors hover:text-starlight"
                    >
                      {c.phone}
                    </a>
                  )}
                </HoverCard>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-6 font-display text-2xl font-semibold text-starlight">Gallery</h2>
        <Gallery />
      </section>
    </div>
  );
}
