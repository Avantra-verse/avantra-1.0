import type { Metadata } from "next";
import RoomExperience from "@/components/RoomExperience";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <RoomExperience initialScrolledToEnd={false} />;
}
