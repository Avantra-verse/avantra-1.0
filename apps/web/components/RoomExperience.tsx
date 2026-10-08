"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ContactRequest } from "@avantra/shared";
import { api, ApiError, apiReady } from "@/lib/api";
import styles from "./RoomExperience.module.css";

interface RoomExperienceProps {
  initialScrolledToEnd?: boolean;
}

export default function RoomExperience({ initialScrolledToEnd = false }: RoomExperienceProps) {
  const [mounted, setMounted] = useState(false);

  const viewRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const ctRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dot0Ref = useRef<HTMLButtonElement>(null);
  const dot1Ref = useRef<HTMLButtonElement>(null);
  const dot2Ref = useRef<HTMLButtonElement>(null);

  const nARef = useRef<HTMLButtonElement>(null);
  const nCRef = useRef<HTMLButtonElement>(null);

  const PRef = useRef<number>(700);
  const curRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // camera sits at the room centre and turns rightwards (positive angles): [progress, yaw]
    // Face 1 (About us): 0deg
    // Face 2 (Step through video cards on the right): +90deg
    // Face 3 (Questions? Step in arched door to the right of Face 2): +180deg
    const K: [number, number][] = [
      [0, 0],
      [0.12, 0],
      [0.32, 90],
      [0.48, 90],
      [0.68, 180],
      [1, 180],
    ];

    const ss = (t: number) => t * t * (3 - 2 * t);

    function yaw(p: number): number {
      for (let i = 1; i < K.length; i++) {
        if (p <= K[i][0]) {
          const a = K[i - 1];
          const b = K[i];
          return a[1] + (b[1] - a[1]) * ss((p - a[0]) / (b[0] - a[0]));
        }
      }
      return 180;
    }

    function fit() {
      if (!viewRef.current) return;
      PRef.current = 800 * Math.min(window.innerWidth / 1600, window.innerHeight / 900) * 0.9;
      viewRef.current.style.perspective = `${PRef.current}px`;
    }

    fit();
    window.addEventListener("resize", fit);

    const getMax = () => document.documentElement.scrollHeight - window.innerHeight;

    if (initialScrolledToEnd) {
      const maxVal = getMax();
      window.scrollTo(0, maxVal);
      curRef.current = 1;
    } else {
      const maxVal = getMax();
      curRef.current = reduce ? (maxVal > 0 ? Math.min(1, window.scrollY / maxVal) : 0) : 0;
    }

    // Play videos
    if (containerRef.current) {
      const videos = containerRef.current.querySelectorAll("video");
      videos.forEach((v) => {
        v.muted = true;
        v.play().catch(() => {});
      });
    }

    let animId: number;
    const LERP_FACTOR = 0.25;

    function frame() {
      const maxVal = getMax();
      const tp = maxVal > 0 ? Math.min(1, Math.max(0, window.scrollY / maxVal)) : 0;

      if (reduce) {
        curRef.current = tp;
      } else {
        curRef.current += (tp - curRef.current) * LERP_FACTOR;
      }

      if (Math.abs(tp - curRef.current) < 1e-4) {
        curRef.current = tp;
      }

      const cur = curRef.current;

      if (roomRef.current) {
        roomRef.current.style.transform = `translateZ(${PRef.current}px) rotateY(${yaw(cur)}deg)`;
      }

      // Transition from Face 3 (arched door) to Contact us card starts at cur >= 0.68
      const f = Math.min(1, Math.max(0, (cur - 0.68) / 0.17));

      if (camRef.current) {
        camRef.current.style.transform = `scale(${1 + f * 0.5})`;
      }

      if (ctRef.current) {
        ctRef.current.style.opacity = `${f}`;
        ctRef.current.style.transform = `scale(${0.9 + 0.1 * f})`;
        ctRef.current.classList.toggle(styles.live, f > 0.4);
      }

      const face = cur < 0.22 ? 0 : cur < 0.58 ? 1 : 2;

      if (dot0Ref.current) dot0Ref.current.classList.toggle(styles.on, face === 0);
      if (dot1Ref.current) dot1Ref.current.classList.toggle(styles.on, face === 1);
      if (dot2Ref.current) dot2Ref.current.classList.toggle(styles.on, face === 2);

      if (nARef.current) nARef.current.classList.toggle(styles.on, cur < 0.68);
      if (nCRef.current) nCRef.current.classList.toggle(styles.on, cur >= 0.68);

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", fit);
      cancelAnimationFrame(animId);
    };
  }, [mounted, initialScrolledToEnd]);

  const go = (y: number) => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  };

  const getMax = () => (typeof document !== "undefined" ? document.documentElement.scrollHeight - window.innerHeight : 0);

  const fixedContent = (
    <div ref={containerRef}>
      <header className={styles.header}>
        <Link href="/" aria-label="AVANTRA home">
          <img src="/images/avantra-logo.png" alt="Avantra" />
        </Link>
        <em>December 2026, dates soon</em>
        <nav className={styles.nav}>
          <button ref={nARef} id="nA" className={styles.on} onClick={() => go(0)}>
            About
          </button>
          <Link href="/venue">Venue</Link>
          <Link href="/sponsors">Sponsors</Link>
          <button ref={nCRef} id="nC" onClick={() => go(getMax())}>
            Contact
          </button>
          <Link href="/login">Log in</Link>
          <Link href="/registration">Registration</Link>
        </nav>
      </header>

      <div id="bar" className={styles.bar} aria-label="Room faces">
        <button ref={dot0Ref} aria-label="About" onClick={() => go(0.04 * getMax())}></button>
        <button ref={dot1Ref} aria-label="Experiences" onClick={() => go(0.4 * getMax())}></button>
        <button ref={dot2Ref} aria-label="Contact" onClick={() => go(0.68 * getMax())}></button>
      </div>

      <div id="view" ref={viewRef} className={styles.view}>
        <div id="cam" ref={camRef} className={styles.cam}>
          <div id="room" ref={roomRef} className={styles.room}>
            <div className={`${styles.w} ${styles.fl}`}></div>
            <div className={`${styles.w} ${styles.ce}`}></div>

            {/* Face 1: About us */}
            <div className={`${styles.w} ${styles.f1}`}>
              <div className={styles.in}>
                <div className={styles.left}>
                  <h1 className={`${styles.h2} ${styles.hand}`}>
                    About <span className={styles.ser}>us</span>
                  </h1>
                  <p className={`${styles.lead} ${styles.hand}`}>
                    AVANTRA 2026 is{" "}
                    <span>
                      a two-day festival where school students bring their own science and technology projects, show
                      what they have built, and take on hands-on challenges with students from other schools.
                    </span>
                  </p>
                  <div className={styles.cards}>
                    <div className={styles.card}>
                      <b>When</b>December 2026, dates soon
                    </div>
                    <div className={styles.card}>
                      <b>Where</b>SSRVM IEMS
                    </div>
                    <div className={styles.card}>
                      <b>How long</b>2 days
                    </div>
                  </div>
                </div>

                <div className={styles.win}>
                  <video src="/videos/retro-mountains-moon.mp4" data-v="retro" autoPlay loop muted playsInline></video>
                  <i></i>
                </div>

                <div className={styles.side}>
                  <div>
                    <h3>Who runs it</h3>
                    <p>
                      <b>ARITHI INNOVATION &amp; TECHNOLOGIES PRIVATE LIMITED</b> runs the festival, its events and
                      registration.
                    </p>
                  </div>
                  <div>
                    <h3>Host school</h3>
                    <p>SSRVM IEMS hosts AVANTRA 2026 and provides the venue.</p>
                    <h3>Rules</h3>
                    <p>Published before registration opens.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Face 2: Step through (Video cards on the right wall) */}
            <div className={`${styles.w} ${styles.f2}`}>
              <div className={styles.in} style={{ inset: "50px 90px 90px" }}>
                <h2 className={styles.h2}>
                  Step <span className={styles.ser}>through</span>
                </h2>
                <div className={styles.row}>
                  <div className={styles.v}>
                    <video src="/videos/neon-hex-tunnel.mp4" data-v="neon" autoPlay loop muted playsInline></video>
                    <div>
                      <h3>The Showcase</h3>
                      <p>Bring your own science or technology project and show what you built.</p>
                    </div>
                  </div>
                  <div className={styles.v}>
                    <video src="/videos/retro-mountains-moon.mp4" data-v="retro" autoPlay loop muted playsInline></video>
                    <div>
                      <h3>The Challenge Floor</h3>
                      <p>Hands-on challenges, taken on with students from other schools.</p>
                    </div>
                  </div>
                  <div className={styles.v}>
                    <video src="/videos/exchange-showcase.mp4" data-v="exch" autoPlay loop muted playsInline></video>
                    <div>
                      <h3>The Exchange</h3>
                      <p>Trade questions and ideas with students you would never meet at home.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Face 3: Questions? Step in (Arched door on back wall, right of Face 2) */}
            <div className={`${styles.w} ${styles.f3}`}>
              <div className={styles.in} style={{ inset: 0 }}>
                <div className={styles.door}>
                  <video src="/videos/neon-hex-tunnel.mp4" data-v="neon" autoPlay loop muted playsInline></video>
                </div>
                <div className={styles.sign}>
                  <h2>
                    Questions? <span className={styles.ser}>Step in.</span>
                  </h2>
                </div>
              </div>
            </div>

            {/* Face 4 */}
            <div className={`${styles.w} ${styles.f4}`}>
              <div className={styles.in}>
                <h2 className={styles.h2}>Back to the start</h2>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="contact" ref={ctRef} className={styles.contact} aria-label="Contact">
        <video src="/videos/neon-hex-tunnel.mp4" data-v="neon" autoPlay loop muted playsInline></video>
        <div className={styles.cw}>
          <div>
            <h2>
              Write to <span className={styles.ser}>the team</span>
            </h2>
            <p>Registration opens with the line-up. Ask anything before then.</p>
            <button className={styles.bk} id="bk" onClick={() => go(0)}>
              Back to About
            </button>
          </div>
          <ContactForm />
        </div>
      </section>
    </div>
  );

  return (
    <div id="room-experience" className={styles.roomExperience}>
      {mounted && createPortal(fixedContent, document.body)}
      <div className={styles.spacer} />
    </div>
  );
}

