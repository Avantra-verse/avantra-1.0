export const SITE_URL = "https://avantra.arithi.in";

export interface SiteConfig {
  eventName: string;
  tagline: string;
  eventDateISO: string;
  overview: string;
  partners: { name: string; role: string }[];
  days: { title: string; description: string }[];
  rules: string[];
  venue: { name: string; address: string; directions: string; mapUrl: string };
  prizes: { title: string; description: string }[];
  sponsors: { name: string; tier: string }[];
  contact: { org: string; email: string; phone: string }[];
  instagram: string; // AVANTRA's account, @avantra.verse
  whatsappChannel: string; // AVANTRA's WhatsApp channel (updates, not the ambassador group)
  // The school's UPI for the ₹299 exhibition fee. Empty id = the pay box says payments open soon.
  upi: { id: string; payee: string; qrSrc: string };
  // Science Exhibition students only; must match private.fee_paise in the database.
  fee: { exhibition: number; stay: number };
  gallery: { src: string; alt: string }[];
  introVideoSrc: string;
}

export const siteConfig: SiteConfig = {
  eventName: "AVANTRA",
  tagline: "A Multiverse-Themed Science Fair & Exhibition",
  eventDateISO: "2026-12-19T00:00:00",
  overview:
    "AVANTRA is a two-day science fair and exhibition hosted by SSRVM IEMS, " +
    "organized in partnership with ARITHI, which runs the events and sessions, " +
    "all built around a Multiverse theme.",
  partners: [
    { name: "SSRVM IEMS", role: "Institutional Partner. Hosts the event, provides venue and infrastructure, handles internal coordination." },
    { name: "ARITHI", role: "Event Partner. Plans the event, brings sponsorship, runs the events and sessions." },
    { name: "Sponsors", role: "Fund and support the event to keep school spend low." },
  ],
  days: [
    { title: "Day 1", description: "Opening and science exhibition. Exhibits from school students open to view, plus the inaugural session." },
    { title: "Day 2", description: "Competitive events and challenges run across the day, alongside continuing exhibition, followed by results and the closing ceremony." },
  ],
  rules: [
    "Details to be published closer to the event by the organizing committee.",
  ],
  venue: {
    name: "SSRVM IEMS",
    address: "Ispat English Medium School, Sector 20, Rourkela, Odisha",
    directions: "Directions are on Google Maps.",
    mapUrl: "https://maps.app.goo.gl/5UULyULJRH4CXrgS6",
  },
  prizes: [
    { title: "Junior Category (Classes 6–8)", description: "AVANTRA Junior Champion, Young Innovator, Science Breakthrough, Emerging Inventor, Impact & Sustainability." },
    { title: "Senior Category (Classes 9–12)", description: "AVANTRA Senior Champion, Future Innovator, Scientific Breakthrough, Next-Gen Inventor, Real-World Impact." },
    { title: "Certificates & Trophies", description: "Official championship trophies, medals, and certificates of achievement issued to all winning teams and participants." },
  ],
  sponsors: [],
  contact: [
    { org: "ARITHI", email: "contact@arithi.in", phone: "" },
  ],
  instagram: "https://www.instagram.com/avantra.verse",
  whatsappChannel: "https://whatsapp.com/channel/0029Vb9RT1z5a248YFlBfP3N",
  upi: { id: "vyapar.176548151671@hdfcbank", payee: "SSRVM IEMS", qrSrc: "/upi-qr.png" },
  fee: { exhibition: 299, stay: 599 },
  gallery: [],
  introVideoSrc: "/video/intro.mp4",
};
