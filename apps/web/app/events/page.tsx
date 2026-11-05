"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import Reveal from "@/components/Reveal";
import { REGISTER_HREF } from "@/lib/api";
import { EXHIBITION_TOPICS } from "@avantra/shared";
import styles from "./events.module.css";

// Multiverse Containment + Chrono-Quest are not final yet; set true to show them again.
const SHOW_UNFINISHED_FUN = false;

/* ═══════════════════════════════════════════════════════════
   Circuit Board Corner SVG (Brochure Design Detail)
   ═══════════════════════════════════════════════════════════ */
function CircuitCorner({ position = "topLeft" }: { position?: "topLeft" | "bottomRight" }) {
  if (position === "topLeft") {
    return (
      <svg className={styles.circuitCornerTL} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 5 95 L 5 25 L 25 5 L 95 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M 15 95 L 15 35 L 35 15 L 75 15" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" strokeLinecap="round" />
        <circle cx="95" cy="5" r="3.5" fill="currentColor" />
        <circle cx="75" cy="15" r="3" fill="currentColor" />
        <circle cx="5" cy="95" r="3.5" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={styles.circuitCornerBR} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M 95 5 L 95 75 L 75 95 L 5 95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M 85 5 L 85 65 L 65 85 L 25 85" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.7" strokeLinecap="round" />
      <circle cx="5" cy="95" r="3.5" fill="currentColor" />
      <circle cx="25" cy="85" r="3" fill="currentColor" />
      <circle cx="95" cy="5" r="3.5" fill="currentColor" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   Cosmic Starfield Particle Canvas (Ember Multiverse Atmosphere)
   ═══════════════════════════════════════════════════════════ */
function HeroStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0;
    let frameId: number;

    interface Star {
      x: number; y: number; z: number; size: number;
      baseAlpha: number; speed: number; phase: number; color: string;
    }
    const stars: Star[] = [];
    const palette = ["#9fd4ff", "#f4ead9", "#ff5560", "#ffffff"];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (let i = 0; i < 160; i++) {
      stars.push({
        x: Math.random() * (w || 1000),
        y: Math.random() * (h || 800),
        z: Math.random() * 0.8 + 0.2,
        size: Math.random() * 1.8 + 0.5,
        baseAlpha: Math.random() * 0.55 + 0.25,
        speed: Math.random() * 0.025 + 0.008,
        phase: Math.random() * Math.PI * 2,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      stars.forEach((s) => {
        s.phase += s.speed;
        s.y -= s.z * 0.35;
        s.x += s.z * 0.18;
        if (s.y < 0) { s.y = h; s.x = Math.random() * w; }
        if (s.x > w) { s.x = 0; s.y = Math.random() * h; }

        const alpha = Math.max(0.1, Math.min(1, s.baseAlpha + Math.sin(s.phase) * 0.28));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.shadowBlur = s.size * 3.5;
        ctx.shadowColor = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.z, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      if (!still) frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    // Resizing clears the canvas, so a still starfield is drawn again.
    const onResize = () => { resize(); if (still) render(); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.heroCanvas} aria-hidden="true" />;
}

/* ═══════════════════════════════════════════════════════════
   Event Image Frame Component
   Ready to receive user images seamlessly with custom fallback
   ═══════════════════════════════════════════════════════════ */
function EventImageFrame({
  src,
  alt,
  icon,
  label,
  categoryBadge,
  isLive = false,
}: {
  src?: string;
  alt?: string;
  icon?: React.ReactNode;
  label: string;
  categoryBadge: string;
  isLive?: boolean;
}) {
  return (
    <div className={styles.eventImageSlot}>
      <span className={`${styles.eventStatusPill} ${isLive ? styles.eventStatusPillLive : ""}`}>
        {categoryBadge}
      </span>

      {src ? (
        <img src={src} alt={alt || label} className={styles.eventImageSlotImg} />
      ) : (
        <div className={styles.cyberSlotPlaceholder}>
          <div className={styles.cyberSlotIcon}>
            {icon || (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
          </div>
          <span className={styles.cyberSlotLabel}>{label}</span>
          <span className={styles.cyberSlotHint}>Multiverse Showcase Sector</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN EVENTS PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function EventsPage() {
  const reduce = useReducedMotion();
  const [activeSection, setActiveSection] = useState<string>("flagship-details");

  const scrollTo = useCallback((id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="relative min-h-screen bg-[#120e0c] text-[#f4ead9]">
      {/* ══════════════════════════════════════════════════════
          CRAZY FULL VIEWPORT HERO — MULTIVERSE SCIENCE FESTIVAL
          ══════════════════════════════════════════════════════ */}
      <section className={styles.hero}>
        {/* Layer 1: Cosmic Multiverse Portal Background */}
        <div className={styles.heroBackdrop} aria-hidden="true">
          <img
            src="/events/hero-portal.webp"
            alt=""
            className={styles.heroPortalImg}
          />
          <div className={styles.heroScrimTop} />
          <div className={styles.heroScrimBottom} />
          <div className={styles.heroVignette} />
        </div>

        {/* Layer 2: Film Grain & Animated Stars */}
        <div className={styles.heroGrain} aria-hidden="true" />
        <HeroStarfield />

        {/* Sleek Floating Venue & Date Telemetry Badge */}
        <motion.div
          className={styles.sleekTopBadge}
          initial={reduce ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className={styles.sleekVenue}>SSRVM IEMS, ROURKELA</span>
          <span className={styles.sleekDivider}>/</span>
          <span className={styles.sleekDate}>19–20 DEC 2026</span>
        </motion.div>

        {/* Centerpiece 3D Hero Title & Highlights */}
        <motion.div
          className={styles.heroCenter}
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className={styles.heroTaglinePill}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <span>✦</span>
            <span>AVANTRA 2026 FLAGSHIP EVENT</span>
            <span>✦</span>
          </motion.div>

          <motion.h1
            className={styles.heroTitle3D}
            initial={reduce ? false : { opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            SCIENCE
            <br />
            EXHIBITION
          </motion.h1>

          <motion.p
            className={styles.heroSubtitle}
            initial={reduce ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            A Multiverse-themed inter-school science &amp; innovation festival
          </motion.p>

          {/* Key Feature Badges */}
          <motion.div
            className={styles.heroHighlightsRow}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <span className={styles.highlightPill}>👥 Solo or Teams of up to 3 (Class 6–12)</span>
            <span className={`${styles.highlightPill} ${styles.highlightPillHot}`}>⚡ ₹299 / Person Registration Fee</span>
            <span className={styles.highlightPill}>🏆 Cash Prizes &amp; Trophies</span>
            <span className={styles.highlightPill}>🎟️ 100% Free Entry for Visitors</span>
          </motion.div>

          {/* Dual Action CTAs */}
          <motion.div
            className={styles.heroActions}
            initial={reduce ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5 }}
          >
            <Link href={REGISTER_HREF} className={styles.primaryBtn} style={{ marginTop: 0 }}>
              Register Your School Team
            </Link>
            <button
              type="button"
              onClick={() => scrollTo("flagship-details")}
              className={styles.secondaryBtn}
            >
              Explore All Events ↓
            </button>
          </motion.div>
        </motion.div>

        {/* Quick-Jump Floating Nav Bar (Innovision Inspiration) */}
        <motion.div
          className={styles.heroQuickJump}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          <div className={styles.jumpPillContainer}>
            <button
              type="button"
              onClick={() => scrollTo("flagship-details")}
              className={`${styles.jumpPill} ${activeSection === "flagship-details" ? styles.jumpPillActive : ""}`}
            >
              <span className={styles.jumpNum}>01</span>
              <span>Flagship Exhibition</span>
            </button>
            <button
              type="button"
              onClick={() => scrollTo("science-technology")}
              className={`${styles.jumpPill} ${activeSection === "science-technology" ? styles.jumpPillActive : ""}`}
            >
              <span className={styles.jumpNum}>02</span>
              <span>Tech Showcases</span>
            </button>
            <button
              type="button"
              onClick={() => scrollTo("fun-interactive")}
              className={`${styles.jumpPill} ${activeSection === "fun-interactive" ? styles.jumpPillActive : ""}`}
            >
              <span className={styles.jumpNum}>03</span>
              <span>Fun &amp; Interactive</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA (RICH EMBER CARDS)
          ══════════════════════════════════════════════════════ */}
      <main className={styles.main}>

        {/* ─────────────────────────────────────────────────
            SECTION 1: FLAGSHIP SCIENCE EXHIBITION
            ───────────────────────────────────────────────── */}
        <section id="flagship-details" className={styles.scrollAnchor}>
          <div className={styles.sectionHeader}>
            <Reveal>
              <span className={styles.sectionEyebrow}>Flagship Competition</span>
              <p className={styles.sectionTagline}>Innovation · Scientific Rigor · Live Demo</p>
              <h2 className={styles.sectionTitle}>Science &amp; Innovation Exhibition</h2>
              <p className={styles.sectionLead}>
                Open to all school students from Classes 6 through 12. Bring your boldest scientific hypotheses,
                working prototypes, and inventive builds to compete in front of an esteemed judging panel of educators,
                scientists, and technical mentors.
              </p>
            </Reveal>
          </div>

          <Reveal>
            <div className={`${styles.cardBase} ${styles.flagshipCard}`}>
              <CircuitCorner position="topLeft" />
              <CircuitCorner position="bottomRight" />

              {/* Competition AI-Generated Visual Banner */}
              <div className={styles.flagshipHeroMedia}>
                <img
                  src="/events/flagship-hero.webp"
                  alt="AVANTRA 2026 Flagship School Science Exhibition Poster Artwork"
                  className={styles.flagshipHeroImg}
                />
                <div className={styles.flagshipHeroScrim} />
                <div className={styles.flagshipHeroMeta}>
                  <span className={styles.flagshipHeroPill}>
                    <span className={styles.livePulseDot} />
                    Flagship Science Exhibition
                  </span>
                  <span className={styles.flagshipHeroCaption}>
                    Official Competition Arena · Classes 6–12
                  </span>
                </div>
              </div>

              <div className={styles.flagshipHeaderRow}>
                <div>
                  <span className={styles.sectionEyebrow}>Official Competition Format</span>
                  <h3 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl text-[#f4ead9] m-0">
                    Judging &amp; Evaluation Criteria
                  </h3>
                  <p className="text-[#b9ab9a] text-sm mt-1 max-w-[44ch]">
                    Enter solo or as a team of up to 3 students from the same class, presenting an active working model or proof of concept.
                  </p>
                </div>

                <div className={styles.flagshipFeeBadge}>
                  <span className={styles.flagshipFeeAmount}>₹299</span>
                  <span className={styles.flagshipFeeNote}>Per Person</span>
                </div>
              </div>

              {/* 4 Distinct Judging Criteria Cards */}
              <div className={styles.criteriaGrid}>
                {[
                  {
                    num: "01",
                    title: "Innovation & Originality",
                    desc: "Novel concepts, creative problem solving, and inventive applications of scientific principles.",
                  },
                  {
                    num: "02",
                    title: "Scientific Rigor",
                    desc: "Clear grasp of underlying theory, scientific methodology, and accuracy of execution.",
                  },
                  {
                    num: "03",
                    title: "Live Demonstration",
                    desc: "Functionality of the working model, clarity in presentation, and responses to judges' queries.",
                  },
                  {
                    num: "04",
                    title: "Practical Impact",
                    desc: "Real-world relevance, sustainability, and potential positive effect on society and environment.",
                  },
                ].map((crit) => (
                  <div key={crit.num} className={styles.criteriaCard}>
                    <div className={styles.criteriaNum}>Criteria // {crit.num}</div>
                    <div className={styles.criteriaTitle}>{crit.title}</div>
                    <p className={styles.criteriaDesc}>{crit.desc}</p>
                  </div>
                ))}
              </div>

              {/* Themes: the same list students pick from when they register */}
              <div className={styles.themesBlock}>
                <span className={styles.sectionEyebrow}>Pick Your Universe</span>
                <h4 className={styles.prizepoolTitle}>{EXHIBITION_TOPICS.length} Exhibition Themes</h4>
                <p className={styles.prizepoolSub}>Every team builds in one of these themes and chooses it when registering.</p>
                <ul className={styles.themeGrid}>
                  {EXHIBITION_TOPICS.map((topic, i) => (
                    <li key={topic} className={`${styles.criteriaCard} ${styles.themeCard}`}>
                      <div className={styles.criteriaNum}><span className={styles.themeLabel}>Universe // </span>{String(i + 1).padStart(2, "0")}</div>
                      <div className={styles.themeTitle}>{topic}</div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prize Pool & Category Awards Section */}
              <div className={styles.prizepoolContainer}>
                <div className={styles.prizepoolHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>Official Competition Honors</span>
                    <h4 className={styles.prizepoolTitle}>Prize Pool &amp; Category Awards</h4>
                    <p className={styles.prizepoolSub}>
                      Prestigious championship trophies, medals, cash awards, and certificates awarded across two distinct competitive divisions.
                    </p>
                  </div>
                  <div className={styles.prizepoolBadge}>
                    <span>🏆 Cash Prizes &amp; Trophies</span>
                  </div>
                </div>

                <div className={styles.prizepoolGrid}>
                  {/* Junior Category (Classes 6–8) */}
                  <div className={styles.categoryCard}>
                    <div className={styles.categoryHeader}>
                      <div className={styles.categoryIconWrap}>
                        <span>🌱</span>
                      </div>
                      <div>
                        <span className={styles.categoryClassTag}>Classes 6–8</span>
                        <h5 className={styles.categoryTitle}>Junior Category</h5>
                      </div>
                    </div>
                    <ul className={styles.awardsList}>
                      {[
                        { title: "AVANTRA Junior Champion", tag: "Grand Winner", icon: "👑", highlight: true },
                        { title: "Young Innovator", tag: "Award", icon: "💡" },
                        { title: "Science Breakthrough", tag: "Award", icon: "🔬" },
                        { title: "Emerging Inventor", tag: "Award", icon: "⚙️" },
                        { title: "Impact & Sustainability", tag: "Award", icon: "🌍" },
                      ].map((award) => (
                        <li key={award.title} className={`${styles.awardItem} ${award.highlight ? styles.awardItemHighlight : ""}`}>
                          <div className={styles.awardLeft}>
                            <span className={styles.awardIcon}>{award.icon}</span>
                            <span className={styles.awardName}>{award.title}</span>
                          </div>
                          <span className={styles.awardTag}>{award.tag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Senior Category (Classes 9–12) */}
                  <div className={styles.categoryCard}>
                    <div className={styles.categoryHeader}>
                      <div className={styles.categoryIconWrap}>
                        <span>⚡</span>
                      </div>
                      <div>
                        <span className={styles.categoryClassTag}>Classes 9–12</span>
                        <h5 className={styles.categoryTitle}>Senior Category</h5>
                      </div>
                    </div>
                    <ul className={styles.awardsList}>
                      {[
                        { title: "AVANTRA Senior Champion", tag: "Grand Winner", icon: "👑", highlight: true },
                        { title: "Future Innovator", tag: "Award", icon: "🚀" },
                        { title: "Scientific Breakthrough", tag: "Award", icon: "⚛️" },
                        { title: "Next-Gen Inventor", tag: "Award", icon: "🦾" },
                        { title: "Real-World Impact", tag: "Award", icon: "🎯" },
                      ].map((award) => (
                        <li key={award.title} className={`${styles.awardItem} ${award.highlight ? styles.awardItemHighlight : ""}`}>
                          <div className={styles.awardLeft}>
                            <span className={styles.awardIcon}>{award.icon}</span>
                            <span className={styles.awardName}>{award.title}</span>
                          </div>
                          <span className={styles.awardTag}>{award.tag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Optional dormitory stay; price must match siteConfig.fee and private.fee_paise. */}
              <div id="accommodation" className={styles.prizepoolContainer}>
                <div className={styles.prizepoolHeader}>
                  <div>
                    <span className={styles.sectionEyebrow}>Optional · For Exhibition Students</span>
                    <h4 className={styles.prizepoolTitle}>Dormitory Stay &amp; Food</h4>
                    <p className={styles.prizepoolSub}>
                      Coming from far? Stay at the venue for both days of AVANTRA (19–20 December) in a shared dormitory, with meals included.
                    </p>
                  </div>
                  <div className={styles.prizepoolBadge}>
                    <span>🛏️ +₹599 / Student</span>
                  </div>
                </div>
                <ul className={styles.awardsList}>
                  {[
                    { title: "Shared dormitory bed, both days", icon: "🛏️" },
                    { title: "Meals included", icon: "🍽️" },
                    { title: "Choose it in the Stay step when you register", icon: "📝" },
                    { title: "Paid with the fee in one UPI payment: ₹299 + ₹599 = ₹898", icon: "💳" },
                  ].map((item) => (
                    <li key={item.title} className={styles.awardItem}>
                      <div className={styles.awardLeft}>
                        <span className={styles.awardIcon}>{item.icon}</span>
                        <span className={styles.awardName}>{item.title}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.flagshipFooter}>
                <div className={styles.flagshipPerks}>
                  <strong className="text-[#f4ead9]">Team Privileges:</strong> Official stall allocation,
                  exhibition identity cards, certificates of achievement, and eligibility for cash prize pool.
                </div>
                <Link href={REGISTER_HREF} className={styles.primaryBtn} style={{ marginTop: 0 }}>
                  Register School Team (₹299 / Person)
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ─────────────────────────────────────────────────
            SECTION 2: SCIENCE & TECHNOLOGY SHOWCASES
            ───────────────────────────────────────────────── */}
        <section id="science-technology" className={styles.scrollAnchor} aria-labelledby="cat1-heading">
          <div className={styles.sectionHeader}>
            <Reveal>
              <span className={styles.sectionEyebrow}>Category 01</span>
              <p className={styles.sectionTagline}>Live Demonstrations · Innovation · Exploration</p>
              <h2 id="cat1-heading" className={styles.sectionTitle}>Science &amp; Technology Showcases</h2>
              <p className={styles.sectionLead}>
                Discover the fascinating world of modern science and engineering through exciting live demonstrations,
                aerodynamic aerial displays, and hands-on technological showcases.
              </p>
            </Reveal>
          </div>

          <div className={styles.showcaseGrid}>
            {[
              {
                num: "01",
                name: "Drone Events",
                badge: "Live Aerials",
                isLive: true,
                image: "/events/droneracing.jpeg",
                desc: "Experience the power of flying technology! Watch exciting drone flight demonstrations, explore autonomous drone capabilities, and discover how drones are transforming the modern world.",
                tags: ["Autonomous Flight", "Aerial Maneuvers", "FPV Tech"],
                tagHl: "Live Arena",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6" />
                    <circle cx="5" cy="5" r="2" />
                    <circle cx="19" cy="5" r="2" />
                    <circle cx="5" cy="19" r="2" />
                    <circle cx="19" cy="19" r="2" />
                  </svg>
                ),
              },
              {
                num: "02",
                name: "RC Planes",
                badge: "Aeromodelling",
                isLive: true,
                image: "/events/rc plane.jpeg",
                desc: "Witness the excitement of remote-controlled aircraft! Explore miniature aviation, watch RC planes slice through the air, and discover the science behind flight and aerodynamic lift.",
                tags: ["Aviation Science", "Aerodynamics", "Flight Controls"],
                tagHl: "Flight Demo",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                  </svg>
                ),
              },
              {
                num: "03",
                name: "Satellite & Rocket Showcase",
                badge: "Space Tech",
                isLive: false,
                image: "/events/satelite.jpeg",
                desc: "Explore the wonders of space technology! Discover satellite models, rocket propulsion systems, and orbital concepts while learning how scientists explore realms beyond Earth.",
                tags: ["Rocket Propulsion", "Orbital Satellites", "Cosmology"],
                tagHl: "Exploration",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                  </svg>
                ),
              },
              {
                num: "04",
                name: "Robotics Events",
                badge: "Automation",
                isLive: true,
                image: "/events/robotics.jpeg",
                desc: "Step into the world of intelligent machines! Explore robots, autonomous navigation, and innovative mechanical builds through interactive demonstrations and live obstacle activities.",
                tags: ["Intelligent Bots", "Embedded Systems", "Sensors"],
                tagHl: "Interactive",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                ),
              },
              {
                num: "05",
                name: "BMR (Black Mamba Racing)",
                badge: "Go-Kart Racing",
                isLive: true,
                image: "/events/bmr.jpeg",
                desc: "Feel the rush of high-octane track engineering! Witness high-speed go-kart racing demonstrations, precision cornering, aerodynamic chassis design, and live motorsport mechanics in action.",
                tags: ["Go-Kart Racing", "Chassis Engineering", "Track Telemetry"],
                tagHl: "Live Track",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                  </svg>
                ),
              },
            ].map((ev, i) => (
              <Reveal key={ev.num} delay={i * 0.08}>
                <div className={`${styles.cardBase} ${styles.showcaseCard}`}>
                  <CircuitCorner position="topLeft" />

                  {/* Designated image frame ready for user's photos */}
                  <EventImageFrame
                    src={ev.image}
                    alt={ev.name}
                    label={ev.name}
                    categoryBadge={ev.badge}
                    isLive={ev.isLive}
                    icon={ev.icon}
                  />

                  <div className={styles.showcaseCardBody}>
                    <div className={styles.eventCardMeta}>
                      <span>Event // {ev.num}</span>
                      <span>•</span>
                      <span className="text-[#9fd4ff]">{ev.badge}</span>
                    </div>

                    <h3 className={styles.eventCardTitle}>{ev.name}</h3>
                    <p className={styles.eventCardDesc}>{ev.desc}</p>

                    <div className={styles.tagsRow}>
                      {ev.tags.map((t) => (
                        <span key={t} className={styles.tag}>{t}</span>
                      ))}
                      <span className={`${styles.tag} ${styles.tagHot}`}>{ev.tagHl}</span>
                    </div>

                    <Link href={REGISTER_HREF} className={styles.primaryBtn} style={{ marginTop: "auto" }}>
                      Register for Fest
                    </Link>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            SECTION 3: FUN & INTERACTIVE EVENTS
            ───────────────────────────────────────────────── */}
        <section id="fun-interactive" className={styles.scrollAnchor} aria-labelledby="cat2-heading">
          <div className={styles.sectionHeader}>
            <Reveal>
              <span className={styles.sectionEyebrow}>Category 02</span>
              <p className={styles.sectionTagline}>Puzzles · Mystery · Logic · Dimensions</p>
              <h2 id="cat2-heading" className={styles.sectionTitle}>Fun &amp; Interactive Events</h2>
              <p className={styles.sectionLead}>
                Challenge your intellect, test your deductive reasoning, and solve dimensional mysteries!
                Designed to make scientific inquiry exciting through puzzles, physical cards, and digital reveals.
              </p>
            </Reveal>
          </div>

          {/* 100% Free Entry Callout Banner */}
          <Reveal>
            <div className={styles.freeBanner}>
              <div className={styles.freeBannerText}>
                <span className="text-2xl">⭐</span>
                <span>All interactive activities are 100% FREE to participate in!</span>
              </div>
              <span className={styles.freeBannerBadge}>Zero Fees · Open to All Students &amp; Visitors</span>
            </div>
          </Reveal>

          <div className={styles.interactiveStack}>
            {/* ACTIVITY 01: MULTIVERSE CONTAINMENT PROTOCOL */}
            {SHOW_UNFINISHED_FUN && <Reveal>
              <div className={`${styles.cardBase} ${styles.interactiveCard}`}>
                <CircuitCorner position="topLeft" />
                <CircuitCorner position="bottomRight" />

                <EventImageFrame
                  src="/events/mcp.jpeg"
                  alt="Multiverse Containment Protocol"
                  label="Multiverse Containment Protocol Sector"
                  categoryBadge="Mission Dossier"
                  icon={(
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  )}
                />

                <div className={styles.eventCardMeta}>
                  <span>Activity // 01</span>
                  <span>•</span>
                  <span className="text-[#9fd4ff]">5-Level Protocol</span>
                </div>

                <h3 className={styles.eventCardTitle}>Multiverse Containment Protocol</h3>
                <p className={styles.eventCardDesc}>
                  Step into an alternate dimension of mystery and logic! This is a five-level progressive puzzle-solving
                  adventure blending physical puzzle sheets with real-time digital verification technology.
                </p>

                {/* 5-Level Holographic Progress Tracker */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> The Five Containment Sectors
                  </h4>
                  <div className={styles.levelTimeline}>
                    {[
                      { num: "01", name: "The Awakening" },
                      { num: "02", name: "The Convergence" },
                      { num: "03", name: "The Fracture" },
                      { num: "04", name: "The Collapse" },
                      { num: "05", name: "The Ascension" },
                    ].map((lvl) => (
                      <div key={lvl.num} className={styles.levelNode}>
                        <span className={styles.levelNodeNum}>Level {lvl.num}</span>
                        <span className={styles.levelNodeName}>{lvl.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* How to Play */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> Mission Protocol / How to Play
                  </h4>
                  <ol className={styles.stepsList}>
                    {[
                      ["Start the Challenge:", "Collect your physical puzzle dossier for Level 01 – The Awakening."],
                      ["Crack the Code:", "Use your observation and analytical deduction to solve the encrypted riddle."],
                      ["Submit Digitally:", "Scan the QR code on your dossier to verify your answer instantly."],
                      ["Level Up:", "Upon correct validation, unlock the physical dossier for the subsequent level."],
                      ["Complete the Mission:", "Finish all five sectors to unlock an exclusive digital completion certificate."],
                    ].map(([bold, text], i) => (
                      <li key={i} className={styles.stepItem}>
                        <span className={styles.stepNum}>{i + 1}</span>
                        <div className={styles.stepContent}>
                          <strong>{bold}</strong> {text}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Rules */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> Rules &amp; Regulations
                  </h4>
                  <ul className={styles.rulesList}>
                    {[
                      ["Free Entry:", "Zero registration fee required; open to everyone."],
                      ["Sequential Order:", "Levels must be solved in strict numerical order."],
                      ["Digital Verification:", "Answers must be verified through the designated QR link."],
                      ["Fair Play:", "Rely on your own intellect and observational wit."],
                    ].map(([bold, text], i) => (
                      <li key={i} className={styles.ruleItem}>
                        <span className={styles.ruleBullet}>•</span>
                        <span><strong>{bold}</strong> {text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href={REGISTER_HREF} className={styles.primaryBtn}>
                  Join the Mission (Free)
                </Link>
              </div>
            </Reveal>}

            {/* ACTIVITY 02: PARADOX WALL */}
            <Reveal>
              <div className={`${styles.cardBase} ${styles.interactiveCard}`}>
                <CircuitCorner position="topLeft" />
                <CircuitCorner position="bottomRight" />

                <EventImageFrame
                  src="/events/wall.jpeg"
                  alt="Paradox Wall"
                  label="Paradox Wall Sector"
                  categoryBadge="Puzzle Wall"
                  icon={(
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  )}
                />

                <div className={styles.eventCardMeta}>
                  <span>Activity // 02</span>
                  <span>•</span>
                  <span className="text-[#9fd4ff]">500 Brain Teasers</span>
                </div>

                <h3 className={styles.eventCardTitle}>Paradox Wall</h3>
                <p className="font-[family-name:var(--font-display)] text-[#9fd4ff] text-base mb-2">
                  Solve the puzzle. Collect hidden letters. Spell your own name!
                </p>
                <p className={styles.eventCardDesc}>
                  The Paradox Wall features 500 unique brain teasers across 5 difficulty levels. Your objective is
                  to pick cards, crack the puzzles, gather the secret letters concealed on the reverse, and assemble
                  the complete spelling of your name!
                </p>

                {/* How to Play */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> How to Play
                  </h4>
                  <ol className={styles.stepsList}>
                    {[
                      ["Pick a Card:", "Select any intriguing puzzle card from the physical Paradox Wall."],
                      ["Solve & Scan:", "Solve the brain teaser and scan its unique QR code to check correctness."],
                      ["Collect Your Letter:", "When verified, collect the secret letter stamped on the back."],
                      ["Spell Your Name:", "Continue solving until you gather all letters required to spell your name."],
                      ["Victory Celebration:", "Arrange your letters, take a victory snapshot, and share your achievement story!"],
                    ].map(([bold, text], i) => (
                      <li key={i} className={styles.stepItem}>
                        <span className={styles.stepNum}>{i + 1}</span>
                        <div className={styles.stepContent}>
                          <strong>{bold}</strong> {text}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Rules */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> Rules &amp; Regulations
                  </h4>
                  <ul className={styles.rulesList}>
                    {[
                      ["Free Entry:", "100% free for all students, parents, and visitors."],
                      ["Card Care:", "Handle cards carefully and keep the wall neat for other challengers."],
                      ["Choose Your Level:", "Select puzzles from Easy, Medium, Hard, Expert, or Paradox tiers."],
                      ["Collaboration Allowed:", "Take advice from friends and mentors to crack tough teasers."],
                    ].map(([bold, text], i) => (
                      <li key={i} className={styles.ruleItem}>
                        <span className={styles.ruleBullet}>•</span>
                        <span><strong>{bold}</strong> {text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href={REGISTER_HREF} className={styles.primaryBtn}>
                  Play Paradox Wall (Free)
                </Link>
              </div>
            </Reveal>

            {/* ACTIVITY 03: CHRONO-QUEST */}
            {SHOW_UNFINISHED_FUN && <Reveal>
              <div className={`${styles.cardBase} ${styles.interactiveCard}`}>
                <CircuitCorner position="topLeft" />
                <CircuitCorner position="bottomRight" />

                <EventImageFrame
                  src="/events/chronoquest.jpeg"
                  alt="Chrono-Quest"
                  label="Chrono-Quest Mystery Sector"
                  categoryBadge="Dimensional Quest"
                  icon={(
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )}
                />

                <div className={styles.eventCardMeta}>
                  <span>Activity // 03</span>
                  <span>•</span>
                  <span className="text-[#9fd4ff]">5 Mystery Domains</span>
                </div>

                <h3 className={styles.eventCardTitle}>Chrono-Quest</h3>
                <p className="font-[family-name:var(--font-display)] text-[#9fd4ff] text-base mb-2">
                  Enter the Multiverse. Crack the Mystery. Unlock the Unknown.
                </p>
                <p className={styles.eventCardDesc}>
                  Chrono-Quest is a dimensional expedition through physical mystery letterboxes containing case-based
                  scientific challenges. Traverse five thrilling scientific domains and prove your versatility!
                </p>

                {/* 5 Domains */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> The Five Knowledge Domains
                  </h4>
                  <div className={styles.domainPillsGrid}>
                    {["🔭 Astronomy & Cosmos", "🤖 Drones & Robotics", "💼 Innovation & Enterprise", "🔬 Pure Science", "💻 Computing & Cyber"].map((d) => (
                      <span key={d} className={styles.domainChip}>{d}</span>
                    ))}
                  </div>
                </div>

                {/* How to Play */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> How to Play
                  </h4>
                  <ol className={styles.stepsList}>
                    {[
                      ["Find a Letterbox:", "Locate the Chrono-Quest array containing 10–12 physical mystery boxes."],
                      ["Pick a Domain:", "Select a challenge dossier from any of the five active domains."],
                      ["Solve the Case:", "Read the scenario-based dilemma and formulate the scientific answer."],
                      ["Complete the 5 Domains:", "Solve exactly one challenge from each of the five distinct domains."],
                      ["Unlock Digital Story:", "Submit all five solutions to unlock your customized digital Multiverse story!"],
                    ].map(([bold, text], i) => (
                      <li key={i} className={styles.stepItem}>
                        <span className={styles.stepNum}>{i + 1}</span>
                        <div className={styles.stepContent}>
                          <strong>{bold}</strong> {text}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Rules */}
                <div className={styles.detailBox}>
                  <h4 className={styles.detailHeader}>
                    <span>✦</span> Rules &amp; Regulations
                  </h4>
                  <ul className={styles.rulesList}>
                    {[
                      ["Free Entry:", "Completely free of charge."],
                      ["The 5-Domain Mandate:", "Exactly one challenge must be completed from each domain."],
                      ["Preserve the Clues:", "Return each dossier to its respective letterbox after solving."],
                      ["Brainstorming Encouraged:", "Discussing cases with peers, teachers, and parents is welcomed."],
                    ].map(([bold, text], i) => (
                      <li key={i} className={styles.ruleItem}>
                        <span className={styles.ruleBullet}>•</span>
                        <span><strong>{bold}</strong> {text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href={REGISTER_HREF} className={styles.primaryBtn}>
                  Embark on Chrono-Quest (Free)
                </Link>
              </div>
            </Reveal>}

            {!SHOW_UNFINISHED_FUN && (
              <Reveal>
                <div className={`${styles.cardBase} ${styles.interactiveCard}`}>
                  <CircuitCorner position="topLeft" />
                  <CircuitCorner position="bottomRight" />
                  <div className={styles.eventCardMeta}>
                    <span className="text-[#9fd4ff]">Coming Soon</span>
                  </div>
                  <h3 className={styles.eventCardTitle}>More Activities Loading…</h3>
                  <p className={styles.eventCardDesc}>
                    New puzzles and mystery quests are being prepared. Check back soon for the full line-up.
                  </p>
                </div>
              </Reveal>
            )}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────
            FESTIVAL MOTTO / BOTTOM CALL TO ACTION
            ───────────────────────────────────────────────── */}
        <Reveal>
          <div className={styles.bottomBanner}>
            <CircuitCorner position="topLeft" />
            <CircuitCorner position="bottomRight" />

            <h2 className={styles.bottomBannerTitle}>AVANTRA 2026</h2>
            <p className={styles.bottomBannerSub}>Where Curiosity Meets Innovation!</p>
            <p className={styles.bottomBannerMotto}>Explore. Experiment. Experience.</p>

            <div className={styles.bottomBannerBtns}>
              <Link href={REGISTER_HREF} className={styles.primaryBtn} style={{ marginTop: 0 }}>
                Register School Team Now
              </Link>
              <Link href="/about#venue" className={styles.secondaryBtn}>
                View Venue &amp; Dates
              </Link>
            </div>
          </div>
        </Reveal>
      </main>
    </div>
  );
}
