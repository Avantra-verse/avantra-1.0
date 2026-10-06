"use client";

import React, { useEffect, useRef, useState } from "react";

interface ScrubVideoProps {
  src: string;
  webmSrc?: string;
  poster: string;
  trackHeight?: string;
  mode?: "sticky" | "inView";
  overlayTint?: string;
  children?: React.ReactNode;
  className?: string;
  videoClassName?: string;
  forceCanvas?: boolean;
  canvasFramesPath?: string;
  totalFrames?: number;
}

export default function ScrubVideo({
  src,
  webmSrc,
  poster,
  trackHeight = "300vh",
  mode = "sticky",
  overlayTint,
  children,
  className = "",
  videoClassName = "",
  forceCanvas = false,
  canvasFramesPath,
  totalFrames = 0,
}: ScrubVideoProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [useCanvas, setUseCanvas] = useState(forceCanvas);

  const durationRef = useRef(0);
  const targetTimeRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const framesCacheRef = useRef<HTMLImageElement[]>([]);

  // 1. Reduced motion check
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // 2. IntersectionObserver (active when track is near viewport)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { rootMargin: "100% 0px 100% 0px" }
    );

    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  // 3. Video metadata listener & touch unlock
  useEffect(() => {
    const video = videoRef.current;
    if (!video || useCanvas) return;

    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        durationRef.current = video.duration;
        setIsLoaded(true);
      }
    };

    const handleCanPlay = () => {
      setIsLoaded(true);
    };

    const handleError = () => {
      if (canvasFramesPath && totalFrames > 0) {
        setUseCanvas(true);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    if (video.readyState >= 1 && video.duration) {
      handleLoadedMetadata();
    }

    video.load();

    const unlockTouch = () => {
      if (video.paused) {
        video
          .play()
          .then(() => video.pause())
          .catch(() => {});
      }
      window.removeEventListener("touchstart", unlockTouch);
    };
    window.addEventListener("touchstart", unlockTouch, { passive: true });

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
      window.removeEventListener("touchstart", unlockTouch);
    };
  }, [src, useCanvas, canvasFramesPath, totalFrames]);

  // 4. Preload Canvas frames if fallback active
  useEffect(() => {
    if (!useCanvas || !canvasFramesPath || totalFrames <= 0) return;

    const images: HTMLImageElement[] = [];
    for (let i = 1; i <= totalFrames; i++) {
      const img = new Image();
      const numStr = i.toString().padStart(4, "0");
      img.src = `${canvasFramesPath}/frame_${numStr}.webp`;
      images.push(img);
    }
    framesCacheRef.current = images;
  }, [useCanvas, canvasFramesPath, totalFrames]);

  // 5. Scroll animation frame scrub loop
  useEffect(() => {
    if (reducedMotion || !isInView) return;

    const updateScrub = () => {
      const track = trackRef.current;
      if (!track) {
        rafIdRef.current = requestAnimationFrame(updateScrub);
        return;
      }

      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;

      let progress = 0;
      if (mode === "sticky") {
        const scrollableDistance = rect.height - vh;
        if (scrollableDistance > 0) {
          progress = -rect.top / scrollableDistance;
        }
      } else {
        // inView mode (phone frames)
        const totalDist = rect.height + vh;
        progress = (vh - rect.top) / totalDist;
      }

      progress = Math.max(0, Math.min(1, progress));

      if (useCanvas && canvasRef.current && totalFrames > 0) {
        const frameIndex = Math.min(
          totalFrames - 1,
          Math.floor(progress * totalFrames)
        );
        const img = framesCacheRef.current[frameIndex];
        // SAFE DRAW: Check img complete AND naturalWidth > 0 to avoid broken image error
        if (img && img.complete && img.naturalWidth > 0) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            ctx.drawImage(
              img,
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );
          }
        }
      } else {
        const video = videoRef.current;
        if (video) {
          if (!durationRef.current && video.duration) {
            durationRef.current = video.duration;
          }

          if (durationRef.current > 0) {
            targetTimeRef.current = progress * durationRef.current;

            // Easing lerp toward target time
            currentTimeRef.current +=
              (targetTimeRef.current - currentTimeRef.current) * 0.18;

            const diff = Math.abs(video.currentTime - currentTimeRef.current);

            if (diff > 0.005 && video.readyState >= 2) {
              try {
                video.currentTime = currentTimeRef.current;
              } catch (e) {
                // Ignore transient seek errors
              }
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(updateScrub);
    };

    rafIdRef.current = requestAnimationFrame(updateScrub);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isInView, reducedMotion, mode, useCanvas, totalFrames]);

  return (
    <div
      ref={trackRef}
      style={{ height: mode === "sticky" ? trackHeight : "100%" }}
      className={`relative w-full ${className}`}
    >
      <div
        className={
          mode === "sticky"
            ? "sticky top-0 h-screen w-full overflow-hidden"
            : "relative h-full w-full overflow-hidden"
        }
      >
        {/* Background Overlay Tint Layer */}
        {overlayTint && (
          <div
            className="pointer-events-none absolute inset-0 z-10"
            style={{ background: overlayTint }}
          />
        )}

        {/* Poster Image (Stays visible until video metadata/canplay is ready) */}
        {poster && (
          <img
            src={poster}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 z-0 ${
              isLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          />
        )}

        {/* Canvas Render (Fallback if forceCanvas or video fails) */}
        {useCanvas ? (
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className={`absolute inset-0 h-full w-full object-cover ${videoClassName}`}
            style={{ willChange: "transform" }}
          />
        ) : (
          /* HTML5 Video Element (Default Primary Renderer) */
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            poster={poster}
            aria-hidden="true"
            tabIndex={-1}
            className={`absolute inset-0 h-full w-full object-cover ${videoClassName}`}
            style={{ willChange: "transform" }}
          >
            <source src={src} type="video/mp4" />
            {webmSrc && <source src={webmSrc} type="video/webm" />}
          </video>
        )}

        {/* Overlaid Content */}
        {children && (
          <div className="relative z-20 flex h-full w-full items-center justify-center">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
