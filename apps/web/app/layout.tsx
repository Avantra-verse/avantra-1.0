import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import AmbientField from "@/components/AmbientField";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const description =
  "AVANTRA 2026: a two-day, Multiverse-themed inter-school science and innovation festival in December 2026, with ARITHI INNOVATION & TECHNOLOGIES PRIVATE LIMITED as event partner.";

export const metadata: Metadata = {
  title: "AVANTRA",
  description,
  openGraph: {
    title: "AVANTRA 2026",
    description,
    type: "website",
    siteName: "AVANTRA",
  },
  twitter: {
    card: "summary_large_image",
    title: "AVANTRA 2026",
    description,
  },
};

export const viewport = {
  themeColor: "#07070e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AmbientField />
        <Nav />
        <main id="main" className="pt-16">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
