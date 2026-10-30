"use client";

// Every event, open to anyone. Each card opens a details popup with a Register button; the exhibition then
// asks for a theme and sends the student on to pay the ₹299 fee. Teams are formed on /dashboard/teams once
// the fee is paid, so cards here only say how big a team must be.
// /dashboard/events?event=SLUG&step=theme opens a popup straight away (the dashboard's Register button).
import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EXHIBITION_TOPICS } from "@avantra/shared";
import { api, ApiError, apiReady, getMe, type Me } from "@/lib/api";
import { FormError, OpensSoon, styles as account } from "@/components/account/Account";
import styles from "./events.module.css";
import steps from "../../staff/tools.module.css";

type Category = "EXHIBITION" | "TECHNOLOGY" | "EXPERIENCE" | "WORKSHOP";
type Event = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: Category;
  registrationOpen: boolean;
  teamMin: number;
  teamMax: number;
  spotsLeft: number | null;
  judgingCriteria?: string[]; // only sent for the exhibition until event day
};
type Reg = { id: string; eventId: string; topic: string | null; teamMember: { isLeader: boolean; team: { topic: string | null } } | null };
type Step = "details" | "theme";

const CATEGORY_NAME: Record<Category, string> = {
  EXHIBITION: "Science Exhibition",
  TECHNOLOGY: "Technology",
  EXPERIENCE: "Experience",
  WORKSHOP: "Workshop",
};
const EXHIBITION_ABOUT =
  "Build a project in a team of 3 on one theme and present it to the judges. Classes 6–8 compete as Juniors, classes 9–12 as Seniors.";

// Exhibition category by class; register_event refuses classes below 6 too.
const level = (grade: number) => (grade >= 9 ? "Senior (classes 9–12)" : grade >= 6 ? "Junior (classes 6–8)" : null);

function teamSize(e: Event) {
  if (e.teamMax === 1) return "Solo";
  return e.teamMin === e.teamMax ? `Teams of ${e.teamMax}` : `Teams of ${e.teamMin}–${e.teamMax}`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [feePaid, setFeePaid] = useState(false);
  const [grade, setGrade] = useState(0);
  const [failed, setFailed] = useState("");
  const [open, setOpen] = useState<{ slug: string; step: Step } | null>(null);

  const load = useCallback(async () => {
    const [ev, m] = await Promise.all([api<Event[]>("/events"), getMe()]);
    if (m?.role === "STUDENT" && m.profileComplete) {
      const [p, r] = await Promise.all([api<{ student: { feePaidAt: string | null; grade: number } | null }>("/profile"), api<Reg[]>("/registrations/mine")]);
      setFeePaid(!!p.student?.feePaidAt);
      setGrade(p.student?.grade ?? 0);
      setRegs(r);
    }
    setMe(m);
    setEvents(ev.filter((e) => e.category === "EXHIBITION")); // the rest are revealed later
  }, []);

  useEffect(() => {
    if (!apiReady) return;
    load().catch((e: ApiError) => setFailed(e.message));
    const q = new URLSearchParams(window.location.search);
    const slug = q.get("event");
    if (slug) setOpen({ slug, step: q.get("step") === "theme" ? "theme" : "details" });
  }, [load]);

  // The popup lives in the URL so a reload, or the pay page's Back link, lands on the same step.
  const show = (next: { slug: string; step: Step } | null) => {
    setOpen(next);
    window.history.replaceState(null, "", next ? `/dashboard/events?event=${next.slug}${next.step === "theme" ? "&step=theme" : ""}` : "/dashboard/events");
  };

  const student = me?.role === "STUDENT" && me.profileComplete ? me : null;
  const current = open && events?.find((e) => e.slug === open.slug);

  return (
    <div className={account.registrationPage}>
      <div className={account.starfieldLayer} aria-hidden="true" />
      <main className={account.wrapper}>
        <div className={styles.page}>
          <h1 className={account.heading}>Events</h1>
          <p className={styles.lead}>Entry to the fest and its events is free. Only the Science Exhibition has a ₹299 fee, paid once.</p>
          {!apiReady ? (
            <OpensSoon what="Event registration" />
          ) : failed ? (
            <FormError message={failed} />
          ) : !events ? (
            <p className={account.subtext} role="status">Loading…</p>
          ) : (
            <>
              {!student && (
                <p className={styles.fee}>
                  {!me ? (
                    <span>
                      <Link href="/login" className={account.link}>Log in</Link> or{" "}
                      <Link href="/registration" className={account.link}>sign up</Link> to register for events.
                    </span>
                  ) : me.role === "STUDENT" ? (
                    <span>
                      <Link href="/profile" className={account.link}>Finish your profile</Link> to register for events.
                    </span>
                  ) : (
                    <span>Students register for events from their own account.</span>
                  )}
                </p>
              )}
              <ul className={styles.grid}>
                {events.map((e) => {
                  const reg = regs.find((r) => r.eventId === e.id);
                  const exhibition = e.category === "EXHIBITION";
                  return (
                    <li key={e.id}>
                      <button type="button" className={styles.tile} data-registered={!!reg || undefined} onClick={() => show({ slug: e.slug, step: "details" })}>
                        <span className={styles.kicker}>{CATEGORY_NAME[e.category]}</span>
                        <span className={styles.tileName}>{e.name}</span>
                        <span className={styles.teaser}>{exhibition ? EXHIBITION_ABOUT : e.description}</span>
                        <span className={styles.pills}>
                          <span className={styles.pill}>{teamSize(e)}</span>
                          <span className={styles.pill}>{exhibition ? "₹299" : "Free"}</span>
                          {reg ? (
                            <span className={styles.pill} data-on>
                              {exhibition && !feePaid ? "Registered · pay to finish" : "Registered ✓"}
                            </span>
                          ) : (
                            !e.registrationOpen && <span className={styles.pill}>Registration closed</span>
                          )}
                        </span>
                        <span className={styles.more}>View details →</span>
                      </button>
                    </li>
                  );
                })}
                <li className={styles.soon}>
                  <span className={styles.kicker}>Coming soon</span>
                  <span className={styles.tileName}>More events</span>
                  <span className={styles.teaser}>Technology events, experiences and workshops will be revealed soon.</span>
                </li>
              </ul>
            </>
          )}
        </div>
      </main>
      {current && (
        <EventDialog
          event={current}
          step={open!.step}
          setStep={(step) => show({ slug: current.slug, step })}
          onClose={() => show(null)}
          reg={regs.find((r) => r.eventId === current.id)}
          me={me}
          student={!!student}
          feePaid={feePaid}
          grade={grade}
          onChange={load}
        />
      )}
    </div>
  );
}

