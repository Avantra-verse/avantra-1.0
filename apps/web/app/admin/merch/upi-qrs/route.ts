import { createClient } from "@supabase/supabase-js";
import { AdminError, adminRpc, answer, requireAdmin } from "@/lib/server/admin";

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export function POST(req: Request) {
  return answer(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    if (!body) throw new AdminError(400, "Invalid JSON body");

    // Can be an array of up to 3 QRs, or a single QR object
    const items: { label: string; upiId: string; file: string; filename?: string }[] = Array.isArray(body.items)
      ? body.items
      : [body];

    if (!items.length) throw new AdminError(400, "No QR items provided");
    if (items.length > 3) throw new AdminError(400, "Maximum 3 QR codes can be uploaded at once");

    const sb = storageClient();
    const bucket = "merch-upi-qrs";

    // Ensure bucket exists
    try {
      const { data: buckets } = await sb.storage.listBuckets();
      if (!buckets?.some((b) => b.name === bucket)) {
        await sb.storage.createBucket(bucket, { public: true });
      }
    } catch {
      // ignore bucket creation error if already exists
    }

    const results: { id?: string; storagePath: string; label: string; upiId: string }[] = [];

    for (const item of items) {
      if (!item.label?.trim()) throw new AdminError(400, "Label is required for each QR");
      if (!item.upiId?.trim()) throw new AdminError(400, "UPI ID is required for each QR");
      if (!item.file) throw new AdminError(400, "QR image file is required");

      const buffer = Buffer.from(item.file, "base64");
      const ext = item.filename?.split(".").pop() || "png";
      const storagePath = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await sb.storage.from(bucket).upload(storagePath, buffer, {
        contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
        upsert: true,
      });

      if (uploadErr) {
        throw new AdminError(500, `Failed to upload image: ${uploadErr.message}`);
      }

      // Add record to MerchUpiQr table via admin RPC
      const res = await adminRpc<{ id: string }>("admin_merch_add_qr", {
        p_label: item.label.trim(),
        p_storage_path: storagePath,
        p_upi_id: item.upiId.trim(),
      });

      results.push({ ...res, storagePath, label: item.label, upiId: item.upiId });
    }

    return Response.json({ ok: true, uploaded: results });
  });
}

