import type { Metadata } from "next";
import { Archivo, Gaegu, Instrument_Serif, Instrument_Sans } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import Starfield from "@/components/Starfield";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

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
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const description =
  "A three-day science fair and exhibition hosted by SSRVM IEMS with student clubs from NIT Rourkela.";

export const metadata: Metadata = {
  title: "AVANTRA, a multiverse science fair",
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
  themeColor: "#07070e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${gaegu.variable} ${instrumentSerif.variable} ${instrumentSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Instrument+Serif:ital@1&family=Instrument+Sans:wght@400;500&family=Mukta:wght@400;500;600&family=Yatra+One&display=swap"
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
      </body>
    </html>
  );
}
