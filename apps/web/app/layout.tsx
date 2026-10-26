import type { Metadata } from "next";
import { Gaegu, Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/content/site";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import Starfield from "@/components/Starfield";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const gaegu = Gaegu({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-gaegu",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const description =
  "A science fair and exhibition hosted by SSRVM IEMS with student clubs from NIT Rourkela.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "AVANTRA, a multiverse science fair", template: "%s | AVANTRA 2026" },
  description,
  openGraph: {
    title: "AVANTRA, a multiverse science fair",
    description,
    type: "website",
    siteName: "AVANTRA",
  },
  twitter: {
    card: "summary_large_image",
    title: "AVANTRA, a multiverse science fair",
    description,
  },
};

export const viewport = {
  themeColor: "#120e0c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${gaegu.variable} ${instrumentSerif.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,400;1,500&family=Mukta:wght@400;500;600;700;800&family=Yatra+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Starfield />
        <Nav />
        <main id="main" className="pt-16">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
