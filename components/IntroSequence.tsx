"use client";

import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/content/site";
import PortalAnimation from "./PortalAnimation";

const SEEN_KEY = "avantra-intro-seen";

export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<"checking" | "video" | "fallback" | "done">("checking");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const seen = typeof window !== "undefined" && localStorage.getItem(SEEN_KEY) === "1";
    setMode(seen ? "done" : "video");
  }, []);

  useEffect(() => {
    if (mode === "done") onComplete();
  }, [mode, onComplete]);

  const finish = () => {
    localStorage.setItem(SEEN_KEY, "1");
    setMode("done");
  };

  if (mode === "checking" || mode === "done") return null;

  return (
    <div className="fixed inset-0 z-50 bg-void">
      {mode === "video" && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          src={siteConfig.introVideoSrc}
          autoPlay
          muted
          playsInline
          onEnded={finish}
          onError={() => setMode("fallback")}
        />
      )}
      {mode === "fallback" && <PortalAnimation onComplete={finish} />}
      <button
        onClick={finish}
        className="absolute bottom-6 right-6 text-starlight/80 hover:text-starlight border border-starlight/40 rounded px-4 py-2"
      >
        Skip
      </button>
    </div>
  );
}
