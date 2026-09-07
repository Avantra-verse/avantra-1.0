export interface SiteConfig {
  eventName: string;
  tagline: string;
  eventDateISO: string;
  overview: string;
  partners: { name: string; role: string }[];
  days: { title: string; description: string }[];
  rules: string[];
  venue: { name: string; address: string; directions: string };
  prizes: { title: string; description: string }[];
  sponsors: { name: string; tier: string }[];
  contact: { org: string; email: string; phone: string }[];
  gallery: { src: string; alt: string }[];
  introVideoSrc: string;
}

export const siteConfig: SiteConfig = {
  eventName: "AVANTRA",
  tagline: "A Multiverse-Themed Science Fair & Exhibition",
  eventDateISO: "2026-12-01T00:00:00",
  overview:
    "AVANTRA is a three-day science fair and exhibition hosted by SSRVM IEMS, " +
    "organized in partnership with ARITHI. Student clubs from NIT Rourkela " +
    "showcase projects and run sessions, bringing college-level science " +
    "exposure to school students, all built around a Multiverse theme.",
  partners: [
    { name: "SSRVM IEMS", role: "Institutional Partner. Hosts the event, provides venue and infrastructure, handles internal coordination." },
    { name: "ARITHI", role: "Event Partner. Plans the event, brings sponsorship, coordinates NIT Rourkela clubs, runs execution." },
    { name: "Sponsors", role: "Fund and support the event to keep school spend low." },
    { name: "NIT Rourkela Clubs", role: "Showcase projects and conduct science events and sessions for students." },
  ],
  days: [
    { title: "Day 1", description: "Opening and science exhibition. Exhibits from school students and NIT Rourkela clubs open to view, plus the inaugural session." },
    { title: "Day 2", description: "Science-related competitive events and challenges run across the day, alongside continuing exhibition." },
    { title: "Day 3", description: "Remaining events, NIT Rourkela club showcases and sessions, results, and closing ceremony." },
  ],
  rules: [
    "Details to be published closer to the event by the organizing committee.",
  ],
  venue: {
    name: "SSRVM IEMS",
    address: "To be confirmed by the organizing committee.",
    directions: "Directions and map will be published closer to the event.",
  },
  prizes: [
    { title: "Certificates", description: "Certificates of participation and achievement will be issued to all exhibitors and event winners." },
  ],
  sponsors: [],
  contact: [
    { org: "ARITHI", email: "contact@arithi.example", phone: "" },
    { org: "SSRVM IEMS", email: "info@ssrvmiems.example", phone: "" },
  ],
  gallery: [],
  introVideoSrc: "/video/intro.mp4",
};
