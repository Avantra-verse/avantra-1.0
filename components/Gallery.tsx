"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/content/site";
import Reveal from "./Reveal";

function GalleryImage({
  src,
  alt,
  onError,
}: {
  src: string;
  alt: string;
  onError: () => void;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="panel flex aspect-square items-center justify-center text-sm text-starlight/40">
        Image coming soon
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => {
        setFailed(true);
        onError();
      }}
      className="aspect-square w-full rounded-2xl object-cover transition-transform duration-300 hover:scale-[1.04]"
    />
  );
}

export default function Gallery() {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(new Set());

  // Close the lightbox on Escape as well as click.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  if (siteConfig.gallery.length === 0) {
    return (
      <div className="panel px-8 py-16 text-center">
        <p className="font-display text-xl text-starlight/80">Gallery photos coming soon</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-starlight/55">
          Photos from the exhibition appear here once the event runs.
        </p>
      </div>
    );
  }

  const lightboxAlt = siteConfig.gallery.find((img) => img.src === lightbox)?.alt ?? "";

  return (
    <Reveal>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {siteConfig.gallery.map((img) => (
          <button
            key={img.src}
            type="button"
            aria-label={`Open ${img.alt}`}
            disabled={failedSrcs.has(img.src)}
            onClick={() => setLightbox(img.src)}
            className="block overflow-hidden rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rift-cyan disabled:cursor-default"
          >
            <GalleryImage
              src={img.src}
              alt={img.alt}
              onError={() => setFailedSrcs((prev) => new Set(prev).add(img.src))}
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxAlt || "Gallery image"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-8 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close image"
            onClick={() => setLightbox(null)}
            className="absolute right-6 top-6 rounded-full border border-white/25 px-4 py-2 text-sm text-starlight/80 transition-colors hover:text-starlight"
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt={lightboxAlt}
            onError={() => setLightbox(null)}
            className="max-h-full max-w-full rounded-2xl"
          />
        </div>
      )}
    </Reveal>
  );
}
