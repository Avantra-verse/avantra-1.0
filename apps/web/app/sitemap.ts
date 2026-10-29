import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

// Public pages only; logged-in areas are blocked in robots.ts.
const pages = ["", "/about", "/venue", "/organizers", "/contact", "/wall", "/ambassador"];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((p) => ({ url: SITE_URL + p, changeFrequency: "weekly", priority: p ? 0.7 : 1 }));
}