function EventDialog({
  event: e,
  step,
  setStep,
  onClose,
  reg,
  me,
  student,
  feePaid,
  grade,
  onChange,
}: {
  event: Event;
  step: Step;
  setStep: (s: Step) => void;
  onClose: () => void;
  reg?: Reg;
  me: Me | null;
  student: boolean;
  feePaid: boolean;
  grade: number;
  onChange: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Every action: call the API, then reload the page's data so the cards stay in step.
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onChange();
      return true;
    } catch (err) {
      setError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const exhibition = e.category === "EXHIBITION";
  const team = reg?.teamMember?.team;
  const open = e.registrationOpen && e.spotsLeft !== 0;
  const onTheme = exhibition && student && !reg && !!level(grade) && open && step === "theme";
  const withdraw = (thenTheme: boolean) => {
    if (confirm(thenTheme ? "Change your theme? This withdraws your entry so you can pick again." : `Withdraw from ${e.name}?`))
      run(() => api(`/registrations/${reg!.id}`, undefined, "DELETE")).then((ok) => ok && thenTheme && setStep("theme"));
  };
  const linkBtn = { textAlign: "center", textDecoration: "none", display: "block", marginTop: 0 } as const;

  let footer: React.ReactNode;
  if (!student)
    footer = me ? (
      <p className={styles.note}>
        {me.role === "STUDENT" ? (
          <>
            <Link href="/profile" className={account.link}>Finish your profile</Link> to register.
          </>
        ) : (
          "Students register from their own account."
        )}
      </p>
    ) : (
      <Link href={`/login?next=${encodeURIComponent(`/dashboard/events?event=${e.slug}`)}`} className={account.submitBtn} style={linkBtn}>
        Log in to register
      </Link>
    );
  else if (reg)
    footer = (
      <>
        <p className={styles.done}>
          Registered ✓{exhibition && ` · ${reg.topic ?? team?.topic ?? "no theme"}`}
          {exhibition && feePaid && " · Fee paid"}
        </p>
        {exhibition && !feePaid ? (
          <Link href="/dashboard/pay" className={account.submitBtn} style={linkBtn}>
            Pay ₹299 to finish
          </Link>
        ) : (
          e.teamMax > 1 && (
            <Link href="/dashboard/teams" className={account.submitBtn} style={linkBtn}>
              Form or join your team
            </Link>
          )
        )}
        {!team && (
          <button type="button" className={`${account.link} ${styles.quiet}`} onClick={() => withdraw(exhibition)} disabled={busy}>
            {exhibition ? "Change theme" : "Withdraw"}
          </button>
        )}
      </>
    );
  else if (!open) footer = <p className={styles.note}>Registration is closed.</p>;
  else if (exhibition && !level(grade)) footer = <p className={styles.note}>The Science Exhibition is for classes 6 to 12.</p>;
  else if (onTheme)
    footer = (
      <div className={styles.footRow}>
        <button type="button" className={`${account.link} ${styles.quiet}`} onClick={() => setStep("details")}>
          ← Back
        </button>
        <button type="submit" form={`${e.slug}-theme`} className={account.submitBtn} disabled={busy} style={{ marginTop: 0 }}>
          {busy ? "Registering…" : "Register & pay ₹299"}
        </button>
      </div>
    );
  else
    footer = (
      <button
        type="button"
        className={account.submitBtn}
        style={{ marginTop: 0 }}
        disabled={busy}
        onClick={() => (exhibition ? setStep("theme") : run(() => api("/registrations", { eventId: e.id })))}
      >
        {busy ? "Registering…" : "Register"}
      </button>
    );

  return (
    // A click on the backdrop lands on the <dialog> itself (the inner box covers the rest), so it closes.
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby={`${e.slug}-title`} onClick={(ev) => ev.target === ref.current && ref.current.close()}>
      <div className={styles.dialogInner}>
        <header className={styles.dialogHead}>
          <div>
            <span className={styles.kicker}>{CATEGORY_NAME[e.category]}</span>
            <h2 id={`${e.slug}-title`} className={styles.dialogTitle}>
              {e.name}
            </h2>
          </div>
          <button type="button" className={styles.close} onClick={() => ref.current?.close()} aria-label="Close">
            ×
          </button>
        </header>

        {exhibition && student && (
          <ol className={`${steps.steps} ${styles.steps}`} aria-label="Registration steps">
            {["Details", "Theme", "Pay"].map((label, i) => (
              <li
                key={label}
                aria-current={i === (onTheme ? 1 : reg && !feePaid ? 2 : reg ? -1 : 0) ? "step" : undefined}
                data-done={(i === 0 && (onTheme || !!reg)) || (i === 1 && !!reg) || (i === 2 && feePaid) || undefined}
              >
                {label}
              </li>
            ))}
          </ol>
        )}

        <div className={styles.dialogBody}>
          {onTheme ? (
            <form
              id={`${e.slug}-theme`}
              noValidate
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!topic) return setError("Pick a theme.");
                run(() => api("/registrations", { eventId: e.id, topic })).then((ok) => ok && router.push("/dashboard/pay"));
              }}
            >
              <p className={styles.note} style={{ marginTop: 0 }}>
                You compete as a <strong>{level(grade)}</strong>, from your class. Your team builds its project on this theme.
              </p>
              <fieldset className={account.fieldset}>
                <legend className={account.fieldsetLegend}>Pick your theme</legend>
                <div className={styles.themes}>
                  {EXHIBITION_TOPICS.map((t) => (
                    <label key={t} className={account.chipWrapper}>
                      <input
                        type="radio"
                        name={`${e.slug}-topic`}
                        value={t}
                        checked={topic === t}
                        onChange={() => {
                          setTopic(t);
                          setError("");
                        }}
                        className={account.radioInput}
                      />
                      <span className={`${account.chipLabel} ${styles.themeChip}`}>{t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </form>
          ) : (
            <>
              <p className={styles.about}>{exhibition ? EXHIBITION_ABOUT : e.description}</p>
              <dl className={styles.facts}>
                <div>
                  <dt>Team</dt>
                  <dd>{teamSize(e)}</dd>
                </div>
                <div>
                  <dt>Fee</dt>
                  <dd>{exhibition ? "₹299 per student" : "Free"}</dd>
                </div>
                {exhibition && (
                  <div>
                    <dt>Who</dt>
                    <dd>{level(grade) ?? "Classes 6–12"}</dd>
                  </div>
                )}
                {e.spotsLeft !== null && (
                  <div>
                    <dt>Spots left</dt>
                    <dd>{e.spotsLeft}</dd>
                  </div>
                )}
              </dl>
              {exhibition && (
                <>
                  <h3 className={styles.sub}>Themes</h3>
                  <ul className={styles.pills}>
                    {EXHIBITION_TOPICS.map((t) => (
                      <li key={t} className={styles.pill}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!!e.judgingCriteria?.length && (
                <>
                  <h3 className={styles.sub}>Judged on</h3>
                  <ul className={styles.criteria}>
                    {e.judgingCriteria.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        <footer className={styles.dialogFoot}>
          <FormError message={error} />
          {footer}
        </footer>
      </div>
    </dialog>
  );
}
