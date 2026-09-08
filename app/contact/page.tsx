import { siteConfig } from "@/content/site";
import Gallery from "@/components/Gallery";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";

export default function Contact() {
  return (
    <div className="mx-auto max-w-6xl px-6 pb-32">
      <PageHeader
        title="Contact and support"
        lead="Reach the organising team about taking part, sponsoring, or covering the event."
      />

      <Reveal>
        <section className="pb-24">
          <dl className="flex flex-col">
            {siteConfig.contact.map((c) => (
              <div
                key={c.org}
                className="grid gap-3 border-t border-white/8 py-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-10"
              >
                <dt className="t-item text-starlight">{c.org}</dt>
                <dd className="flex flex-col gap-1">
                  {c.email && (
                    <a
                      href={`mailto:${c.email}`}
                      className="w-fit border-b border-teal/50 pb-0.5 text-teal transition-colors hover:border-teal hover:text-starlight"
                    >
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      className="w-fit text-secondary transition-colors hover:text-starlight"
                    >
                      {c.phone}
                    </a>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <section>
        <h2 className="mb-8 t-section text-starlight">Gallery</h2>
        <Gallery />
      </section>
    </div>
  );
}
