"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type Star = { x: number; y: number; z: number; r: number };

const STAR_COUNT = 140;

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frame = 0;

    const seed = () => {
      stars = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random(),
        y: Math.random(),
        z: Math.random() * 0.8 + 0.2,
        r: Math.random() * 1.1 + 0.3,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const x = s.x * width;
        const y = s.y * height;
        ctx.beginPath();
        ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242, 240, 255, ${0.15 + s.z * 0.5})`;
        ctx.fill();
      }
    };

    const tick = () => {
      for (const s of stars) {
        // Slow upward drift; deeper stars (higher z) move faster for parallax.
        s.y -= s.z * 0.00028;
        if (s.y < -0.02) {
          s.y = 1.02;
          s.x = Math.random();
        }
      }
      draw();
      frame = requestAnimationFrame(tick);
    };

    seed();
    resize();
    window.addEventListener("resize", resize);

    if (reduce) {
      draw();
    } else {
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 h-full w-full pointer-events-none"
    />
  );
}
