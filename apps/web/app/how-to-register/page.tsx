import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";
import { REGISTER_PILL } from "@/components/Nav";
import { REGISTER_HREF } from "@/lib/api";

export const metadata: Metadata = { title: "How to register" };

export default function HowToRegister() {
  return (
    <div className="mx-auto max-w-4xl px-6 pb-32">
      <PageHeader title="How to register" lead="Watch this short walkthrough, then sign up for AVANTRA 2026." />
      <Reveal>
        {/* Ember card (DESIGN.md): sky border, red outer ring. */}
        <div className="overflow-hidden rounded-[26px] border-[3px] border-sky shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)]">
          <iframe
            src="https://www.youtube-nocookie.com/embed/7CuLVsEa4yo"
            title="How to register for AVANTRA 2026"
            className="block aspect-video w-full border-0"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <div className="mt-12 flex justify-center">
          <Link href={REGISTER_HREF} className={REGISTER_PILL}>
            Register now
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