const emptyContact = { name: "", school: "", email: "", message: "", website: "" };

// "Write to the team": POST /contact emails the team, with reply-to set to the sender.
function ContactForm() {
  const [form, setForm] = useState(emptyContact);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((x) => ({ ...x, [e.target.name]: "", form: "" }));
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = ContactRequest.safeParse({ ...form, school: form.school || undefined, website: form.website || undefined });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const i of parsed.error.issues) found[String(i.path[0])] ??= i.message;
      setErrors(found);
      document.getElementById(`contact-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setState("sending");
    try {
      await api("/contact", parsed.data);
      setState("sent");
      setForm(emptyContact);
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ ...ae.fields, form: ae.status === 429 ? "Too many messages. Wait a minute and try again." : ae.message });
      setState("idle");
    }
  }

  if (state === "sent")
    return (
      <div className={styles.formCard} role="status">
        <p className={styles.formNote}>Thanks, your message is with the team. We&apos;ll reply to your email.</p>
        <button type="button" className={styles.sendBtn} onClick={() => setState("idle")}>
          Send another
        </button>
      </div>
    );

  const field = (name: "name" | "school" | "email", label: string, type = "text", autoComplete?: string) => (
    <div className={styles.field}>
      <label htmlFor={`contact-${name}`}>{label}</label>
      <input
        id={`contact-${name}`}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={form[name]}
        onChange={set}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `contact-${name}-error` : undefined}
      />
      {errors[name] && <span id={`contact-${name}-error`} className={styles.fieldError}>{errors[name]}</span>}
    </div>
  );

  return (
    <form className={styles.formCard} onSubmit={send} noValidate>
      {field("name", "Your name", "text", "name")}
      {field("school", "School (optional)", "text", "organization")}
      {field("email", "Email", "email", "email")}
      <div className={styles.field}>
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          rows={3}
          value={form.message}
          onChange={set}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "contact-message-error" : undefined}
        ></textarea>
        {errors.message && <span id="contact-message-error" className={styles.fieldError}>{errors.message}</span>}
      </div>
      {/* Trap for bots: hidden from people and screen readers. */}
      <input className={styles.trap} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set} />
      {errors.form && <p className={styles.fieldError} role="alert">{errors.form}</p>}
      {!apiReady && <p className={styles.formNote}>Messages open soon.</p>}
      <button type="submit" className={styles.sendBtn} disabled={state === "sending" || !apiReady}>
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
