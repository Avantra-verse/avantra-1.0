import type { Metadata } from "next";
import Multiverse from "@/components/multiverse/Multiverse";

export const metadata: Metadata = { title: { absolute: "AVANTRA 2026 – A Multiverse Science Fair" } };

export default function HomePage() {
  return <Multiverse />;
}
