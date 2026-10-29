// The certificate as a PDF, linked from the public verify page (/verify/CODE).
import { renderCertificate } from "@/lib/server/certificate";
import { publicRpc } from "@/lib/server/rpc";

type Certificate = { code: string; name: string; school: string | null; event: string; rank: number | null };

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = await publicRpc<Certificate>("certificate", { p_code: (await params).code });
  if (!c) return new Response("No certificate with this ID", { status: 404 });
  const bytes = await renderCertificate({ ...c, verifyUrl: `${new URL(req.url).origin}/verify/${c.code}` });
  return new Response(Buffer.from(bytes), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="AVANTRA-2026-${c.code}.pdf"` },
  });
}
