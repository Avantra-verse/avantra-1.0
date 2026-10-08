"use client";

// AVANTRA home: Meena's multiverse page (was public/multiverse/index.html), same markup, styles and motion.
import { useLayoutEffect } from "react";
import Link from "next/link";
import { startScene } from "./scene";
import "./multiverse.css";

const LOGO = "/multiverse/avantra-logo-transparent.png";

export default function Multiverse() {
  // Layout effect: its cleanup runs before React removes the DOM, so no frame ever draws into a removed page.
  useLayoutEffect(() => {
    // The site's smooth scrolling fights the scroll-driven scenes.
    const html = document.documentElement;
    const before = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    const stop = startScene();
    return () => {
      stop();
      html.style.scrollBehavior = before;
    };
  }, []);

  return (
    <div className="mv">
      <div className="grain" aria-hidden="true" />
      <div className="sbar" id="sbar" aria-hidden="true" />
      <div className="lens" id="lens" aria-hidden="true" />

      <div className="pre" id="pre" role="status" aria-live="polite">
        <div className="plogo">
          <img src={LOGO} alt="" />
          <img src={LOGO} alt="" id="plogo" />
        </div>
        <p>
          Crossing over <b id="pn">0</b>%
        </p>
      </div>

      <header className="top">
        <a className="logo" href="#hero" data-hover aria-label="AVANTRA home">
          <img src={LOGO} alt="AVANTRA" />
        </a>
        <span className="when">December 2026, dates soon</span>
        <nav aria-label="Main">
          <Link href="/about" data-hover>About</Link>
          <Link href="/venue" data-hover>Venue</Link>
          <Link href="/sponsors" data-hover>Sponsors</Link>
          <Link href="/contact" data-hover>Contact</Link>
          <Link className="keep" href="/login" data-hover>Log in</Link>
          <Link className="keep" href="/registration" data-hover>Registration</Link>
        </nav>
      </header>

      <div>
        <section className="rig" id="hero" aria-label="AVANTRA 2026">
          <div className="stick">
            <div className="hwrap" id="hwrap">
              <canvas id="hfg" role="img" aria-label="A slow journey from a glowing planet horizon through nebulae and golden stardust, ending in swirling trails of light" />
            </div>
            <div className="tint" aria-hidden="true" />
            <canvas className="warp" id="warp" aria-hidden="true" />
            <div className="vig" aria-hidden="true" />
            <div className="scrimB" aria-hidden="true" />
            <div className="scrimL" id="scrimL" aria-hidden="true" />

            <div className="hl" id="hl">
              <img id="hlimg" src={LOGO} alt="AVANTRA" />
              <p className="htag" id="htag">A Multiverse-themed inter-school science &amp; innovation festival</p>
            </div>
            <p className="cue" id="cue">Scroll to cross over</p>

            <div className="beats">
              <p className="beat l" id="b1">Every project you didn&apos;t build is a universe somewhere.</p>
              <p className="beat r" id="b2">This weekend, a few of them cross over.</p>
              <p className="beat c" id="b3" aria-hidden="true">Cross over</p>
            </div>

            <div className="final" id="final">
              <img src={LOGO} alt="AVANTRA" id="flogo" />
              <p>A Multiverse-themed inter-school science and innovation festival</p>
              <div className="row">
                <Link className="btn solid" href="/about" data-hover>About AVANTRA</Link>
                <Link className="btn" href="/contact" data-hover>Get in touch</Link>
              </div>
            </div>
          </div>
        </section>

        <div className="marq" aria-hidden="true">
          <div>
            <span>Bring a project</span>
            <span>Cross over</span>
            <span>Build something</span>
            <span>Meet other schools</span>
            <span>Bring a project</span>
            <span>Cross over</span>
            <span>Build something</span>
            <span>Meet other schools</span>
          </div>
        </div>

        <section className="rig" id="say" aria-label="About the festival">
          <div className="stick">
            <p className="say" id="sayp">
              AVANTRA 2026 is a two-day festival where school students bring their own science and technology projects, show what they have built, and take on hands-on challenges with students from other schools.
            </p>
          </div>
        </section>

        <section className="rig" id="cube" aria-label="Many universes, one festival">
          <div className="stick">
            <div className="cubewrap" id="cubewrap" role="img" aria-label="A cube whose faces each show a different nebula, floating in a galaxy" />
            <div className="cubecap" id="cubecap">
              <h2>Each school brings a different universe.</h2>
              <p>Its own question, its own build. For two days they share one floor.</p>
            </div>
          </div>
        </section>

        <section className="rig" id="realms" aria-label="What you can do at AVANTRA">
          <div className="stick">
            <h2 className="rhead">
              Step <em>through</em>
            </h2>
            <div className="track" id="track">
              <article className="realm" style={{ "--c": "#9fd4ff" } as React.CSSProperties}>
                <img className="art" src="/multiverse/planet-neon-triangle.jpg" alt="A marbled blue and violet planet cut by a glowing triangle" />
                <div className="rtxt">
                  <h3>The Showcase</h3>
                  <p>Bring your own science or technology project and show what you built.</p>
                </div>
              </article>
              <article className="realm" style={{ "--c": "#ff5560" } as React.CSSProperties}>
                <canvas className="art" id="rcity" aria-hidden="true" />
                <div className="rtxt">
                  <h3>The Challenge Floor</h3>
                  <p>Hands-on challenges, taken on with students from other schools.</p>
                </div>
              </article>
              <article className="realm" style={{ "--c": "#f4ead9" } as React.CSSProperties}>
                <div className="art orb" aria-hidden="true">
                  <i />
                  <i />
                </div>
                <div className="rtxt">
                  <h3>The Exchange</h3>
                  <p>Trade questions and ideas with teams you would never meet at home.</p>
                </div>
              </article>
              <article className="realm sealed" style={{ "--c": "#9fd4ff" } as React.CSSProperties}>
                <img className="art" src="/multiverse/nebula-cube.jpg" alt="" />
                <svg className="lock" viewBox="0 0 64 64" fill="none" stroke="#9fd4ff" strokeWidth="3" aria-hidden="true">
                  <rect x="14" y="28" width="36" height="26" rx="5" />
                  <path d="M22 28v-7a10 10 0 0 1 20 0v7" />
                  <circle cx="32" cy="41" r="3" fill="#9fd4ff" />
                </svg>
                <div className="rtxt">
                  <h3>Sealed</h3>
                  <p>The full line-up opens when it is announced.</p>
                </div>
              </article>
              <div className="rend" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="rig" id="city" aria-label="Bring a project">
          <div className="stick">
            <div className="cwrap">
              <canvas id="cfg" role="img" aria-label="Asteroids drifting through a pink and violet nebula full of stars" />
            </div>
            <div className="vig" aria-hidden="true" />
            <div className="scrimL" style={{ opacity: 1 }} aria-hidden="true" />
            <div className="scrimB" aria-hidden="true" />
            <div className="citycopy">
              <h2>
                <span className="ln">
                  <span id="c1">Bring a</span>
                </span>
                <span className="ln b">
                  <span id="c2">project.</span>
                </span>
              </h2>
              <p className="fadeup" id="c3">Registration opens with the line-up. Questions before then? Write to the team.</p>
              <div className="fadeup" id="c4">
                <Link className="btn solid" href="/contact" data-hover>Get in touch</Link>
              </div>
            </div>
          </div>
        </section>

        <section id="info" aria-label="Key details">
          <dl className="facts">
            <div className="fact" style={{ "--c": "#ff5560" } as React.CSSProperties}>
              <dt>When</dt>
              <dd>December 2026, dates soon</dd>
            </div>
            <div className="fact" style={{ "--c": "#9fd4ff" } as React.CSSProperties}>
              <dt>Where</dt>
              <dd>SSRVM IEMS, the host school</dd>
            </div>
            <div className="fact" style={{ "--c": "#f4ead9" } as React.CSSProperties}>
              <dt>How long</dt>
              <dd>2 days</dd>
            </div>
          </dl>
          <p className="partner">
            <b>ARITHI INNOVATION &amp; TECHNOLOGIES PRIVATE LIMITED</b> is the event partner, running the festival, its events and registration.
          </p>
        </section>
      </div>

      <footer className="fin" id="fin">
        <div className="fgrid">
          <div>
            <h2>Pick a universe. Bring a project.</h2>
            <div className="row">
              <Link className="btn solid" href="/venue" data-hover>Venue and prizes</Link>
              <Link className="btn" href="/contact" data-hover>Get in touch</Link>
            </div>
          </div>
          <img className="flog" id="flog" src={LOGO} alt="AVANTRA" />
        </div>
        <div className="foot">
          <nav aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/venue">Venue</Link>
            <Link href="/sponsors">Sponsors</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/login">Log in</Link>
            <Link href="/registration">Registration</Link>
          </nav>
          <span>AVANTRA 2026 · Hosted by SSRVM IEMS · Event partner ARITHI</span>
        </div>
      </footer>
    </div>
  );
}
