"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import s from "../../merch.module.css";

type TrackingOrder = {
  id: string;
  trackingId: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  totalPaise: number;
  nameToPrint: string;
  studentClass: string;
  schoolName: string;
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

const STATUS_STEPS = [
  { key: "PENDING", label: "Order Placed", desc: "Awaiting UPI verification" },
  { key: "PAID", label: "Payment Verified", desc: "Confirmed by admin" },
  { key: "SHIPPED", label: "Shipped / In Production", desc: "Custom print in progress" },
  { key: "DELIVERED", label: "Delivered", desc: "Received at fest / address" },
];

export default function OrderTrackingPage() {
  const params = useParams();
  const trackingId = String(params?.trackingId || "");
  const [order, setOrder] = useState<TrackingOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackingId) return;
    setLoading(true);
    api<TrackingOrder>(`/merch/orders/${encodeURIComponent(trackingId)}`)
      .then((data) => {
        setOrder(data);
        setError("");
      })
      .catch((err: Error) => {
        setError(err.message || "Order not found");
      })
      .finally(() => setLoading(false));
  }, [trackingId]);

  const currentStepIndex = order
    ? order.status === "CANCELLED"
      ? -1
      : STATUS_STEPS.findIndex((s) => s.key === order.status)
    : 0;

  return (
    <div className={s.page}>
      <div className={s.hero} style={{ padding: "5rem 1.5rem 3rem" }}>
        <div className={s.heroLabel}>Order Tracking</div>
        <h1 className={s.heroTitle} style={{ fontSize: "2.5rem" }}>
          {trackingId || "Track Merch"}
        </h1>
        <p className={s.heroSub}>Check the real-time status of your AVANTRA 2026 merchandise.</p>
      </div>

      <div className={s.section} style={{ maxWidth: 720 }}>
        {loading && <p className={s.mute} style={{ textAlign: "center" }}>Loading order details…</p>}

        {error && (
          <div className={s.error} style={{ textAlign: "center", padding: "1.5rem" }}>
            <p style={{ fontWeight: 700, marginBottom: "0.5rem" }}>{error}</p>
            <Link href="/merch" className={s.trackLink}>
              ← Back to Merch Store
            </Link>
          </div>
        )}

        {order && (
          <div className={s.card} style={{ padding: "1.8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem" }}>
              <div>
                <span className={s.mute}>Tracking ID</span>
                <h2 style={{ fontSize: "1.4rem", color: "#9fd4ff", margin: "0.2rem 0" }}>{order.trackingId}</h2>
                <span className={s.mute}>Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className={s.mute}>Status</span>
                <div style={{
                  display: "inline-block",
                  padding: "0.3rem 0.8rem",
                  borderRadius: "999px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  marginTop: "0.2rem",
                  background: order.status === "PAID" || order.status === "DELIVERED" ? "rgba(34,197,94,0.15)" : order.status === "CANCELLED" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
                  color: order.status === "PAID" || order.status === "DELIVERED" ? "#4ade80" : order.status === "CANCELLED" ? "#f87171" : "#facc15",
                  border: `1px solid ${order.status === "PAID" || order.status === "DELIVERED" ? "rgba(74,222,128,0.3)" : order.status === "CANCELLED" ? "rgba(248,113,113,0.3)" : "rgba(250,204,21,0.3)"}`
                }}>
                  {order.status}
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            {order.status !== "CANCELLED" && (
              <div style={{ margin: "1.5rem 0 2rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${STATUS_STEPS.length}, 1fr)`, gap: "0.5rem", position: "relative" }}>
                  {STATUS_STEPS.map((step, idx) => {
                    const isDone = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={step.key} style={{ textAlign: "center", position: "relative" }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          margin: "0 auto 0.5rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          background: isDone ? "#b3121e" : "rgba(255,255,255,0.08)",
                          color: isDone ? "#ffffff" : "rgba(244,234,217,0.4)",
                          border: isCurrent ? "2px solid #9fd4ff" : "1px solid rgba(255,255,255,0.15)",
                          boxShadow: isCurrent ? "0 0 10px rgba(159,212,255,0.5)" : "none",
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: isDone ? "#f4ead9" : "rgba(244,234,217,0.4)" }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: "0.65rem", color: "rgba(244,234,217,0.5)", marginTop: 2 }}>
                          {step.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customization Details */}
            <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: 10, marginBottom: "1.5rem", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.6rem", color: "#9fd4ff" }}>Print Customization</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", fontSize: "0.85rem" }}>
                <div>
                  <span className={s.mute}>Name to be printed:</span>
                  <div style={{ fontWeight: 700, color: "#f4ead9", fontSize: "1.05rem" }}>{order.nameToPrint}</div>
                </div>
                <div>
                  <span className={s.mute}>School / Class:</span>
                  <div style={{ color: "#f4ead9" }}>{order.schoolName} (Class {order.studentClass})</div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <h3 style={{ fontSize: "0.95rem", margin: "0 0 0.8rem", color: "#f4ead9" }}>Ordered Items</h3>
            <ul className={s.orderItems}>
              {order.items.map((it, idx) => (
                <li key={idx} className={s.orderItem}>
                  <span>
                    <strong>{it.name}</strong> <span className={s.mute}>· Size: {it.size} × {it.quantity}</span>
                  </span>
                  <span className={s.orderItemPrice}>{rupees(it.pricePaise * it.quantity)}</span>
                </li>
              ))}
            </ul>

            <div className={s.orderTotal} style={{ marginTop: "0.5rem" }}>
              <span>Total Paid / Payable</span>
              <span style={{ color: "#9fd4ff", fontSize: "1.2rem" }}>{rupees(order.totalPaise)}</span>
            </div>

            <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href="/merch" className={s.trackLink}>
                ← Return to Merch Store
              </Link>
              <Link href="/dashboard/merch" className={s.trackLink}>
                View all my orders →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

