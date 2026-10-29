// Admin CSV exports: /admin/export/students.csv, registrations.csv (?eventId=), payments.csv, wall.csv, wall-chits.csv.
import { adminRpc, answer, csvFile, toCsv } from "@/lib/server/admin";

type Row = Record<string, unknown>;

const FILES: Record<string, { kind: string; name: string; columns: string[]; map?: (r: Row) => Row }> = {
  "students.csv": {
    kind: "students",
    name: "students",
    columns: ["avantraId", "name", "email", "phone", "grade", "school", "referralCode", "guardianPhone", "guardianEmail", "feePaidAt", "paidBy", "paymentRef", "checkIns", "signedUpAt"],
  },
  "registrations.csv": {
    kind: "registrations",
    name: "registrations",
    columns: ["event", "avantraId", "name", "grade", "school", "team", "teamLeader", "projectTitle", "topic", "rank", "certificateCode", "registeredAt"],
  },
  "payments.csv": {
    kind: "payments",
    name: "payments",
    columns: ["createdAt", "avantraId", "name", "amountRupees", "method", "status", "razorpayOrderId", "razorpayPaymentId", "utr", "recordedBy", "note"],
  },
  "wall.csv": {
    kind: "wall",
    name: "wall-leaderboard",
    columns: ["rank", "avantraId", "name", "grade", "section", "school", "points", "solved", "lastSolvedAt"],
  },
  // For printing chits by mail merge: one row per active challenge, no answers.
  "wall-chits.csv": {
    kind: "chits",
    name: "wall-chits",
    columns: ["number", "code", "category", "difficulty", "points", "question", "options"],
    map: (c) => ({ ...c, options: (c.options as string[]).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("   ") }),
  },
};

export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const f = FILES[(await params).file];
  if (!f) return new Response("Not found", { status: 404 });
  return answer(async () => {
    const rows = await adminRpc<Row[]>("admin_export", { p_kind: f.kind, p_event_id: new URL(req.url).searchParams.get("eventId") });
    return csvFile(f.name, toCsv(f.columns, f.map ? rows.map(f.map) : rows));
  });
}
