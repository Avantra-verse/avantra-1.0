"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, apiReady, getMe, type Me } from "@/lib/api";
import { loadCart, saveCart, type CartEntry } from "@/lib/merch-cart";
import s from "../merch.module.css";

type MerchItem = {
  id: string;
  name: string;
  type: string;
  variant: string;
  price: number;
  imageSrc: string;
  images: string[];
  sizes: string[];
  available: boolean;
};

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

const TSHIRT_CHART = [
  { size: "XS", chest: "34\"", length: "27\"", shoulder: "15\"" },
  { size: "S",  chest: "36\"", length: "28\"", shoulder: "16\"" },
  { size: "M",  chest: "38\"", length: "29\"", shoulder: "17\"" },
  { size: "L",  chest: "40\"", length: "30\"", shoulder: "18\"" },
  { size: "XL", chest: "42\"", length: "31\"", shoulder: "19\"" },
  { size: "XXL",chest: "44\"", length: "32\"", shoulder: "20\"" },
];

const ZIPPER_CHART = [
  { size: "S",  chest: "38\"", length: "26\"", shoulder: "17\"" },
  { size: "M",  chest: "40\"", length: "27\"", shoulder: "18\"" },
  { size: "L",  chest: "42\"", length: "28\"", shoulder: "19\"" },
  { size: "XL", chest: "44\"", length: "29\"", shoulder: "20\"" },
  { size: "XXL",chest: "46\"", length: "30\"", shoulder: "21\"" },
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

function formatType(type: string): string {
  switch (type) {
    case "TSHIRT": return "T-Shirt";
    case "ZIPPER": return "Zipper / Hoodie";
    case "HOODIE": return "Hoodie";
    case "CAP": return "Cap";
    case "BADGE": return "Badge";
    default: return type || "Merch";
  }
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const router = useRouter();

  const [item, setItem] = useState<MerchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [me, setMe] = useState<Me | null | "loading">("loading");
  const [student, setStudent] = useState<{ schoolName?: string; grade?: number } | null>(null);
  const [qr, setQr] = useState<ActiveQr | null>(null);

  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showChart, setShowChart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeImg, setActiveImg] = useState("");

  // Direct checkout state
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

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    api<MerchItem>(`/merch/items/${id}`)
      .then((data) => {
        setItem(data);
        if (data.sizes && data.sizes.length > 0) {
          setSelectedSize(data.sizes[0]);
        }
        // Set gallery active image to primary
        setActiveImg(data.imageSrc || (data.images?.[0] ?? ""));
      })
      .catch((err: Error) => setLoadError(err.message || "Product not found"))
      .finally(() => setLoading(false));

    api<ActiveQr | null>("/merch/active-qr").then(setQr).catch(() => null);

    if (apiReady) {
      const cachedSchool = typeof window !== "undefined" ? localStorage.getItem("avantra.schoolName") || "" : "";
      if (cachedSchool) {
        setForm((prev) => ({ ...prev, schoolName: prev.schoolName || cachedSchool }));
      }

      Promise.all([
        getMe().catch(() => null),
        api<ProfileDefaults>("/merch/profile-defaults").catch(() => null),
      ])
        .then(([m, profileData]) => {
          setMe(m);
          const resolvedSchool = profileData?.schoolName || cachedSchool;
          if (resolvedSchool && typeof window !== "undefined") {
            try { localStorage.setItem("avantra.schoolName", resolvedSchool); } catch {}
          }
          setForm((prev) => ({
            ...prev,
            studentClass: prev.studentClass || profileData?.studentClass || initialClass(profileData?.grade),
            schoolName: prev.schoolName || resolvedSchool,
            contactNo: prev.contactNo || m?.phone || profileData?.contactNo || "",
            nameToPrint: prev.nameToPrint || initialNameToPrint(m?.name) || profileData?.nameToPrint || "",
          }));
        })
        .catch(() => setMe(null));
    } else {
      setMe(null);
    }
  }, [id]);

  const setFormField = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || me === "loading") {
      router.push(`/login?next=/merch/${id}`);
      return;
    }
    if (!form.studentClass.trim()) return setError("Please select your class.");
    if (!form.schoolName.trim()) return setError("Please enter your school name.");
    if (!form.contactNo.trim()) return setError("Please enter your contact number.");
    const cleanPhone = form.contactNo.replace(/\D/g, "");
    if (!/^(91)?[6-9]\d{9}$/.test(cleanPhone)) {
      return setError("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
    }
    if (!form.nameToPrint.trim()) return setError("Please enter the name to be printed on merch.");
    if (form.nameToPrint.trim().length > 10) return setError("Name to print should be 10 characters or less.");
    setStep("payment");
  };

  const handlePlaceOrder = async () => {
    if (!item) return;
    setError("");
    setBusy(true);

    try {
      const lineItems = [
        {
          itemId: item.id,
          size: selectedSize || "Free Size",
          quantity,
          pricePaise: item.price,
        },
      ];

      const r = await api<OrderResult>("/merch/orders", {
        items: lineItems,
        studentClass: form.studentClass,
        schoolName: form.schoolName,
        contactNo: form.contactNo,
        nameToPrint: form.nameToPrint.trim(),
        isCoordinator: form.isCoordinator,
        paymentNote: form.paymentNote.trim() || null,
      });

      setResult(r);
      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyUpiId = () => {
    if (!qr?.upiId) return;
    navigator.clipboard.writeText(qr.upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const totalPaise = item ? item.price * quantity : 0;

  return (
    <div className={s.page}>
      <div className={s.section} style={{ paddingBottom: 0 }}>
        <Link href="/merch" className={s.backLink}>
          ← Back to Merch Store
        </Link>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "6rem 1rem" }}>
          <p className={s.mute} style={{ fontSize: "1.1rem" }}>Loading merchandise details…</p>
        </div>
      )}

      {loadError && (
        <div style={{ maxWidth: 600, margin: "3rem auto", textAlign: "center" }}>
          <div className={s.error}>{loadError}</div>
          <Link href="/merch" className={s.trackLink} style={{ display: "inline-block", marginTop: "1rem" }}>
            ← Return to store
          </Link>
        </div>
      )}

      {item && (
        <div className={s.detailContainer}>
          {/* Left: Product Gallery */}
          <div className={s.detailGallery}>
            {/* Main image viewer */}
            <div className={s.detailImgBox}>
              <span className={s.detailBadge}>{formatType(item.type)}</span>
              {item.variant && item.variant !== "STANDARD" && (
                <span className={s.cardVariantBadge}>{item.variant}</span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImg || item.imageSrc}
                alt={item.name}
                className={s.detailImg}
                loading="eager"
                decoding="async"
              />
            </div>

            {/* Thumbnail strip — only if there are multiple images */}
            {(() => {
              const gallery = item.images?.length
                ? item.images
                : item.imageSrc
                ? [item.imageSrc]
                : [];
              if (gallery.length <= 1) return null;
              return (
                <div className={s.thumbStrip}>
                  {gallery.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      className={`${s.thumb} ${(activeImg || item.imageSrc) === url ? s.thumbActive : ""}`}
                      onClick={() => setActiveImg(url)}
                      aria-label={`View image ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${item.name} photo ${i + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                      />
                    </button>
                  ))}
                </div>
              );
            })()}

            <div style={{ background: "rgba(255,255,255,0.03)", padding: "1.25rem", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(244,234,217,0.7)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Selected Options
                </span>
                {item.sizes && item.sizes.length > 0 && (
                  <button type="button" className={s.chartBtn} onClick={() => setShowChart(true)}>
                    📏 Size Chart
                  </button>
                )}
              </div>

              {item.sizes && item.sizes.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.85rem", color: "rgba(244,234,217,0.8)", marginBottom: "0.4rem" }}>
                    Size: <strong>{selectedSize}</strong>
                  </div>
                  <div className={s.sizePills}>
                    {item.sizes.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`${s.sizePill} ${selectedSize === sz ? s.sizePillActive : ""}`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
                <div style={{ fontSize: "0.85rem", color: "rgba(244,234,217,0.8)" }}>Quantity</div>
                <div className={s.qtyRow} style={{ margin: 0 }}>
                  <button
                    type="button"
                    className={s.qtyBtn}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    –
                  </button>
                  <span className={s.qtyNum}>{quantity}</span>
                  <button
                    type="button"
                    className={s.qtyBtn}
                    onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    disabled={quantity >= 10}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: "1rem", paddingTop: "0.8rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "0.95rem", color: "rgba(244,234,217,0.7)" }}>Subtotal</span>
                <span style={{ fontSize: "1.35rem", fontWeight: 800, color: "#9fd4ff" }}>{rupees(totalPaise)}</span>
              </div>

              <div style={{ marginTop: "1rem", display: "flex", gap: "0.6rem" }}>
                <button
                  type="button"
                  className={s.addBtn}
                  style={{ flex: 1, padding: "0.75rem" }}
                  onClick={() => {
                    const currentCart = loadCart();
                    const size = selectedSize || item.sizes?.[0] || "Free Size";
                    const idx = currentCart.findIndex((c) => c.item.id === item.id && c.size === size);
                    let updated: CartEntry[];
                    if (idx >= 0) {
                      updated = [...currentCart];
                      updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + quantity };
                    } else {
                      updated = [...currentCart, { item, size, quantity }];
                    }
                    saveCart(updated);
                    setAddedToCart(true);
                    setTimeout(() => setAddedToCart(false), 2000);
                  }}
                >
                  {addedToCart ? "Added to Cart ✓" : "+ Add to Cart"}
                </button>
                <Link
                  href="/merch/checkout"
                  className={s.detailBtn}
                  style={{ flex: 1, padding: "0.75rem" }}
                >
                  Go to Checkout →
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Full-Page Checkout Panel */}
          <div className={s.detailPanel}>
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#9fd4ff", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                Official Merchandise
              </div>
              <h1 className={s.detailTitle}>{item.name}</h1>
              <div className={s.detailPrice}>{rupees(item.price)} <span style={{ fontSize: "0.9rem", color: "rgba(244,234,217,0.45)", fontWeight: 400 }}>per unit</span></div>
            </div>

            {/* Login Prompt if not logged in */}
            {me === null && (
              <div className={s.loginPrompt} style={{ padding: "2rem 1rem", background: "rgba(255,255,255,0.03)", borderRadius: 14 }}>
                <p style={{ marginBottom: "1rem", color: "rgba(244,234,217,0.8)" }}>
                  Please log in with your AVANTRA account to customize and order.
                </p>
                <Link href={`/login?next=/merch/${item.id}`} className={s.loginBtn}>
                  Log in to Order
                </Link>
              </div>
            )}

            {/* Incomplete profile warning */}
            {me && me !== "loading" && !me.profileComplete && (
              <div className={s.error} style={{ marginBottom: "1.5rem" }}>
                Your student profile is incomplete. Please{" "}
                <Link href="/dashboard" style={{ color: "#9fd4ff", textDecoration: "underline" }}>
                  complete your profile on the dashboard
                </Link>{" "}
                before purchasing merch.
              </div>
            )}

            {/* Stepper Header */}
            {me && me !== "loading" && step !== "success" && (
              <div className={s.stepBar}>
                <div className={`${s.step} ${step === "form" ? s.active : s.done}`}>1. Personalization &amp; Details</div>
                <div className={`${s.step} ${step === "payment" ? s.active : ""}`}>2. UPI Payment</div>
              </div>
            )}

            {/* Step 1: Form */}
            {me && me !== "loading" && step === "form" && (
              <form onSubmit={handleNextStep} noValidate>
                <div className={s.formField}>
                  <label>Buyer Name (from account)</label>
                  <input type="text" value={me.name} disabled style={{ opacity: 0.6 }} />
                </div>

                <div className={s.formField}>
                  <label>Class *</label>
                  <select name="studentClass" value={form.studentClass} onChange={setFormField} required>
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
                    placeholder="Enter school or college name"
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

                <div className={s.checkRow} style={{ margin: "1.2rem 0" }}>
                  <input
                    type="checkbox"
                    id="coordCheck"
                    checked={form.isCoordinator}
                    onChange={(e) => setForm((f) => ({ ...f, isCoordinator: e.target.checked }))}
                  />
                  <label htmlFor="coordCheck" style={{ cursor: "pointer", fontSize: "0.9rem" }}>
                    <span>Are you an AVANTRA 2026 Coordinator?</span>
                  </label>
                </div>

                {error && <div className={s.error}>{error}</div>}

                <button type="submit" className={s.placeBtn} style={{ marginTop: "1rem" }}>
                  Proceed to Payment ({rupees(totalPaise)}) →
                </button>
              </form>
            )}

            {/* Step 2: Payment */}
            {me && me !== "loading" && step === "payment" && (
              <div>
                <h3 style={{ fontSize: "1.1rem", margin: "0 0 1rem", color: "#f4ead9" }}>
                  Order Summary
                </h3>

                <div style={{ background: "rgba(255,255,255,0.03)", padding: "1rem", borderRadius: 12, marginBottom: "1.5rem", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span>{item.name} ({selectedSize || "Free Size"}) × {quantity}</span>
                    <strong style={{ color: "#9fd4ff" }}>{rupees(totalPaise)}</strong>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "rgba(244,234,217,0.6)" }}>
                    Print Name: <strong style={{ color: "#f4ead9" }}>{form.nameToPrint}</strong> · Class {form.studentClass}
                  </div>
                </div>

                {qr ? (
                  <div className={s.qrSection} style={{ margin: "1.5rem 0" }}>
                    <div style={{ fontSize: "0.9rem", color: "rgba(244,234,217,0.7)", marginBottom: 4 }}>
                      Scan QR with any UPI App (GPay / PhonePe / Paytm):
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", marginBottom: "0.8rem" }}>
                      <code style={{ fontSize: "1.05rem", color: "#9fd4ff", fontWeight: 700 }}>{qr.upiId}</code>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        style={{
                          background: "rgba(159,212,255,0.1)",
                          border: "1px solid rgba(159,212,255,0.3)",
                          color: "#9fd4ff",
                          borderRadius: 6,
                          padding: "2px 8px",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        {copiedUpi ? "Copied ✓" : "Copy"}
                      </button>
                    </div>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        qr.storagePath.startsWith("http://") || qr.storagePath.startsWith("https://")
                          ? qr.storagePath
                          : `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "")}/storage/v1/object/public/merch-upi-qrs/${qr.storagePath}`
                      }
                      alt="UPI QR Code"
                      className={s.qrImg}
                      style={{ maxWidth: 220, background: "#fff", padding: 8, borderRadius: 12 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <p className={s.qrTotal} style={{ marginTop: "0.6rem" }}>{rupees(totalPaise)}</p>
                  </div>
                ) : (
                  <div className={s.qrSection}>
                    <p className={s.mute}>
                      UPI QR is currently being set up. You can still place your order and our team will coordinate payment with you directly.
                    </p>
                  </div>
                )}

                <div className={s.formField}>
                  <label>UPI Reference ID / UTR (optional)</label>
                  <input
                    type="text"
                    name="paymentNote"
                    value={form.paymentNote}
                    onChange={setFormField}
                    placeholder="Enter 12-digit UPI reference number"
                  />
                </div>

                {error && <div className={s.error}>{error}</div>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.8rem", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    className={s.cancelBtn}
                    onClick={() => setStep("form")}
                    style={{ margin: 0 }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className={s.placeBtn}
                    onClick={handlePlaceOrder}
                    disabled={busy}
                    style={{ margin: 0 }}
                  >
                    {busy ? "Placing Order…" : "Confirm Order →"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {step === "success" && result && (
              <div className={s.successBox}>
                <div className={s.successIcon}>🎉</div>
                <h2 className={s.successTitle}>Order Confirmed!</h2>
                <p className={s.successSub}>
                  Your merchandise order has been placed. A confirmation email has been dispatched to <strong>{me && me !== "loading" ? me.email : ""}</strong>.
                </p>
                <div className={s.trackingId}>{result.trackingId}</div>
                <p className={s.successSub} style={{ margin: "0.5rem 0 1.2rem" }}>
                  Total: <strong style={{ color: "#9fd4ff" }}>{rupees(result.totalPaise)}</strong>
                </p>
                <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <Link href={`/merch/track/${result.trackingId}`} className={s.placeBtn} style={{ textDecoration: "none", padding: "0.6rem 1.4rem" }}>
                    Track Order Status →
                  </Link>
                  <Link href="/merch" className={s.detailBtn} style={{ padding: "0.6rem 1.4rem" }}>
                    Explore More Merch
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Size Chart Modal */}
      {showChart && (
        <div className={s.modal} onClick={() => setShowChart(false)}>
          <div className={s.modalBox} onClick={(e) => e.stopPropagation()}>
            <h2 className={s.modalTitle}>Size Guide</h2>
            <p className={s.mute} style={{ marginBottom: "1rem" }}>
              All measurements are in inches. If you are between sizes, we recommend sizing up.
            </p>

            <p style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#9fd4ff" }}>T-Shirts</p>
            <div style={{ overflowX: "auto" }}>
              <table className={s.chartTable}>
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Chest</th>
                    <th>Length</th>
                    <th>Shoulder</th>
                  </tr>
                </thead>
                <tbody>
                  {TSHIRT_CHART.map((r) => (
                    <tr key={r.size}>
                      <td><strong>{r.size}</strong></td>
                      <td>{r.chest}</td>
                      <td>{r.length}</td>
                      <td>{r.shoulder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ fontWeight: 700, margin: "1.2rem 0 0.5rem", color: "#9fd4ff" }}>Zippers / Hoodies</p>
            <div style={{ overflowX: "auto" }}>
              <table className={s.chartTable}>
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Chest</th>
                    <th>Length</th>
                    <th>Shoulder</th>
                  </tr>
                </thead>
                <tbody>
                  {ZIPPER_CHART.map((r) => (
                    <tr key={r.size}>
                      <td><strong>{r.size}</strong></td>
                      <td>{r.chest}</td>
                      <td>{r.length}</td>
                      <td>{r.shoulder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="button" className={s.modalClose} onClick={() => setShowChart(false)}>
              Close Size Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

