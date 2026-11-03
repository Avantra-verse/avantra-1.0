import { createClient } from "@supabase/supabase-js";
import { AdminError, answer, requireAdmin } from "@/lib/server/admin";

function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export function POST(req: Request) {
  return answer(async () => {
    await requireAdmin();
    const body = await req.json().catch(() => null);
    if (!body || !body.file) throw new AdminError(400, "Image file is required");

    const sb = storageClient();
    const bucket = "merch-products";

    try {
      const { data: buckets } = await sb.storage.listBuckets();
      if (!buckets?.some((b) => b.name === bucket)) {
        await sb.storage.createBucket(bucket, { public: true });
      }
    } catch {
      // ignore bucket error if already exists
    }

    const buffer = Buffer.from(body.file, "base64");
    const ext = body.filename?.split(".").pop() || "png";
    const filename = `product_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await sb.storage.from(bucket).upload(filename, buffer, {
      contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png",
      upsert: true,
    });

    if (uploadErr) {
      throw new AdminError(500, `Failed to upload image: ${uploadErr.message}`);
    }

    const { data: publicUrlData } = sb.storage.from(bucket).getPublicUrl(filename);
    return Response.json({ ok: true, url: publicUrlData.publicUrl });
  });
}

