import type { Metadata } from "next";
import { siteConfig } from "@/content/site";
import PageHeader from "@/components/PageHeader";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact" };

const card = "rounded-2xl border-2 border-sky/40 bg-panel/80 p-5 shadow-[3px_3px_0_0_var(--color-ember)]";
const label = "block text-xs font-bold tracking-wider text-sky uppercase";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-24 pb-32 sm:px-6">
      <PageHeader title="Write to the team" lead="Ask us anything about registrations, exhibitions, rulebooks, or the venue." />
      <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <div className={card}>
            <span className={label}>Email</span>
            <a href="mailto:contact@arithi.in" className="mt-1 block break-all text-starlight underline">contact@arithi.in</a>
          </div>
          <div className={card}>
            <span className={label}>Phone</span>
            <a href="tel:+917846944584" className="mt-1 block text-starlight underline">Rohnit: +91 78469 44584</a>
            <a href="tel:+919040408179" className="mt-1 block text-starlight underline">Giri: +91 90404 08179</a>
          </div>
          <div className={card}>
            <span className={label}>Instagram</span>
            <a href={siteConfig.instagram} target="_blank" rel="noopener noreferrer" className="mt-1 block text-starlight underline">@avantra.verse</a>
          </div>
          <div className={card}>
            <span className={label}>Host venue</span>
            <p className="mt-1 text-starlight">SSRVM IEMS Sec-20</p>
          </div>
        </div>
        <div className={card}>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
