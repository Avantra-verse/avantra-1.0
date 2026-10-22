import type { Metadata } from "next";
import RoomExperience from "@/components/RoomExperience";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return <RoomExperience initialScrolledToEnd={true} />;
}
