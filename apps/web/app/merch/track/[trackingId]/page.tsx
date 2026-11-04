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
  { key: "SHIPPED", label: "In Production / Shipped", desc: "Custom print in progress" },
  { key: "DELIVERED", label: "Delivered", desc: "Received at fest / address" },
];

function statusConfig(status: TrackingOrder["status"]) {
  switch (status) {
    case "PENDING":
      return { label: "⏳ Awaiting Verification", className: s.statusPending };
    case "PAID":
      return { label: "✓ Payment Verified", className: s.statusPaid };
    case "SHIPPED":
      return { label: "🚀 In Production / Shipped", className: s.statusShipped };
    case "DELIVERED":
      return { label: "🎉 Delivered", className: s.statusDelivered };
    case "CANCELLED":
      return { label: "✕ Cancelled", className: s.statusCancelled };
    default:
      return { label: status, className: s.statusPending };
  }
}

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
      : STATUS_STEPS.findIndex((st) => st.key === order.status)
    : 0;

  // Percentage for progress line
  const progressPercent = currentStepIndex <= 0 ? 0 : (currentStepIndex / (STATUS_STEPS.length - 1)) * 100;

  // Format class cleanly so it doesn't say "Class Class 7"
  const formattedClass = order
    ? order.studentClass.startsWith("Class")
      ? order.studentClass
      : `Class ${order.studentClass}`
    : "";

  return (
    <div className={s.page}>
      <div className={s.hero} style={{ padding: "5rem 1.5rem 3rem" }}>
        <span className={s.heroLabel}>Live Status</span>
        <h1 className={s.heroTitle} style={{ fontSize: "2.6rem" }}>
          Track Your Order
        </h1>
        <p className={s.heroSub}>Official merchandise tracking for AVANTRA 2026.</p>
      </div>

      <div className={s.section} style={{ maxWidth: 760 }}>
        {loading && (
          <p className={s.mute} style={{ textAlign: "center", padding: "4rem 0" }}>
            Loading order details…
          </p>
        )}

        {error && (
          <div className={s.error} style={{ textAlign: "center", padding: "2rem", borderRadius: 16 }}>
            <p style={{ fontWeight: 700, marginBottom: "0.8rem", fontSize: "1.05rem" }}>{error}</p>
            <Link href="/merch" className={s.trackLink}>
              ← Back to Merch Store
            </Link>
          </div>
        )}

        {order && (
          <div className={s.card} style={{ padding: "1.8rem" }}>
            {/* Header: Tracking ID & Status Pill */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "1.5rem",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: "1.2rem",
              }}
            >
              <div>
                <span className={s.mute} style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Tracking ID
                </span>
                <h2
                  style={{
                    fontSize: "1.6rem",
                    fontWeight: 800,
                    color: "#9fd4ff",
                    letterSpacing: "0.04em",
                    margin: "0.25rem 0",
                  }}
                >
                  {order.trackingId}
                </h2>
                <span className={s.mute} style={{ fontSize: "0.85rem" }}>
                  Placed on{" "}
                  {new Date(order.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Status Badge */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
                <span style={{ fontSize: "0.72rem", color: "rgba(244,234,217,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Current Status
                </span>
                <span className={`${s.trackStatusBadge} ${statusConfig(order.status).className}`}>
                  <span className={s.statusDot} />
                  {statusConfig(order.status).label}
                </span>
              </div>
            </div>

            {/* Stepper Timeline */}
            {order.status !== "CANCELLED" && (
              <div className={s.stepperWrap}>
                <div className={s.stepperLine}>
                  <div
                    className={s.stepperLineProgress}
                    style={{ width: `${progressPercent}%`, height: `${progressPercent}%` }}
                  />
                </div>

                <div className={s.stepperGrid}>
                  {STATUS_STEPS.map((step, idx) => {
                    const isDone = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div key={step.key} className={s.stepperStep}>
                        <div
                          className={`${s.stepperCircle} ${
                            isDone && !isCurrent ? s.stepperCircleDone : ""
                          } ${isCurrent ? s.stepperCircleActive : ""}`}
                        >
                          {isDone && !isCurrent ? "✓" : idx + 1}
                        </div>
                        <div>
                          <div
                            className={`${s.stepperLabel} ${
                              isDone ? s.stepperLabelActive : ""
                            }`}
                          >
                            {step.label}
                          </div>
                          <div className={s.stepperDesc}>{step.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customization Details */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                padding: "1.2rem",
                borderRadius: 14,
                margin: "1.5rem 0",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h3
                style={{
                  fontSize: "0.85rem",
                  margin: "0 0 0.8rem",
                  color: "#9fd4ff",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Customization &amp; Delivery Details
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                  fontSize: "0.9rem",
                }}
              >
                <div>
                  <span className={s.mute} style={{ fontSize: "0.8rem" }}>Name to be printed:</span>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        display: "inline-block",
                        background: "rgba(159,212,255,0.08)",
                        border: "1.5px solid rgba(159,212,255,0.3)",
                        borderRadius: 8,
                        padding: "0.3rem 0.8rem",
                        color: "#f4ead9",
                        fontWeight: 800,
                        fontSize: "1.1rem",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {order.nameToPrint}
                    </span>
                  </div>
                </div>

                <div>
                  <span className={s.mute} style={{ fontSize: "0.8rem" }}>School &amp; Class:</span>
                  <div style={{ color: "#f4ead9", fontWeight: 700, marginTop: 4 }}>
                    {order.schoolName} ({formattedClass})
                  </div>
                </div>
              </div>
            </div>

            {/* Line items */}
            <h3
              style={{
                fontSize: "0.85rem",
                margin: "0 0 0.8rem",
                color: "rgba(244,234,217,0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Ordered Items
            </h3>
            <ul className={s.orderItems}>
              {order.items.map((it, idx) => (
                <li key={idx} className={s.orderItem}>
                  <span>
                    <strong>{it.name}</strong>{" "}
                    <span className={s.mute}>
                      · Size: <strong style={{ color: "#9fd4ff" }}>{it.size}</strong> × {it.quantity}
                    </span>
                  </span>
                  <span className={s.orderItemPrice}>
                    {rupees(it.pricePaise * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className={s.orderTotal} style={{ marginTop: "0.75rem" }}>
              <span>Total Amount</span>
              <span style={{ color: "#9fd4ff", fontSize: "1.35rem" }}>
                {rupees(order.totalPaise)}
              </span>
            </div>

            <div
              style={{
                marginTop: "1.8rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: "1rem",
              }}
            >
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

