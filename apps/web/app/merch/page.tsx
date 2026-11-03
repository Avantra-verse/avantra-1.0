"use client";

// Public merch e-commerce page. Login required to purchase.
// Shows all MerchItems, size chart, cart, and checkout with UPI QR.
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, apiReady, getMe, type Me } from "@/lib/api";
import s from "./merch.module.css";

// ---- types ----

type MerchItem = {
  id: string;
  name: string;
  type: "TSHIRT" | "ZIPPER";
  variant: string;
  price: number; // paise
  imageSrc: string;
  sizes: string[];
  available: boolean;
};

type CartEntry = {
  item: MerchItem;
  size: string;
  quantity: number;
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

// ---- size chart data ----

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

// ---- SizeChartModal ----

function SizeChartModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={s.modal} onClick={onClose}>
      <div className={s.modalBox} onClick={(e) => e.stopPropagation()}>
        <h2 className={s.modalTitle}>Size Chart</h2>
        <p className={s.mute} style={{ marginBottom: "1rem" }}>
          Measurements are in inches. When in doubt, size up for a comfortable fit.
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

        <button type="button" className={s.modalClose} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// ---- ProductCard ----

function ProductCard({ item, onAdd }: { item: MerchItem; onAdd: (entry: CartEntry) => void }) {
  const [size, setSize] = useState(item.sizes[1] ?? item.sizes[0]);

  return (
    <div className={s.card}>
      <div className={s.cardImgWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageSrc} alt={item.name} className={s.cardImg} />
      </div>
      <div className={s.cardBody}>
        <div className={s.cardName}>{item.name}</div>
        <div className={s.cardPrice}>{rupees(item.price)}</div>
        <div className={s.sizeRow}>
          <span className={s.sizeLabel}>Size:</span>
          <select
            className={s.sizeSelect}
            value={size}
            onChange={(e) => setSize(e.target.value)}
            aria-label={`Size for ${item.name}`}
          >
            {item.sizes.map((sz) => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={s.addBtn}
          onClick={() => onAdd({ item, size, quantity: 1 })}
        >
          Add to Cart
        </button>
      </div>
    </div>
  );
}

// ---- CheckoutModal ----

type CheckoutStep = "form" | "payment" | "success";

function CheckoutModal({
  cart,
  me,
  qr,
  onClose,
}: {
  cart: CartEntry[];
  me: Me;
  qr: ActiveQr | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<CheckoutStep>("form");
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

  const totalPaise = cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0);

  const set = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError("");
  };

  async function handleFormNext(e: React.FormEvent) {
    e.preventDefault();
    if (!form.studentClass.trim()) return setError("Please enter your class.");
    if (!form.schoolName.trim()) return setError("Please enter your school name.");
    if (!form.contactNo.trim()) return setError("Please enter your contact number.");
    if (!form.nameToPrint.trim()) return setError("Please enter the name to print on merch.");
    if (form.nameToPrint.trim().length > 10) return setError("Name to print should be 10 characters or less.");
    setStep("payment");
  }

  async function handlePlaceOrder() {
    setError("");
    setBusy(true);
    try {
      const items = cart.map((e) => ({
        itemId: e.item.id,
        size: e.size,
        quantity: e.quantity,
        pricePaise: e.item.price,
      }));
      const r = await api<OrderResult>("/merch/orders", {
        items,
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
  }

  const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

  return (
    <div className={s.modal} onClick={step === "success" ? onClose : undefined}>
      <div className={s.checkoutBox} onClick={(e) => e.stopPropagation()}>
        {step !== "success" && (
          <div className={s.stepBar}>
            <div className={`${s.step} ${step === "form" ? s.active : s.done}`}>1. Your details</div>
            <div className={`${s.step} ${step === "payment" ? s.active : ""}`}>2. Payment</div>
          </div>
        )}

        {step === "form" && (
          <>
            <h2 className={s.checkoutTitle}>Your Details</h2>
            <div className={s.formField}>
              <label>Name (from account)</label>
              <input type="text" value={me.name} disabled style={{ opacity: 0.6 }} />
            </div>
            <form onSubmit={handleFormNext} noValidate>
              <div className={s.formField}>
                <label>Class *</label>
                <select name="studentClass" value={form.studentClass} onChange={set} required>
                  <option value="">Choose…</option>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>Class {g}</option>
                  ))}
                </select>
              </div>
              <div className={s.formField}>
                <label>School Name *</label>
                <input
                  type="text"
                  name="schoolName"
                  value={form.schoolName}
                  onChange={set}
                  placeholder="Your school name"
                  required
                />
              </div>
              <div className={s.formField}>
                <label>Contact No. *</label>
                <input
                  type="tel"
                  name="contactNo"
                  value={form.contactNo}
                  onChange={set}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>
              <div className={s.formField}>
                <label>Name to be Printed on Merch * <span className={s.mute}>(max 10 chars)</span></label>
                <input
                  type="text"
                  name="nameToPrint"
                  value={form.nameToPrint}
                  onChange={set}
                  placeholder="e.g. ROHNIT"
                  maxLength={10}
                  required
                />
              </div>
              <div className={s.checkRow}>
                <input
                  type="checkbox"
                  id="isCoord"
                  checked={form.isCoordinator}
                  onChange={(e) => setForm((f) => ({ ...f, isCoordinator: e.target.checked }))}
                />
                <label htmlFor="isCoord" style={{ cursor: "pointer" }}>
                  <span>Are you a coordinator in AVANTRA 2026?</span>
                </label>
              </div>
              {error && <div className={s.error}>{error}</div>}
              <button type="submit" className={s.placeBtn}>
                Next: Payment →
              </button>
            </form>
            <button type="button" className={s.cancelBtn} onClick={onClose}>
              Cancel
            </button>
          </>
        )}

        {step === "payment" && (
          <>
            <h2 className={s.checkoutTitle}>Complete Payment</h2>

            {/* Order summary */}
            <ul className={s.orderItems}>
              {cart.map((e, i) => (
                <li key={i} className={s.orderItem}>
                  <span className={s.orderItemName}>
                    {e.item.name} — {e.size} × {e.quantity}
                  </span>
                  <span className={s.orderItemPrice}>{rupees(e.item.price * e.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className={s.orderTotal}>
              <span>Total</span>
              <span style={{ color: "#9fd4ff" }}>{rupees(totalPaise)}</span>
            </div>

            {/* UPI QR */}
            {qr ? (
              <div className={s.qrSection}>
                <p className={s.qrTotal}>{rupees(totalPaise)}</p>
                <p className={s.qrUpiId}>{qr.upiId}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/merch-upi-qrs/${qr.storagePath}`}
                  alt="UPI QR Code"
                  className={s.qrImg}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <p className={s.qrNote}>
                  Scan the QR or use UPI ID above. After paying, enter your UTR/reference below.
                </p>
              </div>
            ) : (
              <div className={s.qrSection}>
                <p className={s.mute}>
                  No UPI QR configured yet. Please contact the AVANTRA team for payment details.
                  You can still place the order — payment details will be shared separately.
                </p>
              </div>
            )}

            <div className={s.formField}>
              <label>UTR / Payment Reference (optional)</label>
              <input
                type="text"
                name="paymentNote"
                value={form.paymentNote}
                onChange={set}
                placeholder="e.g. 123456789012"
              />
            </div>

            {error && <div className={s.error}>{error}</div>}
            <button
              type="button"
              className={s.placeBtn}
              onClick={handlePlaceOrder}
              disabled={busy}
            >
              {busy ? "Placing Order…" : "Place Order"}
            </button>
            <button type="button" className={s.cancelBtn} onClick={() => setStep("form")}>
              ← Back
            </button>
          </>
        )}

        {step === "success" && result && (
          <div className={s.successBox}>
            <div className={s.successIcon}>🎉</div>
            <h2 className={s.successTitle}>Order Placed!</h2>
            <p className={s.successSub}>
              A confirmation email has been sent to <strong>{me.email}</strong>.
            </p>
            <div className={s.trackingId}>{result.trackingId}</div>
            <p className={s.successSub}>
              Total: <strong style={{ color: "#9fd4ff" }}>{rupees(result.totalPaise)}</strong>
            </p>
            <Link href={`/merch/track/${result.trackingId}`} className={s.trackLink}>
              Track your order →
            </Link>
            <button type="button" className={s.cancelBtn} style={{ marginTop: "1.2rem" }} onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function MerchPage() {
  const [me, setMe] = useState<Me | null | "loading">("loading");
  const [items, setItems] = useState<MerchItem[]>([]);
  const [activeQr, setActiveQr] = useState<ActiveQr | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!apiReady) { setMe(null); return; }
    getMe().then(setMe).catch(() => setMe(null));
    api<MerchItem[]>("/merch/items").then(setItems).catch((e) => setLoadError(e.message));
    api<ActiveQr | null>("/merch/active-qr").then(setActiveQr).catch(() => null);
  }, []);

  function addToCart(entry: CartEntry) {
    setCart((prev) => {
      const idx = prev.findIndex((e) => e.item.id === entry.item.id && e.size === entry.size);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, entry];
    });
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  const cartCount = cart.reduce((sum, e) => sum + e.quantity, 0);
  const cartTotal = cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0);

  const tshirts = items.filter((i) => i.type === "TSHIRT");
  const zippers = items.filter((i) => i.type === "ZIPPER");
  const others = items.filter((i) => i.type !== "TSHIRT" && i.type !== "ZIPPER");

  return (
    <div className={s.page}>
      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroLabel}>AVANTRA 2026 · Official Merch</div>
        <h1 className={s.heroTitle}>AVANTRA Merchandise</h1>
        <p className={s.heroSub}>
          Rep the multiverse. Exclusive t-shirts and zippers — your name, your design, your edition.
        </p>
        <button
          type="button"
          className={s.chartBtn}
          style={{ marginTop: "1.2rem" }}
          onClick={() => setShowChart(true)}
        >
          📏 Size Chart
        </button>
      </div>

      {/* Content */}
      <div className={s.section}>
        {/* Login gate */}
        {me === null && (
          <div className={s.loginPrompt}>
            <p style={{ marginBottom: "1rem", color: "rgba(244,234,217,0.65)" }}>
              Log in to purchase AVANTRA merch.
            </p>
            <Link href="/login?next=/merch" className={s.loginBtn}>
              Log in to Buy
            </Link>
          </div>
        )}

        {loadError && <div className={s.error}>{loadError}</div>}

        {/* Empty state when no products added yet */}
        {!loadError && items.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <p className={s.mute} style={{ fontSize: "1.1rem" }}>
              Merchandise collection dropping soon! Check back shortly.
            </p>
          </div>
        )}

        {/* T-Shirts */}
        {tshirts.length > 0 && (
          <>
            <h2 className={s.sectionTitle}>T-Shirts</h2>
            <div className={s.grid}>
              {tshirts.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAdd={(entry) => {
                    if (!me || me === "loading") {
                      window.location.href = "/login?next=/merch";
                      return;
                    }
                    addToCart(entry);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Zippers */}
        {zippers.length > 0 && (
          <>
            <h2 className={s.sectionTitle}>Zippers &amp; Hoodies</h2>
            <div className={s.grid}>
              {zippers.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAdd={(entry) => {
                    if (!me || me === "loading") {
                      window.location.href = "/login?next=/merch";
                      return;
                    }
                    addToCart(entry);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Other products */}
        {others.length > 0 && (
          <>
            <h2 className={s.sectionTitle}>More Merchandise</h2>
            <div className={s.grid}>
              {others.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAdd={(entry) => {
                    if (!me || me === "loading") {
                      window.location.href = "/login?next=/merch";
                      return;
                    }
                    addToCart(entry);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {/* Cart overview (when items added) */}
        {cart.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h2 className={s.sectionTitle}>Cart</h2>
            <ul className={s.orderItems}>
              {cart.map((e, i) => (
                <li key={i} className={s.orderItem}>
                  <span className={s.orderItemName}>
                    {e.item.name} — {e.size} × {e.quantity}
                  </span>
                  <span style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                    <span className={s.orderItemPrice}>{rupees(e.item.price * e.quantity)}</span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(i)}
                      style={{ background: "none", border: "none", color: "rgba(244,234,217,0.4)", cursor: "pointer", fontSize: "1rem" }}
                      aria-label={`Remove ${e.item.name}`}
                    >✕</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {cart.length > 0 && (
        <div className={s.cartBar}>
          <div className={s.cartBarInner}>
            <div className={s.cartSummary}>
              <strong>{cartCount}</strong> item{cartCount !== 1 ? "s" : ""} ·{" "}
              <strong>{rupees(cartTotal)}</strong>
            </div>
            <button
              type="button"
              className={s.cartCheckoutBtn}
              onClick={() => {
                if (!me || me === "loading") {
                  window.location.href = "/login?next=/merch";
                  return;
                }
                setShowCheckout(true);
              }}
            >
              Checkout →
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showChart && <SizeChartModal onClose={() => setShowChart(false)} />}
      {showCheckout && me && me !== "loading" && (
        <CheckoutModal
          cart={cart}
          me={me}
          qr={activeQr}
          onClose={() => {
            setShowCheckout(false);
            setCart([]);
          }}
        />
      )}
    </div>
  );
}

