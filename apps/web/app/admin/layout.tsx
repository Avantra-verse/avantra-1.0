import type { Metadata } from "next";

// Admin is unlisted: nothing links here and search engines are told not to index it.
// Access still needs an admin account, its password and the emailed code.
export const metadata: Metadata = { title: "AVANTRA", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
