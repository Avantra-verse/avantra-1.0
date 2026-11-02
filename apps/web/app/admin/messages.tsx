"use client";

// Messages tab: what visitors sent through the contact form. Any admin can sort them into a category and mark them
// resolved. Replies go from the admin's own mail app (Reply opens a mailto), so nothing here sends email.
import React, { useState } from "react";
import { api } from "@/lib/api";
import { FormError, SelectField } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import x from "./people.module.css";
import m from "./messages.module.css";
import { Avatar, joined, when } from "./people";
import { useAction, useLoad } from "./ui";

type Message = {
  id: number;
  name: string;
  email: string;
  school: string | null;
  message: string;
  category: Category | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
};

// Same list as the check in supabase/migrations/*_contact_inbox.sql.
const CATEGORIES = { REGISTRATION: "Registration", PAYMENT: "Payment", EVENTS: "Events", SPONSORSHIP: "Sponsorship", OTHER: "Other" } as const;
type Category = keyof typeof CATEGORIES;

const SHOW: Record<string, [string, (x: Message) => boolean]> = {
  open: ["Open", (x) => !x.resolvedAt],
  resolved: ["Resolved", (x) => !!x.resolvedAt],
  all: ["All", () => true],
};

export function Messages() {
  const list = useLoad<Message[]>("/admin/messages");
  const act = useAction();
  const [show, setShow] = useState("open");
  const [category, setCategory] = useState("");

  const all = list.data ?? [];
  // "none" = not sorted yet. Chip counts follow the category filter, so they match what a tap shows.
  const inCategory = all.filter((x) => !category || (category === "none" ? !x.category : x.category === category));
  const rows = inCategory.filter(SHOW[show][1]);

  const save = (msg: Message, change: { category?: Category | null; resolved?: boolean }) =>
    act
      .run(() =>
        api(`/admin/messages/${msg.id}`, { category: "category" in change ? change.category : msg.category, resolved: change.resolved ?? !!msg.resolvedAt }, "PATCH"),
      )
      .then(list.reload);

  return (
    <section className={t.panel} aria-labelledby="messages">
      <div className={t.panelHead}>
        <h2 id="messages">From the contact form</h2>
        <button type="button" className={t.ghost} onClick={list.reload}>Refresh</button>
      </div>
      <div className={x.filters}>
        <SelectField name="messageCategory" label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          <option value="none">Not sorted yet</option>
          {Object.entries(CATEGORIES).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </SelectField>
      </div>
      <div className={x.chips} role="group" aria-label="Show">
        {Object.entries(SHOW).map(([k, [label, test]]) => (
          <button key={k} type="button" className={x.chip} aria-pressed={show === k} onClick={() => setShow(k)}>
            {label} <span className={x.count}>{inCategory.filter(test).length}</span>
          </button>
        ))}
      </div>
      <FormError message={act.error || list.error} />
      {!list.data ? (
        !list.error && <p className={t.mute} role="status">Loading messages…</p>
      ) : rows.length === 0 ? (
        <div className={x.empty}>
          <strong>{all.length ? "Nothing here" : "No messages yet"}</strong>
          {all.length ? "Try another filter." : "Messages sent from the Contact page show up here, newest first."}
        </div>
      ) : (
        <ul className={x.roster}>
          {rows.map((msg) => (
            <li key={msg.id} className={`${m.item} ${msg.resolvedAt ? x.off : ""}`}>
              <div className={m.top}>
                <Avatar name={msg.name} tone={msg.resolvedAt ? "mute" : "gold"} />
                <span className={x.who}>
                  <span className={x.name}>{msg.name}</span>
                  <span className={x.sub}>
                    {msg.email}
                    {msg.school && ` · ${msg.school}`}
                  </span>
                </span>
                <span className={x.end}>
                  {msg.resolvedAt ? (
                    <span className={t.status} data-tone="ok" title={`Resolved ${when(msg.resolvedAt)}${msg.resolvedBy ? ` by ${msg.resolvedBy}` : ""}`}>Resolved</span>
                  ) : (
                    <span className={t.status} data-tone="warn">Open</span>
                  )}
                  <span className={x.when} title={when(msg.createdAt)}>{joined(msg.createdAt)}</span>
                </span>
              </div>
              <p className={m.body}>{msg.message}</p>
              <div className={t.inline}>
                <select
                  className={t.select}
                  value={msg.category ?? ""}
                  disabled={act.busy}
                  aria-label={`Category for the message from ${msg.name}`}
                  onChange={(e) => save(msg, { category: (e.target.value || null) as Category | null })}
                >
                  <option value="">No category</option>
                  {Object.entries(CATEGORIES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
                <a className={t.ghost} href={`mailto:${msg.email}?subject=${encodeURIComponent("Re: your message to AVANTRA")}`}>Reply</a>
                <button type="button" className={msg.resolvedAt ? t.ghost : t.btn} disabled={act.busy} onClick={() => save(msg, { resolved: !msg.resolvedAt })}>
                  {msg.resolvedAt ? "Reopen" : "Mark resolved"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
