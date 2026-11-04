"use client";

import React, { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { FormError, styles as account } from "@/components/account/Account";
import t from "../staff/tools.module.css";
import { rupees, useAction, useLoad } from "./ui";

export type AdminMerchItem = {
  id: string;
  name: string;
  type: string;
  variant: string;
  price: number; // in paise
  imageSrc: string;
  images: string[];
  available: boolean;
  sizes: string[];
  createdAt: string;
};

export type AdminMerchOrder = {
  id: string;
  trackingId: string;
  status: "PENDING" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  totalPaise: number;
  nameToPrint: string;
  studentClass: string;
  schoolName: string;
  contactNo: string;
  paymentNote: string | null;
  isCoordinator: boolean;
  createdAt: string;
  verifiedAt: string | null;
  buyerName: string;
  buyerEmail: string;
  items: {
    name: string;
    type: string;
    size: string;
    quantity: number;
    pricePaise: number;
    nameToPrint?: string;
  }[];
};

export type MerchQr = {
  id: string;
  label: string;
  storagePath: string;
  upiId: string;
  isActive: boolean;
  createdAt: string;
};

const base64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export function MerchAdmin() {
  const [subTab, setSubTab] = useState<"products" | "orders" | "qrs">("products");

  const items = useLoad<AdminMerchItem[]>("/admin/merch/items");
  const orders = useLoad<AdminMerchOrder[]>("/admin/merch/orders");
  const qrs = useLoad<MerchQr[]>("/admin/merch/upi-qrs");
  const act = useAction();

  // Product Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [pName, setPName] = useState("");
  const [pType, setPType] = useState("TSHIRT");
  const [pVariant, setPVariant] = useState("STANDARD");
  const [pPriceRupees, setPPriceRupees] = useState("");
  const [pImageSrc, setPImageSrc] = useState("");
  const [pImages, setPImages] = useState<string[]>([]); // gallery images (URLs)
  const [pSizes, setPSizes] = useState<string[]>(["S", "M", "L", "XL", "XXL"]);
  const [pAvailable, setPAvailable] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // QR Slots state (up to 3 files)
  const [qrSlots, setQrSlots] = useState<
    { file: File | null; preview: string; label: string; upiId: string }[]
  >([{ file: null, preview: "", label: "", upiId: "" }]);

  // Orders filter
  const [orderFilter, setOrderFilter] = useState<"ALL" | "PENDING" | "PAID">("ALL");

  // Reset product form
  function resetProductForm() {
    setEditingId(null);
    setPName("");
    setPType("TSHIRT");
    setPVariant("STANDARD");
    setPPriceRupees("");
    setPImageSrc("");
    setPImages([]);
    setPSizes(["S", "M", "L", "XL", "XXL"]);
    setPAvailable(true);
    setShowProductForm(false);
  }

  // Populate form for editing
  function startEdit(item: AdminMerchItem) {
    setEditingId(item.id);
    setPName(item.name);
    setPType(item.type);
    setPVariant(item.variant);
    setPPriceRupees(String(item.price / 100));
    setPImageSrc(item.imageSrc);
    setPImages(item.images ?? []);
    setPSizes(item.sizes);
    setPAvailable(item.available);
    setShowProductForm(true);
  }

  // Upload a single product image, return URL
  async function uploadOneImage(file: File): Promise<string> {
    const b64 = await base64(file);
    const res = await api<{ ok: boolean; url: string }>("/admin/merch/products/upload", {
      file: b64,
      filename: file.name,
    });
    return res.url;
  }

  // Handle uploading the PRIMARY product image
  async function handleProductImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await uploadOneImage(file);
      setPImageSrc(url);
      // Also add to gallery if not already present
      setPImages((prev) => (prev.includes(url) ? prev : [url, ...prev]));
    } catch (err: unknown) {
      act.setError(err instanceof Error ? err.message : "Failed to upload product image");
    } finally {
      setUploadingImage(false);
    }
  }

  // Handle uploading MULTIPLE gallery images
  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImage(true);
    try {
      const urls = await Promise.all(files.map(uploadOneImage));
      setPImages((prev) => {
        const combined = [...prev];
        for (const url of urls) {
          if (!combined.includes(url)) combined.push(url);
        }
        return combined;
      });
      // If no primary yet, use first uploaded
      setPImageSrc((prev) => prev || urls[0]);
    } catch (err: unknown) {
      act.setError(err instanceof Error ? err.message : "Failed to upload gallery images");
    } finally {
      setUploadingImage(false);
    }
  }

  // Submit product create/update
  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pName.trim()) return act.setError("Product name is required.");
    const priceNum = Math.round(Number(pPriceRupees) * 100);
    if (!priceNum || priceNum <= 0) return act.setError("Enter a valid price in ₹.");
    if (!pImageSrc.trim()) return act.setError("Please upload an image or provide an image URL.");
    if (!pSizes.length) return act.setError("Select at least one size.");

    const payload = {
      name: pName.trim(),
      type: pType.trim(),
      variant: pVariant.trim(),
      price: priceNum,
      imageSrc: pImageSrc.trim(),
      sizes: pSizes,
      available: pAvailable,
      images: pImages.filter(Boolean),
    };

    if (editingId) {
      await act.run(
        () => api(`/admin/merch/items/${editingId}`, payload, "PUT"),
        () => `Product "${pName}" updated successfully.`
      );
    } else {
      await act.run(
        () => api("/admin/merch/items", payload, "POST"),
        () => `Product "${pName}" created successfully.`
      );
    }

    resetProductForm();
    items.reload();
  }

  // Toggle item availability
  async function toggleItemAvailable(item: AdminMerchItem) {
    await act.run(
      () => api(`/admin/merch/items/${item.id}/toggle`, { available: !item.available }, "PATCH"),
      () => `Product "${item.name}" is now ${!item.available ? "Available" : "Unavailable"}.`
    );
    items.reload();
  }

  // Delete product
  async function deleteItem(item: AdminMerchItem) {
    if (!confirm(`Delete product "${item.name}"?`)) return;
    await act.run(
      () => api(`/admin/merch/items/${item.id}`, {}, "DELETE"),
      () => `Product "${item.name}" removed.`
    );
    items.reload();
  }

  // Toggle size in array
  function toggleSize(sz: string) {
    setPSizes((prev) => (prev.includes(sz) ? prev.filter((s) => s !== sz) : [...prev, sz]));
  }

  // Verify payment
  async function verifyPayment(order: AdminMerchOrder) {
    if (
      !confirm(
        `Verify payment of ${rupees(order.totalPaise)} for ${order.buyerName} (${order.trackingId})?\n\nThis marks the order as PAID and sends a verification email.`
      )
    )
      return;

    await act.run(
      () => api(`/admin/merch/orders/${order.id}/verify`, {}),
      () => `Order ${order.trackingId} marked as Payment Verified. Email queued.`
    );
    orders.reload();
  }

  // Update order status (SHIPPED / DELIVERED / CANCELLED)
  async function updateOrderStatus(order: AdminMerchOrder, status: string) {
    await act.run(
      () => api(`/admin/merch/orders/${order.id}/status`, { status }, "PATCH"),
      () => `Order ${order.trackingId} updated to ${status}.`
    );
    orders.reload();
  }

  // Set active QR
  async function setActiveQr(qrId: string, label: string) {
    await act.run(
      () => api(`/admin/merch/upi-qrs/${qrId}/activate`, {}),
      () => `QR "${label}" is now active on the public merch checkout page.`
    );
    qrs.reload();
  }

  // Delete QR
  async function deleteQr(qrId: string, label: string) {
    if (!confirm(`Delete QR code "${label}"?`)) return;
    await act.run(
      () => api(`/admin/merch/upi-qrs/${qrId}`, {}, "DELETE"),
      () => `QR "${label}" removed.`
    );
    qrs.reload();
  }

  // QR Multi-file selection
  function handleQrFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (!files.length) return;

    const newSlots = files.map((file, i) => ({
      file,
      preview: URL.createObjectURL(file),
      label: qrSlots[i]?.label || `UPI QR ${i + 1}`,
      upiId: qrSlots[i]?.upiId || "avantra@upi",
    }));

    setQrSlots(newSlots);
  }

  function addQrSlot() {
    if (qrSlots.length >= 3) return;
    setQrSlots((prev) => [...prev, { file: null, preview: "", label: "", upiId: "" }]);
  }

  function updateSlot(index: number, field: "label" | "upiId", value: string) {
    setQrSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleQrSubmit(e: React.FormEvent) {
    e.preventDefault();
    const readyItems: { file: string; filename: string; label: string; upiId: string }[] = [];
    for (let i = 0; i < qrSlots.length; i++) {
      const slot = qrSlots[i];
      if (!slot.file) continue;
      if (!slot.label.trim()) return act.setError(`Please provide a label for QR #${i + 1}`);
      if (!slot.upiId.trim()) return act.setError(`Please provide a UPI ID for QR #${i + 1}`);
      const b64 = await base64(slot.file);
      readyItems.push({
        file: b64,
        filename: slot.file.name,
        label: slot.label.trim(),
        upiId: slot.upiId.trim(),
      });
    }

    if (!readyItems.length) return act.setError("Please select at least one QR image file to upload.");

    const res = await act.run(
      () => api<{ ok: boolean; uploaded: unknown[] }>("/admin/merch/upi-qrs", { items: readyItems }),
      (r) => `${r.uploaded.length} QR code(s) uploaded successfully.`
    );

    if (res) {
      setQrSlots([{ file: null, preview: "", label: "", upiId: "" }]);
      qrs.reload();
    }
  }

  const allOrders = orders.data || [];
  const filteredOrders = allOrders.filter((o) => {
    if (orderFilter === "PENDING") return o.status === "PENDING";
    if (orderFilter === "PAID") return o.status === "PAID";
    return true;
  });

  const totalPaise = allOrders.reduce((sum, o) => (o.status === "PAID" ? sum + o.totalPaise : sum), 0);
  const pendingCount = allOrders.filter((o) => o.status === "PENDING").length;
  const paidCount = allOrders.filter((o) => o.status === "PAID").length;
  const activeQrCount = qrs.data?.length ?? 0;
  const productCount = items.data?.length ?? 0;

  return (
    <>
      {/* Top Stats Overview */}
      <section className={t.panel} aria-labelledby="merch-overview">
        <h2 id="merch-overview">Merchandise Overview</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className={t.mute}>Live Products</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f4ead9", marginTop: "0.2rem" }}>
              {productCount}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", padding: "1rem", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className={t.mute}>Total Orders</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#f4ead9", marginTop: "0.2rem" }}>
              {allOrders.length}
            </div>
          </div>
          <div style={{ background: "rgba(234,179,8,0.08)", padding: "1rem", borderRadius: 12, border: "1px solid rgba(234,179,8,0.2)" }}>
            <span style={{ color: "#facc15" }}>Pending Payment</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#facc15", marginTop: "0.2rem" }}>
              {pendingCount}
            </div>
          </div>
          <div style={{ background: "rgba(34,197,94,0.08)", padding: "1rem", borderRadius: 12, border: "1px solid rgba(34,197,94,0.2)" }}>
            <span style={{ color: "#4ade80" }}>Verified Paid</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#4ade80", marginTop: "0.2rem" }}>
              {paidCount}
            </div>
          </div>
          <div style={{ background: "rgba(159,212,255,0.08)", padding: "1rem", borderRadius: 12, border: "1px solid rgba(159,212,255,0.2)" }}>
            <span style={{ color: "#9fd4ff" }}>Verified Revenue</span>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#9fd4ff", marginTop: "0.2rem" }}>
              {rupees(totalPaise)}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem", overflowX: "auto", flexWrap: "nowrap" }}>
          <button
            type="button"
            className={subTab === "products" ? t.btn : t.ghost}
            onClick={() => setSubTab("products")}
            style={{ whiteSpace: "nowrap" }}
          >
            👕 Products ({productCount})
          </button>
          <button
            type="button"
            className={subTab === "orders" ? t.btn : t.ghost}
            onClick={() => setSubTab("orders")}
            style={{ whiteSpace: "nowrap" }}
          >
            📦 Orders ({allOrders.length})
          </button>
          <button
            type="button"
            className={subTab === "qrs" ? t.btn : t.ghost}
            onClick={() => setSubTab("qrs")}
            style={{ whiteSpace: "nowrap" }}
          >
            💳 UPI QR Codes ({activeQrCount}/3)
          </button>
        </div>
      </section>

      <FormError message={act.error || items.error || orders.error || qrs.error} />
      {act.note && <p role="status">{act.note}</p>}

      {/* ======================================================== */}
      {/* 1. PRODUCTS MANAGEMENT SUB-TAB */}
      {/* ======================================================== */}
      {subTab === "products" && (
        <section className={t.panel} aria-labelledby="merch-products">
          <div className={t.panelHead}>
            <div>
              <h2 id="merch-products">Manage Products</h2>
              <p className={t.mute} style={{ margin: "4px 0 0" }}>
                Add new merchandise items, adjust pricing, toggle availability, and configure sizing.
              </p>
            </div>
            <div className={t.inline}>
              <button
                type="button"
                className={t.btn}
                onClick={() => {
                  if (showProductForm && !editingId) {
                    setShowProductForm(false);
                  } else {
                    resetProductForm();
                    setShowProductForm(true);
                  }
                }}
              >
                {showProductForm && !editingId ? "Cancel" : "+ Add Product"}
              </button>
              <button type="button" className={t.ghost} onClick={items.reload}>
                Refresh
              </button>
            </div>
          </div>

          {/* Add / Edit Product Form */}
          {showProductForm && (
            <form
              onSubmit={handleProductSubmit}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1.5px solid rgba(159,212,255,0.25)",
                borderRadius: 14,
                padding: "1.5rem",
                margin: "1.5rem 0",
              }}
            >
              <h3 style={{ fontSize: "1.1rem", margin: "0 0 1rem", color: "#9fd4ff" }}>
                {editingId ? "Edit Product" : "Add New Merchandise Product"}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                {/* Product Name */}
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)", display: "block", marginBottom: 4 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. T-Shirt — Blue"
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.8rem",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f4ead9",
                    }}
                  />
                </div>

                {/* Type */}
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)", display: "block", marginBottom: 4 }}>
                    Type / Category *
                  </label>
                  <select
                    value={pType}
                    onChange={(e) => setPType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.8rem",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f4ead9",
                      colorScheme: "dark",
                    }}
                  >
                    <option value="TSHIRT">T-Shirt</option>
                    <option value="ZIPPER">Zipper / Hoodie</option>
                    <option value="HOODIE">Hoodie</option>
                    <option value="CAP">Cap</option>
                    <option value="BADGE">Badge / Accessory</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* Variant */}
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)", display: "block", marginBottom: 4 }}>
                    Variant / Edition
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BLUE, RED_GIRLS, RED_BOYS"
                    value={pVariant}
                    onChange={(e) => setPVariant(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.8rem",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f4ead9",
                    }}
                  />
                </div>

                {/* Price in Rupees */}
                <div>
                  <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)", display: "block", marginBottom: 4 }}>
                    Price in ₹ *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 599"
                    value={pPriceRupees}
                    onChange={(e) => setPPriceRupees(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.8rem",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f4ead9",
                    }}
                  />
                </div>
              </div>

              {/* ── Primary Image ── */}
              <div style={{ marginTop: "1rem" }}>
                <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)", display: "block", marginBottom: 4 }}>
                  Primary / Thumbnail Image * (shown on product card)
                </label>
                <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    required
                    placeholder="URL or upload below"
                    value={pImageSrc}
                    onChange={(e) => setPImageSrc(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 220,
                      padding: "0.55rem 0.8rem",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8,
                      color: "#f4ead9",
                    }}
                  />
                  <label className={t.ghost} style={{ cursor: "pointer", whiteSpace: "nowrap" }}>
                    {uploadingImage ? "Uploading…" : "📁 Upload Primary"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProductImageUpload}
                      disabled={uploadingImage || act.busy}
                      hidden
                    />
                  </label>
                </div>
                {pImageSrc && (
                  <div style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pImageSrc}
                      alt="Primary preview"
                      width={60}
                      height={60}
                      style={{ borderRadius: 6, objectFit: "contain", background: "#1a1310", border: "1px solid rgba(255,255,255,0.1)" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className={t.mute} style={{ fontSize: "0.8rem" }}>Primary image preview</span>
                  </div>
                )}
              </div>

              {/* ── Gallery / Extra Photos ── */}
              <div style={{ marginTop: "1.2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)" }}>
                    Gallery Photos ({pImages.length}) — shown on product detail page
                  </label>
                  <label
                    className={t.ghost}
                    style={{ cursor: uploadingImage ? "not-allowed" : "pointer", fontSize: "0.8rem", padding: "0.3rem 0.7rem", opacity: uploadingImage ? 0.5 : 1 }}
                  >
                    {uploadingImage ? "Uploading…" : "+ Add Photos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryUpload}
                      disabled={uploadingImage || act.busy}
                      hidden
                    />
                  </label>
                </div>

                {pImages.length > 0 ? (
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    {pImages.map((url, idx) => (
                      <div
                        key={url}
                        style={{
                          position: "relative",
                          width: 72,
                          height: 72,
                          borderRadius: 8,
                          overflow: "hidden",
                          border: url === pImageSrc
                            ? "2px solid #9fd4ff"
                            : "1.5px solid rgba(255,255,255,0.1)",
                          background: "#fff",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                        title={url === pImageSrc ? "Primary image" : "Click to set as primary"}
                        onClick={() => setPImageSrc(url)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Gallery ${idx + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }}
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                        />
                        {/* Primary badge */}
                        {url === pImageSrc && (
                          <span style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            background: "rgba(159,212,255,0.9)", color: "#0a0a0a",
                            fontSize: "0.6rem", fontWeight: 800, textAlign: "center", padding: "2px 0",
                          }}>
                            PRIMARY
                          </span>
                        )}
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPImages((prev) => prev.filter((_, i) => i !== idx));
                            // if removing primary, pick next
                            if (url === pImageSrc) {
                              const next = pImages.find((u, i) => i !== idx);
                              setPImageSrc(next ?? "");
                            }
                          }}
                          style={{
                            position: "absolute", top: 2, right: 2,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "rgba(179,18,30,0.9)", border: "none",
                            color: "#fff", fontSize: "0.65rem", cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            lineHeight: 1,
                          }}
                          aria-label="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: "0.78rem", color: "rgba(244,234,217,0.35)", margin: "0.3rem 0" }}>
                    No gallery photos yet — upload using &quot;+ Add Photos&quot; above. Click any thumbnail to set it as primary.
                  </p>
                )}
              </div>

              {/* Sizes Selection */}
              <div style={{ marginTop: "1rem" }}>
                <label style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.7)", display: "block", marginBottom: 6 }}>
                  Available Sizes *
                </label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {DEFAULT_SIZES.map((sz) => {
                    const active = pSizes.includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => toggleSize(sz)}
                        style={{
                          padding: "0.35rem 0.8rem",
                          borderRadius: 8,
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          background: active ? "#b3121e" : "rgba(255,255,255,0.06)",
                          color: active ? "#fff" : "rgba(244,234,217,0.7)",
                          border: active ? "1px solid #9fd4ff" : "1px solid rgba(255,255,255,0.12)",
                        }}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Availability checkbox */}
              <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <input
                  type="checkbox"
                  id="pAvail"
                  checked={pAvailable}
                  onChange={(e) => setPAvailable(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#9fd4ff" }}
                />
                <label htmlFor="pAvail" style={{ fontSize: "0.9rem", color: "#f4ead9", cursor: "pointer" }}>
                  Available for purchase on website immediately
                </label>
              </div>

              {/* Form Buttons */}
              <div className={t.inline} style={{ marginTop: "1.2rem" }}>
                <button type="submit" className={t.btn} disabled={act.busy || uploadingImage}>
                  {act.busy ? "Saving…" : editingId ? "Update Product" : "Save Product"}
                </button>
                <button type="button" className={t.ghost} onClick={resetProductForm}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Product List */}
          {!items.data ? (
            <p className={t.mute} role="status">Loading products…</p>
          ) : items.data.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
              <p className={t.mute} style={{ marginBottom: "1rem" }}>
                No products in the store yet. Add your first merchandise product using the button above!
              </p>
              <button
                type="button"
                className={t.btn}
                onClick={() => {
                  resetProductForm();
                  setShowProductForm(true);
                }}
              >
                + Add First Product
              </button>
            </div>
          ) : (
            <div className={t.scroll}>
              <table className={`${t.table} ${t.stack}`}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type / Variant</th>
                    <th className={t.num}>Price</th>
                    <th>Sizes</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.data.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item">
                        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageSrc}
                            alt={item.name}
                            width={50}
                            height={50}
                            style={{ borderRadius: 6, objectFit: "contain", background: "#1a1310", padding: 3, border: "1px solid rgba(255,255,255,0.1)" }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div>
                            <strong>{item.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td data-label="Type / Variant">
                        <span className={t.mute}>{item.type}</span> · <span className={t.mono}>{item.variant}</span>
                      </td>
                      <td className={t.num} data-label="Price">
                        <strong style={{ color: "#9fd4ff" }}>{rupees(item.price)}</strong>
                      </td>
                      <td data-label="Sizes">
                        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                          {item.sizes.map((sz) => (
                            <span key={sz} style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4 }}>
                              {sz}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td data-label="Status">
                        <span className={t.status} data-tone={item.available ? "ok" : undefined}>
                          {item.available ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className={t.inline} style={{ gap: 6 }}>
                          <button
                            type="button"
                            className={t.ghost}
                            style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
                            onClick={() => toggleItemAvailable(item)}
                            disabled={act.busy}
                          >
                            {item.available ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            className={t.ghost}
                            style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
                            onClick={() => startEdit(item)}
                            disabled={act.busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={t.ghost}
                            style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem", color: "#f87171" }}
                            onClick={() => deleteItem(item)}
                            disabled={act.busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* 2. ORDERS MANAGEMENT SUB-TAB */}
      {/* ======================================================== */}
      {subTab === "orders" && (
        <section className={t.panel} aria-labelledby="merch-orders-table">
          <div className={t.panelHead}>
            <h2 id="merch-orders-table">Merchandise Orders ({filteredOrders.length})</h2>
            <div className={t.inline}>
              <div className={t.inline} style={{ gap: 4 }}>
                {(["ALL", "PENDING", "PAID"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={orderFilter === k ? t.btn : t.ghost}
                    style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={() => setOrderFilter(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
              <button type="button" className={t.ghost} onClick={orders.reload}>
                Refresh
              </button>
            </div>
          </div>

          {!orders.data ? (
            <p className={t.mute} role="status">Loading orders…</p>
          ) : filteredOrders.length === 0 ? (
            <p className={t.mute}>No orders found under {orderFilter.toLowerCase()}.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {filteredOrders.map((o) => (
                <div
                  key={o.id}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: o.status === "PENDING"
                      ? "1.5px solid rgba(234,179,8,0.3)"
                      : o.status === "PAID"
                      ? "1.5px solid rgba(34,197,94,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: "1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {/* Card Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.6rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
                      <Link
                        href={`/merch/track/${o.trackingId}`}
                        target="_blank"
                        style={{ color: "#9fd4ff", fontWeight: 700, fontFamily: "monospace", fontSize: "1.05rem", textDecoration: "underline" }}
                      >
                        {o.trackingId}
                      </Link>
                      <span className={t.mute} style={{ fontSize: "0.8rem" }}>
                        {new Date(o.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {o.isCoordinator && (
                        <span className={t.status} data-tone="warn">
                          Coordinator
                        </span>
                      )}
                      <span
                        className={t.status}
                        data-tone={
                          o.status === "DELIVERED" || o.status === "PAID"
                            ? "ok"
                            : o.status === "SHIPPED"
                            ? "info"
                            : o.status === "PENDING"
                            ? "warn"
                            : "danger"
                        }
                      >
                        {o.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Body Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                    {/* Student Info */}
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(244,234,217,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                        Buyer &amp; School
                      </div>
                      <strong style={{ fontSize: "1rem", color: "#f4ead9" }}>{o.buyerName}</strong>
                      <div style={{ fontSize: "0.85rem", color: "rgba(244,234,217,0.8)", marginTop: 2 }}>
                        {o.schoolName} · Class <strong>{o.studentClass}</strong>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "rgba(244,234,217,0.6)", marginTop: 3 }}>
                        📞 <a href={`tel:${o.contactNo}`} style={{ color: "#9fd4ff", textDecoration: "none" }}>{o.contactNo}</a> · {o.buyerEmail}
                      </div>
                    </div>

                    {/* Custom Print Name */}
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(244,234,217,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        Custom Name to Print
                      </div>
                      <div style={{
                        display: "inline-block",
                        background: "rgba(159,212,255,0.09)",
                        border: "1.5px solid rgba(159,212,255,0.3)",
                        borderRadius: 8,
                        padding: "0.35rem 0.8rem",
                      }}>
                        <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f4ead9", letterSpacing: "0.08em" }}>
                          {o.nameToPrint}
                        </span>
                      </div>
                      {o.paymentNote && (
                        <div style={{ fontSize: "0.8rem", color: "rgba(244,234,217,0.6)", marginTop: 6 }}>
                          UTR / Ref: <code style={{ color: "#9fd4ff" }}>{o.paymentNote}</code>
                        </div>
                      )}
                    </div>

                    {/* Order Items */}
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "rgba(244,234,217,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                        Ordered Items
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {o.items.map((it, idx) => (
                          <div key={idx} style={{ fontSize: "0.88rem", display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                            <span>{it.name} (<strong style={{ color: "#9fd4ff" }}>{it.size}</strong>{it.nameToPrint && ` · ${it.nameToPrint}`}) × {it.quantity}</span>
                            <span style={{ color: "rgba(244,234,217,0.7)" }}>{rupees(it.pricePaise * it.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Total & Actions */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.8rem", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "0.75rem", marginTop: "auto" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                      <span className={t.mute} style={{ fontSize: "0.85rem" }}>Total:</span>
                      <strong style={{ fontSize: "1.25rem", color: "#9fd4ff" }}>{rupees(o.totalPaise)}</strong>
                    </div>

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {o.status === "PENDING" && (
                        <button
                          type="button"
                          className={t.btn}
                          disabled={act.busy}
                          onClick={() => verifyPayment(o)}
                          style={{ fontSize: "0.85rem", padding: "0.45rem 1rem" }}
                        >
                          ✓ Verify Payment
                        </button>
                      )}
                      {o.status === "PAID" && (
                        <button
                          type="button"
                          className={t.ghost}
                          disabled={act.busy}
                          onClick={() => updateOrderStatus(o, "SHIPPED")}
                          style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
                        >
                          Mark Shipped →
                        </button>
                      )}
                      {o.status === "SHIPPED" && (
                        <button
                          type="button"
                          className={t.ghost}
                          disabled={act.busy}
                          onClick={() => updateOrderStatus(o, "DELIVERED")}
                          style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
                        >
                          Mark Delivered ✓
                        </button>
                      )}
                      {o.status === "DELIVERED" && (
                        <span className={t.status} data-tone="ok" style={{ fontSize: "0.8rem" }}>
                          Completed ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* 3. UPI QR CODES SUB-TAB */}
      {/* ======================================================== */}
      {subTab === "qrs" && (
        <section className={t.panel} aria-labelledby="merch-qr">
          <div className={t.panelHead}>
            <div>
              <h2 id="merch-qr">UPI QR Codes (Max 3)</h2>
              <p className={t.mute} style={{ margin: "4px 0 0" }}>
                Upload up to 3 QR photos at once. Choose which one is active — only the selected QR appears on the public merch checkout page.
              </p>
            </div>
            <button type="button" className={t.ghost} onClick={qrs.reload}>
              Refresh QRs
            </button>
          </div>

          {/* Existing QRs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", margin: "1.5rem 0" }}>
            {qrs.data?.map((qr) => (
              <div
                key={qr.id}
                style={{
                  background: qr.isActive ? "rgba(159,212,255,0.08)" : "rgba(255,255,255,0.03)",
                  border: qr.isActive ? "2px solid #9fd4ff" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 14,
                  padding: "1.2rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.8rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{qr.label}</strong>
                  {qr.isActive ? (
                    <span className={t.status} data-tone="ok">
                      ACTIVE (Shown on Site)
                    </span>
                  ) : (
                    <span className={t.status}>Inactive</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/merch-upi-qrs/${qr.storagePath}`}
                    alt={qr.label}
                    width={90}
                    height={90}
                    style={{ borderRadius: 8, background: "#fff", objectFit: "contain", padding: 4 }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div>
                    <span className={t.mute} style={{ fontSize: "0.75rem" }}>UPI ID:</span>
                    <div className={t.mono} style={{ fontSize: "0.95rem", color: "#9fd4ff", fontWeight: 700 }}>
                      {qr.upiId}
                    </div>
                  </div>
                </div>

                <div className={t.inline} style={{ marginTop: "auto" }}>
                  {!qr.isActive && (
                    <button
                      type="button"
                      className={t.btn}
                      disabled={act.busy}
                      onClick={() => setActiveQr(qr.id, qr.label)}
                      style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem" }}
                    >
                      Select as Active QR
                    </button>
                  )}
                  <button
                    type="button"
                    className={t.ghost}
                    disabled={act.busy}
                    onClick={() => deleteQr(qr.id, qr.label)}
                    style={{ fontSize: "0.82rem", padding: "0.4rem 0.8rem", color: "#f87171" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {(!qrs.data || qrs.data.length === 0) && (
              <p className={t.mute}>No QR codes uploaded yet. Upload below to accept merch payments.</p>
            )}
          </div>

          {/* Upload up to 3 QRs form */}
          {(!qrs.data || qrs.data.length < 3) && (
            <form
              onSubmit={handleQrSubmit}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1.5px dashed rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: "1.4rem",
                marginTop: "1.5rem",
              }}
            >
              <h3 style={{ fontSize: "1.05rem", margin: "0 0 0.5rem", color: "#f4ead9" }}>
                Add UPI QR Photos (Up to 3 at once)
              </h3>
              <p className={t.mute} style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
                Select 1 to 3 images. You can configure individual labels and UPI IDs for each.
              </p>

              <div style={{ marginBottom: "1rem" }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleQrFilesChange}
                  disabled={act.busy}
                  style={{
                    display: "block",
                    padding: "0.5rem",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    width: "100%",
                    color: "#f4ead9",
                  }}
                />
              </div>

              {/* Slots inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.2rem" }}>
                {qrSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: slot.preview ? "80px 1fr 1fr" : "1fr 1fr",
                      gap: "0.8rem",
                      alignItems: "center",
                      background: "rgba(255,255,255,0.03)",
                      padding: "0.8rem",
                      borderRadius: 8,
                    }}
                  >
                    {slot.preview && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slot.preview} alt={`Preview ${idx + 1}`} width={70} height={70} style={{ borderRadius: 6, objectFit: "contain" }} />
                    )}
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "rgba(244,234,217,0.6)", display: "block", marginBottom: 4 }}>
                        Label #{idx + 1}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SBI Main QR"
                        value={slot.label}
                        onChange={(e) => updateSlot(idx, "label", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.7rem",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 6,
                          color: "#f4ead9",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "rgba(244,234,217,0.6)", display: "block", marginBottom: 4 }}>
                        UPI ID / Code #{idx + 1}
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. avantra@upi"
                        value={slot.upiId}
                        onChange={(e) => updateSlot(idx, "upiId", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.7rem",
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 6,
                          color: "#f4ead9",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className={t.inline}>
                <button type="submit" className={t.btn} disabled={act.busy || !qrSlots.some((s) => s.file)}>
                  {act.busy ? "Uploading QRs…" : "Upload & Save UPI QRs"}
                </button>
                {qrSlots.length < 3 && (
                  <button type="button" className={t.ghost} onClick={addQrSlot}>
                    + Add another slot
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}
    </>
  );
}
