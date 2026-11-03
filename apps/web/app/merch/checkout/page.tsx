"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiReady, getMe, type Me } from "@/lib/api";
import { loadCart, saveCart, clearCart, type CartEntry } from "@/lib/merch-cart";
import s from "../merch.module.css";

type ActiveQr = {
  id: string;
  upiId: string;
  storagePath: string;
  label: string;
};

type OrderResult = {
  orderId: string;
  trackingId: string;
  totalPaise: number;
};

type ProfileDefaults = {
  schoolName: string;
  grade: number | null;
  studentClass: string;
  contactNo: string;
  nameToPrint: string;
};

const GRADE_OPTIONS = [
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
  "Other",
];

const rupees = (p: number) => "₹" + (p / 100).toFixed(0);

function initialClass(grade?: number | null): string {
  if (!grade) return "";
  const match = `Class ${grade}`;
  return GRADE_OPTIONS.includes(match) ? match : "Other";
}

function initialNameToPrint(name?: string): string {
  if (!name) return "";
  const first = name.trim().split(/\s+/)[0] || "";
  return first.slice(0, 10).toUpperCase();
}

export default function CheckoutPage() {
  const router = useRouter();

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);

  const [me, setMe] = useState<Me | null | "loading">("loading");
  const [qr, setQr] = useState<ActiveQr | null>(null);

  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [form, setForm] = useState({
    studentClass: "",
    schoolName: "",
    contactNo: "",
    nameToPrint: "",
    isCoordinator: false,
    paymentNote: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    const loaded = loadCart();
    setCart(loaded);
    setCartLoaded(true);

    const onCartUpdate = () => {
      setCart(loadCart());
    };
    window.addEventListener("avantra-cart-update", onCartUpdate);
    return () => window.removeEventListener("avantra-cart-update", onCartUpdate);
  }, []);

  // Load authentication & profile defaults
  useEffect(() => {
    if (!apiReady) {
      setMe(null);
      return;
    }

    // Attempt to load cached school name first for instant zero-latency fill
    const cachedSchool = typeof window !== "undefined" ? localStorage.getItem("avantra.schoolName") || "" : "";
    if (cachedSchool) {
      setForm((prev) => ({ ...prev, schoolName: prev.schoolName || cachedSchool }));
    }

    Promise.all([
      getMe().catch(() => null),
      api<ProfileDefaults>("/merch/profile-defaults").catch(() => null),
      api<ActiveQr | null>("/merch/active-qr").catch(() => null),
    ]).then(([userData, profileData, qrData]) => {
      setMe(userData);
      if (qrData) setQr(qrData);

      const resolvedSchool = profileData?.schoolName || cachedSchool;
      if (resolvedSchool && typeof window !== "undefined") {
        try { localStorage.setItem("avantra.schoolName", resolvedSchool); } catch {}
      }

      setForm((prev) => ({
        ...prev,
        studentClass:
          prev.studentClass ||
          profileData?.studentClass ||
          initialClass(profileData?.grade),
        schoolName: prev.schoolName || resolvedSchool,
        contactNo: prev.contactNo || userData?.phone || profileData?.contactNo || "",
        nameToPrint:
          prev.nameToPrint ||
          initialNameToPrint(userData?.name) ||
          profileData?.nameToPrint ||
          "",
      }));
    });
  }, []);

  const cartTotal = cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0);

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const updated = [...cart];
    updated[index].quantity = Math.min(10, newQty);
    setCart(updated);
    saveCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
    saveCart(updated);
  };

  const setFormField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.studentClass) {
      setError("Please select your class.");
      return;
    }
    if (!form.schoolName.trim()) {
      setError("Please enter your school or college name.");
      return;
    }
    if (!form.contactNo.trim() || form.contactNo.replace(/\D/g, "").length < 10) {
      setError("Please provide a valid 10-digit WhatsApp contact number.");
      return;
    }
    if (!form.nameToPrint.trim()) {
      setError("Please specify the name to be printed on your merchandise.");
      return;
    }
    if (form.nameToPrint.trim().length > 10) {
      setError("Printed name must be at most 10 characters.");
      return;
    }

    // Cache school name
    if (typeof window !== "undefined") {
      try { localStorage.setItem("avantra.schoolName", form.schoolName.trim()); } catch {}
    }

    setStep("payment");
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const note = form.paymentNote.trim();
    if (!note) {
      setError("Please enter the UTR or Transaction ID after making the payment.");
      return;
    }

    setBusy(true);
    try {
      const orderPayloadItems = cart.map((c) => ({
        itemId: c.item.id,
        size: c.size,
        quantity: c.quantity,
      }));

      const res = await api<OrderResult>("/merch/orders", {
        items: orderPayloadItems,
        studentClass: form.studentClass,
        schoolName: form.schoolName.trim(),
        contactNo: form.contactNo.trim(),
        nameToPrint: form.nameToPrint.trim().toUpperCase(),
        isCoordinator: form.isCoordinator,
        paymentNote: note,
      });

      setResult(res);
      setStep("success");
      clearCart();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to place order. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const copyUpi = () => {
    if (!qr?.upiId) return;
    navigator.clipboard.writeText(qr.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  return (
    <div className={s.page}>
      <div className={s.section} style={{ paddingBottom: 0 }}>
        <Link href="/merch" className={s.backLink}>
          ← Back to Merch Store
        </Link>
      </div>

      <div className={s.section}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 className={s.title} style={{ fontSize: "2.2rem", marginBottom: "0.25rem" }}>
            Merch Checkout
          </h1>
          <p className={s.sub}>
            Finalize your official AVANTRA 2026 merchandise order and personalize your gear.
          </p>
        </div>

        {/* Empty Cart State */}
        {cartLoaded && cart.length === 0 && step !== "success" && (
          <div style={{ maxWidth: 540, margin: "3rem auto", textAlign: "center", padding: "3rem 1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛍️</div>
            <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f4ead9", marginBottom: "0.5rem" }}>
              Your cart is empty
            </h2>
            <p className={s.mute} style={{ marginBottom: "1.8rem" }}>
              Browse our collection of t-shirts and hoodies to customize your AVANTRA kit.
            </p>
            <Link href="/merch" className={s.trackLink} style={{ display: "inline-block", padding: "0.8rem 1.8rem", fontSize: "0.95rem" }}>
              ← Browse Merchandise
            </Link>
          </div>
        )}

        {/* Full Checkout Page Layout */}
        {(cart.length > 0 || step === "success") && (
          <div className={s.detailContainer}>
            {/* Left Column: Order Summary */}
            <div className={s.detailGallery}>
              <div style={{ background: "rgba(27, 22, 19, 0.7)", padding: "1.5rem", borderRadius: 18, border: "1.5px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.8rem" }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#f4ead9", margin: 0 }}>
                    Order Items ({cart.reduce((n, c) => n + c.quantity, 0)})
                  </h3>
                  <Link href="/merch" style={{ fontSize: "0.8rem", color: "#9fd4ff", textDecoration: "none" }}>
                    + Add More
                  </Link>
                </div>

                {cart.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {cart.map((entry, idx) => (
                      <div
                        key={`${entry.item.id}-${entry.size}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "1rem",
                          padding: "0.75rem",
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 10,
                            background: "#ffffff",
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={entry.item.imageSrc}
                            alt={entry.item.name}
                            style={{ width: "90%", height: "90%", objectFit: "contain" }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f4ead9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {entry.item.name}
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "rgba(244,234,217,0.6)", marginTop: 2 }}>
                            Size: <strong style={{ color: "#9fd4ff" }}>{entry.size}</strong> · {rupees(entry.item.price)} each
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <button
                            type="button"
                            className={s.qtyBtn}
                            onClick={() => updateQuantity(idx, entry.quantity - 1)}
                            disabled={step === "success"}
                            style={{ width: 28, height: 28, fontSize: "0.85rem" }}
                          >
                            –
                          </button>
                          <span style={{ fontSize: "0.9rem", fontWeight: 700, minWidth: 18, textAlign: "center" }}>
                            {entry.quantity}
                          </span>
                          <button
                            type="button"
                            className={s.qtyBtn}
                            onClick={() => updateQuantity(idx, entry.quantity + 1)}
                            disabled={step === "success" || entry.quantity >= 10}
                            style={{ width: 28, height: 28, fontSize: "0.85rem" }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            disabled={step === "success"}
                            style={{
                              background: "none",
                              border: "none",
                              color: "rgba(244,234,217,0.4)",
                              cursor: "pointer",
                              padding: "4px 8px",
                              fontSize: "1rem",
                            }}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "1rem", marginTop: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem", color: "rgba(244,234,217,0.7)" }}>
                        <span>Subtotal</span>
                        <span>{rupees(cartTotal)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem", color: "rgba(244,234,217,0.7)" }}>
                        <span>Delivery / Pickup</span>
                        <span style={{ color: "#4ade80" }}>Campus Pickup (Free)</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
                        <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f4ead9" }}>Total</span>
                        <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#9fd4ff" }}>
                          {rupees(cartTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={s.mute}>Order completed.</p>
                )}
              </div>
            </div>

            {/* Right Column: Checkout Form (NO POPUP) */}
            <div className={s.detailPanel}>
              {/* Not Logged In Prompt */}
              {me === null && (
                <div className={s.loginPrompt} style={{ padding: "2.5rem 1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: 16 }}>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#f4ead9", marginBottom: "0.5rem" }}>
                    Account Required
                  </h3>
                  <p style={{ marginBottom: "1.5rem", color: "rgba(244,234,217,0.8)", fontSize: "0.95rem" }}>
                    Please log in with your AVANTRA student account so your details and merchandise can be linked to your pass.
                  </p>
                  <Link href="/login?next=/merch/checkout" className={s.loginBtn}>
                    Log in with AVANTRA Account
                  </Link>
                </div>
              )}

              {/* Stepper Header */}
              {me && me !== "loading" && step !== "success" && (
                <div className={s.stepBar}>
                  <div className={`${s.step} ${step === "form" ? s.active : s.done}`}>
                    1. Student Details
                  </div>
                  <div className={`${s.step} ${step === "payment" ? s.active : ""}`}>
                    2. UPI Payment
                  </div>
                </div>
              )}

              {/* Step 1: Student Details Form */}
              {me && me !== "loading" && step === "form" && (
                <form onSubmit={handleNextStep} noValidate>
                  <div className={s.formField}>
                    <label>Buyer Name (from account)</label>
                    <input type="text" value={me.name} disabled style={{ opacity: 0.65 }} />
                  </div>

                  <div className={s.formField}>
                    <label>Class *</label>
                    <select
                      name="studentClass"
                      value={form.studentClass}
                      onChange={setFormField}
                      required
                    >
                      <option value="">Choose Class</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className={s.formField}>
                    <label>School Name *</label>
                    <input
                      type="text"
                      name="schoolName"
                      value={form.schoolName}
                      onChange={setFormField}
                      placeholder="e.g. SSRVM IEMS, Sector 20, Rourkela"
                      required
                    />
                  </div>

                  <div className={s.formField}>
                    <label>Contact Number (WhatsApp) *</label>
                    <input
                      type="tel"
                      name="contactNo"
                      value={form.contactNo}
                      onChange={setFormField}
                      placeholder="10-digit mobile number"
                      required
                    />
                  </div>

                  <div className={s.formField}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <label>Name to be Printed on Merch *</label>
                      <span style={{ fontSize: "0.75rem", color: form.nameToPrint.length === 10 ? "#facc15" : "rgba(244,234,217,0.5)" }}>
                        {form.nameToPrint.length}/10 chars
                      </span>
                    </div>
                    <p className={s.mute} style={{ fontSize: "0.78rem", margin: "2px 0 6px", lineHeight: 1.4 }}>
                      Max 10 characters so your name prints neatly and boldly on the merchandise.
                    </p>
                    <input
                      type="text"
                      name="nameToPrint"
                      value={form.nameToPrint}
                      onChange={setFormField}
                      placeholder="e.g. VISHESH"
                      maxLength={10}
                      required
                    />
                  </div>

                  <div className={s.checkRow} style={{ marginTop: "1rem" }}>
                    <input
                      type="checkbox"
                      id="checkout-coordinator"
                      name="isCoordinator"
                      checked={form.isCoordinator}
                      onChange={setFormField}
                    />
                    <label htmlFor="checkout-coordinator" style={{ fontSize: "0.85rem", cursor: "pointer", color: "rgba(244,234,217,0.85)" }}>
                      Are you an AVANTRA 2026 coordinator or volunteer?
                    </label>
                  </div>

                  {error && <div className={s.error} style={{ marginTop: "1rem" }}>{error}</div>}

                  <button
                    type="submit"
                    className={s.submitBtn}
                    style={{ marginTop: "1.5rem" }}
                  >
                    Next: Proceed to Payment →
                  </button>
                </form>
              )}

              {/* Step 2: Payment */}
              {me && me !== "loading" && step === "payment" && (
                <form onSubmit={handlePlaceOrder} noValidate>
                  <div className={s.qrBox}>
                    {qr?.storagePath ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/qr/${qr.storagePath}`}
                        alt="AVANTRA UPI QR"
                        className={s.qrImg}
                        style={{ maxWidth: 220, borderRadius: 12, margin: "0 auto" }}
                      />
                    ) : (
                      <div className={s.qrPlaceholder} style={{ padding: "2rem" }}>
                        <p style={{ fontWeight: 700, color: "#f4ead9", marginBottom: "0.5rem" }}>
                          AVANTRA Official UPI
                        </p>
                        <p style={{ fontSize: "0.85rem", color: "rgba(244,234,217,0.6)" }}>
                          Scan using GPay, PhonePe, or Paytm
                        </p>
                      </div>
                    )}

                    {qr?.upiId && (
                      <div style={{ marginTop: "1rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.85rem", color: "rgba(244,234,217,0.7)", marginBottom: 4 }}>
                          UPI ID:
                        </div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(255,255,255,0.06)", padding: "0.35rem 0.8rem", borderRadius: 8 }}>
                          <code style={{ fontSize: "0.95rem", color: "#9fd4ff" }}>{qr.upiId}</code>
                          <button
                            type="button"
                            onClick={copyUpi}
                            style={{
                              background: "none",
                              border: "none",
                              color: copiedUpi ? "#4ade80" : "rgba(244,234,217,0.7)",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                              fontWeight: 700,
                            }}
                          >
                            {copiedUpi ? "Copied! ✓" : "Copy"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: 12, margin: "1.2rem 0", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.9rem", color: "rgba(244,234,217,0.7)" }}>Payable Amount</span>
                      <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#9fd4ff" }}>{rupees(cartTotal)}</span>
                    </div>
                  </div>

                  <div className={s.formField}>
                    <label>Transaction UTR / Reference ID *</label>
                    <input
                      type="text"
                      name="paymentNote"
                      value={form.paymentNote}
                      onChange={setFormField}
                      placeholder="e.g. 12-digit UTR from GPay / PhonePe / Paytm"
                      required
                      autoFocus
                    />
                    <p className={s.mute} style={{ fontSize: "0.78rem", margin: "4px 0 0" }}>
                      Enter the 12-digit UTR or reference number shown in your payment app receipt so we can verify your order.
                    </p>
                  </div>

                  {error && <div className={s.error} style={{ marginTop: "1rem" }}>{error}</div>}

                  <div style={{ display: "flex", gap: "0.8rem", marginTop: "1.5rem" }}>
                    <button
                      type="button"
                      className={s.detailBtn}
                      onClick={() => setStep("form")}
                      disabled={busy}
                      style={{ flex: 1 }}
                    >
                      ← Back
                    </button>
                    <button
                      type="submit"
                      className={s.submitBtn}
                      disabled={busy}
                      style={{ flex: 2, margin: 0 }}
                    >
                      {busy ? "Placing Order…" : `Confirm & Pay ${rupees(cartTotal)}`}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Success Confirmation */}
              {step === "success" && result && (
                <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
                  <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🎉</div>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f4ead9", marginBottom: "0.5rem" }}>
                    Order Placed Successfully!
                  </h3>
                  <p className={s.mute} style={{ fontSize: "0.95rem", marginBottom: "1.5rem" }}>
                    Your merchandise order has been submitted. Our team will verify your payment and prepare your customized gear.
                  </p>

                  <div style={{ background: "rgba(255,255,255,0.04)", padding: "1.2rem", borderRadius: 14, border: "1px solid rgba(159,212,255,0.3)", maxWidth: 360, margin: "0 auto 1.5rem" }}>
                    <div style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(244,234,217,0.6)", marginBottom: 4 }}>
                      Tracking ID
                    </div>
                    <code style={{ fontSize: "1.4rem", fontWeight: 800, color: "#9fd4ff", letterSpacing: "0.08em" }}>
                      {result.trackingId}
                    </code>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: 320, margin: "0 auto" }}>
                    <Link href={`/merch/track/${result.trackingId}`} className={s.trackLink} style={{ display: "block" }}>
                      Track Order Status →
                    </Link>
                    <Link href="/merch" className={s.detailBtn} style={{ display: "block" }}>
                      ← Return to Store
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

