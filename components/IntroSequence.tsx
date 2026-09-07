"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/content/site";
import PortalAnimation from "./PortalAnimation";

const SEEN_KEY = "avantra-intro-seen";
const VIDEO_TIMEOUT_MS = 8000;

export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<"checking" | "video" | "fallback" | "done">("checking");

  useEffect(() => {
    let seen = false;
    try {
      seen = typeof window !== "undefined" && sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only storage read must run post-mount to avoid SSR hydration mismatch
    setMode(seen ? "done" : "video");
  }, []);

  useEffect(() => {
    if (mode === "done") onComplete();
  }, [mode, onComplete]);

  const finish = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked; still proceed past the intro
    }
    setMode("done");
  };

  // Safety net: if autoplay is blocked or the video stalls, onEnded may never fire.
  useEffect(() => {
    if (mode !== "video") return;
    const timer = setTimeout(finish, VIDEO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mode]);

  if (mode === "checking" || mode === "done") return null;

  return (
    <div className="fixed inset-0 z-50 bg-void">
      {mode === "video" && (
        <video
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
