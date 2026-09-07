"use client";

import { useState } from "react";
import IntroSequence from "@/components/IntroSequence";
import CountdownTimer from "@/components/CountdownTimer";
import { siteConfig } from "@/content/site";

export default function Home() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      <IntroSequence onComplete={() => setIntroDone(true)} />
      {introDone && (
        <section className="flex flex-col items-center text-center gap-6 py-24">
          <h1 className="text-5xl font-extrabold bg-gradient-to-br from-rift-purple via-rift-pink to-rift-cyan bg-clip-text text-transparent">
            {siteConfig.eventName}
          </h1>
          <p className="text-xl text-starlight/80 max-w-xl">{siteConfig.tagline}</p>
          <CountdownTimer />
          <p className="max-w-2xl text-starlight/70">{siteConfig.overview}</p>
        </section>
      )}
    </>
  );
}
