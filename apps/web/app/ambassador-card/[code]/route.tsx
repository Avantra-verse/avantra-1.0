// An ambassador's share card as a PNG, linked and shown from the ambassador email:
// /ambassador-card/PRI7K4.png?name=Priya%20Sharma&school=DPS%20Rourkela. Story / status size (1080×1920):
// an "Ambassador Pass" ticket in the ARITHI brand palette (arithi.in/brand-assets), AVANTRA logo unmodified.
// Everything sits inside y 250–1670 because Instagram covers the top and bottom 250 px.
// /ambassador-card/preview.png is the teaser the email shows: blank fields, hidden code, "Tap to open yours".
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import QRCode from "qrcode";

const PLUM = "#2A1A1E";
const SAGE = "#CDECD3";
const CREAM = "#FDFBF2";
const BLUSH = "#FDE2E4";
const PEACH = "#FCD5CE";

const file = (path: string) => readFile(join(process.cwd(), path));
const png = async (path: string) => `data:image/png;base64,${(await file(path)).toString("base64")}`;
const [bold, semibold, avantra] = await Promise.all([
  file("assets/fonts/BricolageGrotesque-800.ttf"),
  file("assets/fonts/BricolageGrotesque-600.ttf"),
  png("public/brand/avantra-logo-500w.png"),
]);

