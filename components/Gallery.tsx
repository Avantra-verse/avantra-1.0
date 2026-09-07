"use client";

import { useState } from "react";
import { siteConfig } from "@/content/site";

function GalleryImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="aspect-square bg-void border border-rift-purple/30 flex items-center justify-center text-starlight/40 text-sm rounded">
        Image coming soon
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="aspect-square object-cover rounded cursor-pointer hover:scale-105 transition-transform"
    />
  );
}

export default function Gallery() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (siteConfig.gallery.length === 0) {
    return <p className="text-starlight/60 italic">Gallery photos coming soon.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {siteConfig.gallery.map((img) => (
          <div key={img.src} onClick={() => setLightbox(img.src)}>
            <GalleryImage src={img.src} alt={img.alt} />
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-8"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded" />
        </div>
      )}
    </>
  );
}
