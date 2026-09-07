import { siteConfig } from "@/content/site";
import Gallery from "@/components/Gallery";

export default function Contact() {
  return (
    <section className="py-16 flex flex-col gap-12">
      <div>
        <h1 className="text-3xl font-bold text-rift-cyan mb-4">Contact & Support</h1>
        <ul className="grid sm:grid-cols-2 gap-4">
          {siteConfig.contact.map((c) => (
            <li key={c.org} className="border border-rift-purple/30 rounded p-4">
              <p className="font-semibold text-starlight">{c.org}</p>
              {c.email && <p className="text-starlight/70 text-sm">{c.email}</p>}
              {c.phone && <p className="text-starlight/70 text-sm">{c.phone}</p>}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Gallery</h2>
        <Gallery />
      </div>
    </section>
  );
}