// Letters, digits and simple punctuation only (names come from a URL anyone can edit), trimmed to fit.
const clean = (s: string | null, max: number) => (s ?? "").replace(/[^\p{L}\p{M}\p{N} .,'&()-]/gu, "").replace(/\s+/g, " ").trim().slice(0, max);

// Small four-point sparkles scattered over the plum background: [x, y, size, colour].
const STARS: [number, number, number, string][] = [
  [110, 300, 34, SAGE], [960, 360, 26, PEACH], [70, 900, 22, PEACH], [1010, 1000, 34, SAGE],
  [150, 1560, 28, SAGE], [930, 1620, 22, PEACH], [520, 205, 18, BLUSH], [1000, 1380, 18, BLUSH],
];

const sparkle = (x: number, y: number, s: number, c: string) => (
  <svg key={`${x}-${y}`} width={s} height={s} viewBox="0 0 24 24" style={{ position: "absolute", left: x - s / 2, top: y - s / 2 }}>
    <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill={c} />
  </svg>
);

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.replace(/\.png$/i, "").toUpperCase();
  const teaser = code === "PREVIEW";
  if (!teaser && !/^[A-Z0-9]{6}$/.test(code)) return new Response("Not found", { status: 404 });
  const query = new URL(request.url).searchParams;
  const name = clean(query.get("name"), 28);
  const school = clean(query.get("school"), 48);
  const link = `https://avantra.arithi.in/registration?ref=${code}`;
  const qr = teaser ? "" : await QRCode.toDataURL(link, { width: 230, margin: 1, color: { dark: PLUM, light: CREAM } });
  const notch = { position: "absolute" as const, top: -34, width: 68, height: 68, borderRadius: 34, background: PLUM, border: `6px solid ${PLUM}` };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PLUM, color: CREAM, fontFamily: "Bricolage", position: "relative" }}>
        {/* ARITHI's orbit rings and a few sparkles */}
        <div style={{ position: "absolute", top: -140, right: -300, width: 820, height: 320, border: `5px solid ${SAGE}`, borderRadius: "50%", transform: "rotate(-24deg)", opacity: 0.4 }} />
        <div style={{ position: "absolute", bottom: -120, left: -320, width: 840, height: 320, border: `5px solid ${PEACH}`, borderRadius: "50%", transform: "rotate(-24deg)", opacity: 0.4 }} />
        {STARS.map(([x, y, s, c]) => sparkle(x, y, s, c))}

        {/* Instagram's safe area */}
        <div style={{ position: "absolute", top: 250, bottom: 250, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src={avantra} width={440} height={292} />
            <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: 3, color: SAGE, marginTop: 8 }}>Science &amp; Technology Fest</span>
          </div>

          {/* The pass: chunky cream ticket, hard peach shadow */}
          <div style={{ display: "flex", flexDirection: "column", position: "relative", width: 900, background: CREAM, color: PLUM, border: `8px solid ${CREAM}`, borderRadius: 44, boxShadow: `20px 20px 0 ${PEACH}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: SAGE, borderRadius: "36px 36px 0 0", padding: "30px 48px" }}>
              <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: 5 }}>AMBASSADOR PASS</span>
              <span style={{ fontSize: 38, fontWeight: 800 }}>2026</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", padding: "58px 48px 62px 48px" }}>
              <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: 3 }}>SCHOOL AMBASSADOR</span>
              {teaser ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 116, fontWeight: 800, lineHeight: 1.02, marginTop: 10, opacity: 0.22 }}>Your name</span>
                  <div style={{ display: "flex", marginTop: 24 }}>
                    <span style={{ fontSize: 34, fontWeight: 800, border: `4px dashed ${PLUM}`, borderRadius: 999, padding: "10px 28px", opacity: 0.35 }}>Your school</span>
                  </div>
                </div>
              ) : (
                <span style={{ fontSize: name.length > 16 ? 92 : 116, fontWeight: 800, lineHeight: 1.02, marginTop: 10 }}>{name || "Your Ambassador"}</span>
              )}
              {!teaser && school && (
                <div style={{ display: "flex", marginTop: 24 }}>
                  <span style={{ fontSize: 34, fontWeight: 800, background: PEACH, border: `4px solid ${PLUM}`, borderRadius: 999, padding: "10px 28px" }}>{school}</span>
                </div>
              )}
            </div>

            {/* Tear-off line with a notch on each side */}
            <div style={{ display: "flex", position: "relative", height: 0, borderTop: `5px dashed ${PLUM}`, margin: "0 40px" }}>
              <div style={{ ...notch, left: -84 }} />
              <div style={{ ...notch, right: -84 }} />
            </div>

            {/* Stub: the code and its QR */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "50px 48px 54px 48px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 32, fontWeight: 600 }}>Register with my code</span>
                <span style={{ fontSize: 112, fontWeight: 800, letterSpacing: teaser ? 14 : 4, lineHeight: 1.1 }}>{teaser ? "••••••" : code}</span>
                <span style={{ fontSize: 26, fontWeight: 600 }}>avantra.arithi.in/registration</span>
              </div>
              {teaser ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 230, height: 230, border: `6px dashed ${PLUM}`, borderRadius: 20, fontSize: 130, fontWeight: 800, opacity: 0.35 }}>?</div>
              ) : (
                <img src={qr} width={230} height={230} style={{ border: `6px solid ${PLUM}`, borderRadius: 20 }} />
              )}
            </div>

            {/* Teaser sticker across the pass */}
            {teaser && (
              <div style={{ position: "absolute", top: 300, left: 120, display: "flex", background: PEACH, color: PLUM, border: `7px solid ${PLUM}`, borderRadius: 28, boxShadow: `12px 12px 0 ${PLUM}`, padding: "26px 44px", transform: "rotate(-7deg)", fontSize: 58, fontWeight: 800, letterSpacing: 2 }}>
                TAP TO OPEN YOURS
              </div>
            )}
          </div>

          {/* When and where */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 52, fontWeight: 800 }}>Join me · 19–20 December 2026</span>
            <span style={{ fontSize: 36, fontWeight: 600, marginTop: 10, color: SAGE }}>SSRVM IEMS, Rourkela · @avantra.verse</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
      fonts: [
        { name: "Bricolage", data: bold, weight: 800, style: "normal" },
        { name: "Bricolage", data: semibold, weight: 600, style: "normal" },
      ],
      // The same address always gives the same card, so browsers and Vercel's CDN can keep it.
      headers: { "cache-control": "public, max-age=31536000, immutable", "content-disposition": `inline; filename="avantra-ambassador-${code}.png"` },
    },
  );
}
