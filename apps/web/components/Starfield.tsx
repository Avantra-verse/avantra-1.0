"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface StarFieldProps {
  activeDimension?: number; // 0 to 4
}

interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  colorIndex: number;
}

const SECTION_PROFILES = [
  // 0: Hero
  { speed: 1.0, colors: ["#ff2fb5", "#8a4bff", "#ffffff"] },
  // 1: About
  { speed: 1.3, colors: ["#ffb02f", "#ff2fb5", "#ffffff"] },
  // 2: Dimensions (Warp)
  { speed: 3.2, colors: ["#22e6ff", "#ff2fb5", "#ffffff"] },
  // 3: Timeline (Calm)
  { speed: 0.6, colors: ["#ffb02f", "#ffffff", "#8a4bff"] },
  // 4: Location
  { speed: 1.8, colors: ["#ff2fb5", "#9ad2fb", "#ffffff"] },
];

export default function Starfield({ activeDimension = 0 }: StarFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentSpeedRef = useRef(1.0);
  const targetSpeedRef = useRef(1.0);
  const pathname = usePathname();

  useEffect(() => {
    const profile = SECTION_PROFILES[activeDimension] || SECTION_PROFILES[0];
    targetSpeedRef.current = profile.speed;
  }, [activeDimension]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationFrameId: number;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Initialize 220 particles
    const particleCount = 220;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 0.9 + 0.1, // depth factor
        size: Math.random() * 2 + 0.8,
        baseAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        colorIndex: Math.floor(Math.random() * 3),
      });
    }

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Smoothly transition speed
      currentSpeedRef.current +=
        (targetSpeedRef.current - currentSpeedRef.current) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const profile = SECTION_PROFILES[activeDimension] || SECTION_PROFILES[0];

      particles.forEach((p) => {
        // Move up and right based on depth & speed
        const speed = currentSpeedRef.current * p.z * 40;
        p.x += speed * dt * 0.5;
        p.y -= speed * dt;

        // Wrap around screen edges
        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }
        if (p.x > width) {
          p.x = 0;
          p.y = Math.random() * height;
        }

        // Twinkle effect
        p.twinklePhase += p.twinkleSpeed;
        const twinkleAlpha =
          p.baseAlpha + Math.sin(p.twinklePhase) * 0.25;
        const finalAlpha = Math.max(0.1, Math.min(1, twinkleAlpha));

        const colorHex = profile.colors[p.colorIndex] || profile.colors[0];

        ctx.save();
        ctx.globalAlpha = finalAlpha;
        ctx.fillStyle = colorHex;
        ctx.shadowBlur = p.size * 3;
        ctx.shadowColor = colorHex;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.z, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeDimension]);

  if (pathname === "/about" || pathname === "/contact" || pathname === "/registration") {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none mix-blend-screen z-0"
      style={{ opacity: 0.85 }}
    />
  );
}
