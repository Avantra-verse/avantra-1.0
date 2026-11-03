"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, apiReady } from "@/lib/api";
import { FormError, styles } from "@/components/account/Account";
import t from "../../staff/tools.module.css";
import d from "../dashboard.module.css";
import { Cosmos } from "../cosmos";

type MyMerchOrder = {
  id: string;
  trackingId: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  totalPaise: number;
  nameToPrint: string;
  createdAt: string;
  verifiedAt: string | null;
  items: {
    name: string;
    size: string;
    quantity: number;
    pricePaise: number;
  }[];
};

const rupees = (p: number) => "₹" + (p / 100).toFixed(0);

const statusTone = (status: string): "ok" | "warn" | undefined => {
  if (status === "PAID" || status === "DELIVERED") return "ok";
  if (status === "PENDING" || status === "SHIPPED") return "warn";
  return undefined;
};

export default function DashboardMerchPage() {
  const [orders, setOrders] = useState<MyMerchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    if (!apiReady) return;
    setLoading(true);
    api<MyMerchOrder[]>("/merch/orders/mine")
      .then((data) => {
        setOrders(data);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={styles.registrationPage}>
      <div className={styles.starfieldLayer} aria-hidden="true" />
      <div className={`${t.page} ${t.appPage}`}>
        <header className={`${t.pageHead} ${d.band}`}>
          <Cosmos compact />
          <h1>My Merch Orders</h1>
          <p>Track your AVANTRA 2026 merchandise, customize names, and view order receipts.</p>
        </header>

        <section className={t.panel} aria-labelledby="merch-orders">
          <div className={t.panelHead}>
            <h2 id="merch-orders">Orders ({orders.length})</h2>
            <div className={t.inline}>
              <Link href="/merch" className={t.btn} style={{ textDecoration: "none" }}>
                + Order More Merch
              </Link>
              <button type="button" className={t.ghost} onClick={load}>
                Refresh
              </button>
            </div>
          </div>

          <FormError message={error} />

          {loading ? (
            <p className={t.mute} role="status">Loading orders…</p>
          ) : orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
              <p className={t.mute} style={{ marginBottom: "1rem" }}>
                You have not ordered any merchandise yet.
              </p>
              <Link href="/merch" className={t.btn} style={{ textDecoration: "none" }}>
                Explore AVANTRA Merch
              </Link>
            </div>
          ) : (
            <div className={t.scroll}>
              <table className={`${t.table} ${t.stack}`}>
                <thead>
                  <tr>
                    <th>Tracking ID</th>
                    <th>Name on Merch</th>
                    <th>Items</th>
                    <th className={t.num}>Total</th>
                    <th>Status</th>
                    <th>Placed On</th>
                    <th>Track</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className={t.mono} data-label="Tracking ID">
                        <Link href={`/merch/track/${o.trackingId}`} style={{ color: "#9fd4ff", textDecoration: "underline" }}>
                          {o.trackingId}
                        </Link>
                      </td>
                      <td data-label="Name on Merch">
                        <strong>{o.nameToPrint}</strong>
                      </td>
                      <td data-label="Items">
                        {o.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: "0.85rem" }}>
                            {it.name} ({it.size}) × {it.quantity}
                          </div>
                        ))}
                      </td>
                      <td className={t.num} data-label="Total">
                        <strong>{rupees(o.totalPaise)}</strong>
                      </td>
                      <td data-label="Status">
                        <span className={t.status} data-tone={statusTone(o.status)}>
                          {o.status}
                        </span>
                      </td>
                      <td data-label="Placed On">
                        {new Date(o.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td data-label="Track">
                        <Link href={`/merch/track/${o.trackingId}`} className={t.ghost} style={{ textDecoration: "none", display: "inline-block" }}>
                          Track →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

