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
