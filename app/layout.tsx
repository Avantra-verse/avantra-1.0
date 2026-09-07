import type { Metadata } from "next";
import { Syne, Familjen_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import Starfield from "@/components/Starfield";

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-familjen",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AVANTRA, a multiverse science fair",
  description:
    "A three-day science fair and exhibition hosted by SSRVM IEMS with student clubs from NIT Rourkela.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${familjen.variable}`}>
      <body>
        <Starfield />
        <Nav />
        <main className="pt-16">
          <PageTransition>{children}</PageTransition>
        </main>
        <Footer />
      </body>
    </html>
  );
}
