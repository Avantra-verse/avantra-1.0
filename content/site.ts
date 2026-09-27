export interface SiteConfig {
  eventName: string;
  tagline: string;
  /** Exact start time. null until the dates are confirmed; the nav then shows `eventWhen` instead of a countdown. */
  eventDateISO: string | null;
  eventWhen: string;
  overview: string;
  partners: { name: string; role: string }[];
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
  tagline: "A Multiverse-themed inter-school science & innovation festival",
  eventDateISO: null,
  eventWhen: "December 2026",
  overview:
    "AVANTRA 2026 is a two-day festival where school students bring their own " +
    "science and technology projects, show what they have built, and take on " +
    "hands-on challenges with students from other schools. Everything is set " +
    "in a Multiverse theme. The full line-up is announced soon.",
  partners: [
    { name: "ARITHI Ventures", role: "Event partner, running the festival, its events and registration." },
    { name: "Host school", role: "To be announced." },
  ],
  rules: [
    "Registration, rules and formats will be published before registration opens.",
  ],
  venue: {
    name: "Venue to be announced",
    address: "The venue will be announced with the event dates.",
    directions: "Directions and a map will be published closer to the event.",
  },
  prizes: [
    { title: "Prizes", description: "Prizes for winners. Details will be announced with the line-up." },
    { title: "Certificates", description: "Certificates for every participant." },
  ],
  sponsors: [],
  contact: [
    { org: "ARITHI Ventures", email: "arithitechnologies.contact@zohomail.in", phone: "+91 7846944584" },
  ],
  gallery: [],
  introVideoSrc: "/video/intro.mp4",
};
