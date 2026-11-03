"use client";

// Public merch e-commerce page. Login required to purchase.
// Shows all MerchItems, size chart, cart summary, and direct link to full-page checkout.
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, apiReady, getMe, type Me } from "@/lib/api";
import { loadCart, saveCart, type CartEntry, type MerchItem } from "@/lib/merch-cart";
import s from "./merch.module.css";

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

function ProductCard({ item, onAdd }: { item: MerchItem; onAdd: (entry: CartEntry) => void }) {
  const [added, setAdded] = useState(false);
  const defaultSize = item.sizes?.[0] || "Free Size";

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAdd({ item, size: defaultSize, quantity: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className={s.card}>
      <Link href={`/merch/${item.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div className={s.cardImgWrap}>
          <span className={s.cardBadge}>{formatType(item.type)}</span>
          {item.variant && item.variant !== "STANDARD" && (
            <span className={s.cardVariantBadge}>{item.variant}</span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageSrc} alt={item.name} className={s.cardImg} />
        </div>
      </Link>

      <div className={s.cardBody}>
        <div className={s.cardHeader}>
          <Link href={`/merch/${item.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1 }}>
            <div className={s.cardName}>{item.name}</div>
          </Link>
          <div className={s.cardPrice}>{rupees(item.price)}</div>
        </div>

        {item.sizes && item.sizes.length > 0 ? (
          <div className={s.sizesHint}>
            <span>Sizes:</span>
            {item.sizes.map((sz) => (
              <span key={sz} className={s.sizeChip}>{sz}</span>
            ))}
          </div>
        ) : (
          <div className={s.sizesHint}>
            <span className={s.sizeChip}>One Size / Free Size</span>
          </div>
        )}

        <div className={s.cardActions}>
          <Link href={`/merch/${item.id}`} className={s.detailBtn}>
            Customize →
          </Link>
          <button
            type="button"
            className={s.addBtn}
            onClick={handleAdd}
          >
            {added ? "Added ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Merch Store Page ----

export default function MerchPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | "loading">("loading");
  const [items, setItems] = useState<MerchItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    // Load initial cart
    setCart(loadCart());

    const onCartUpdate = () => {
      setCart(loadCart());
    };
    window.addEventListener("avantra-cart-update", onCartUpdate);

    if (apiReady) {
      getMe().then(setMe).catch(() => setMe(null));
      api<MerchItem[]>("/merch/items")
        .then((data) => { setItems(data); setItemsLoading(false); })
        .catch((e) => { setLoadError(e?.message ?? "Failed to load products"); setItemsLoading(false); });
    } else {
      setMe(null);
      setItemsLoading(false);
      setLoadError("Store is not configured yet. Check back soon.");
    }

    return () => window.removeEventListener("avantra-cart-update", onCartUpdate);
  }, []);

  function addToCart(entry: CartEntry) {
    setCart((prev) => {
      const idx = prev.findIndex((e) => e.item.id === entry.item.id && e.size === entry.size);
      let updated: CartEntry[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
      } else {
        updated = [...prev, entry];
      }
      saveCart(updated);
      return updated;
    });
  }

  function removeFromCart(idx: number) {
    setCart((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      saveCart(updated);
      return updated;
    });
  }

  const cartCount = cart.reduce((sum, e) => sum + e.quantity, 0);
  const cartTotal = cart.reduce((sum, e) => sum + e.item.price * e.quantity, 0);

  const tshirts = items.filter((i) => i.type === "TSHIRT");
  const zippers = items.filter((i) => i.type === "ZIPPER" || i.type === "HOODIE");
  const others = items.filter((i) => i.type !== "TSHIRT" && i.type !== "ZIPPER" && i.type !== "HOODIE");

  const goToCheckout = () => {
    if (!me || me === "loading") {
      router.push("/login?next=/merch/checkout");
      return;
    }
    router.push("/merch/checkout");
  };

  return (
    <div className={s.page}>
      {/* Hero */}
      <div className={s.hero}>
        <span className={s.heroLabel}>Official Merch — AVANTRA 2026</span>
        <h1 className={s.heroTitle}>AVANTRA Merch Store</h1>
        <p className={s.heroSub}>
          Wear the multiverse. Premium official festival merchandise for AVANTRA 2026.
        </p>
        <div style={{ marginTop: "1.4rem", display: "flex", gap: "0.8rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className={s.chartBtn}
            onClick={() => setShowChart(true)}
          >
            📏 Size Guide
          </button>
          {cartCount > 0 && (
            <button
              type="button"
              className={s.cartCheckoutBtn}
              onClick={goToCheckout}
              style={{ padding: "0.45rem 1.2rem", fontSize: "0.85rem" }}
            >
              🛒 Cart ({cartCount}) — {rupees(cartTotal)} →
            </button>
          )}
        </div>
      </div>

      <div className={s.section}>
        {loadError && (
          <div className={s.error} style={{ margin: "2rem 0" }}>
            {loadError}
          </div>
        )}

        {itemsLoading && !loadError && (
          <p className={s.mute} style={{ textAlign: "center", padding: "3rem 0" }}>
            Loading merchandise…
          </p>
        )}

        {!itemsLoading && !loadError && items.length === 0 && (
          <p className={s.mute} style={{ textAlign: "center", padding: "3rem 0" }}>
            Merchandise dropping soon — check back later! 🔥
          </p>
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
                  onAdd={(entry) => addToCart(entry)}
                />
              ))}
            </div>
          </>
        )}

        {/* Zippers & Hoodies */}
        {zippers.length > 0 && (
          <>
            <h2 className={s.sectionTitle}>Zippers &amp; Hoodies</h2>
            <div className={s.grid}>
              {zippers.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAdd={(entry) => addToCart(entry)}
                />
              ))}
            </div>
          </>
        )}

        {/* Other Items */}
        {others.length > 0 && (
          <>
            <h2 className={s.sectionTitle}>More Merchandise</h2>
            <div className={s.grid}>
              {others.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAdd={(entry) => addToCart(entry)}
                />
              ))}
            </div>
          </>
        )}

        {/* Cart overview (when items added) */}
        {cart.length > 0 && (
          <div style={{ marginTop: "3rem", background: "rgba(255,255,255,0.02)", padding: "1.5rem", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 className={s.sectionTitle} style={{ margin: 0 }}>
                Shopping Cart ({cartCount})
              </h2>
              <button
                type="button"
                className={s.cartCheckoutBtn}
                onClick={goToCheckout}
                style={{ padding: "0.5rem 1.2rem", fontSize: "0.9rem" }}
              >
                Proceed to Checkout →
              </button>
            </div>
            <ul className={s.orderItems}>
              {cart.map((e, i) => (
                <li key={`${e.item.id}-${e.size}-${i}`} className={s.orderItem}>
                  <span className={s.orderItemName}>
                    {e.item.name} — <strong style={{ color: "#9fd4ff" }}>{e.size}</strong> × {e.quantity}
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

      {/* Sticky bottom cart bar */}
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
              onClick={goToCheckout}
            >
              Checkout →
            </button>
          </div>
        </div>
      )}

      {/* Size Chart Modal */}
      {showChart && <SizeChartModal onClose={() => setShowChart(false)} />}
    </div>
  );
}
