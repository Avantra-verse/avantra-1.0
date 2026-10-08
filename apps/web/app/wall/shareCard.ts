// Instagram Story / WhatsApp Status card for a Wall score, drawn in the browser (spec: docs/api.md, "Share card").
// 1080×1920. Everything sits inside y 250–1670 because Instagram covers the top and bottom 250 px.
import QRCode from "qrcode";
import type { WallMe } from "./page";

const W = 1080;
const H = 1920;
const NAVY = "#0b1530";
const ORANGE = "#F26B21";
const WHITE = "#ffffff";
const SOFT = "rgba(255,255,255,0.72)";

const img = (src: string) =>
  new Promise<HTMLImageElement | null>((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null); // a missing logo shouldn't stop the card
    i.src = src;
  });

// "Aarav Sharma" -> "Aarav S.", the same short form as the public leaderboard.
export const shortName = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};

function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, maxWidth: number) {
  while (px > 20) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 2;
  }
}

function centered(ctx: CanvasRenderingContext2D, text: string, y: number, font: (px: number) => string, px: number, color: string) {
  fit(ctx, text, font, px, W - 160);
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
}

export async function drawScoreCard(name: string, s: Omit<WallMe, "open">) {
  const display = (px: number) => `${px}px "Yatra One", Georgia, serif`;
  const body = (weight = 600) => (px: number) => `${weight} ${px}px Mukta, system-ui, sans-serif`;
  await Promise.all([document.fonts.load(display(80)), document.fonts.load(body()(40))]).catch(() => {});

  const joinUrl = `${window.location.origin}/wall`;
  const [avantra, arithi, qr] = await Promise.all([
    img("/multiverse/avantra-logo-transparent.png"),
    img("/brand/arithi-logo.png"),
    QRCode.toDataURL(joinUrl, { width: 260, margin: 1, color: { dark: NAVY, light: WHITE } }).then(img),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Background: navy with a warm glow behind the score.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 1000, 40, W / 2, 1000, 700);
  glow.addColorStop(0, "rgba(242,107,33,0.28)");
  glow.addColorStop(1, "rgba(242,107,33,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top: AVANTRA, the hero. ~60% of the width, never stretched.
  let y = 260;
  if (avantra) {
    const w = W * 0.6;
    const h = Math.min((avantra.height / avantra.width) * w, 340);
    const drawW = (avantra.width / avantra.height) * h;
    ctx.drawImage(avantra, (W - drawW) / 2, y, drawW, h);
    y += h + 64;
  } else {
    centered(ctx, "AVANTRA", y + 140, display, 170, WHITE);
    y += 210;
  }
  centered(ctx, "AVANTRA 2026 · Science & Innovation Fest", y, body(), 40, WHITE);

  // Middle: the score.
  y += 110;
  centered(ctx, "ARITHI Engagement Wall", y, display, 62, ORANGE);
  y += 90;
  centered(ctx, shortName(name), y, body(700), 64, WHITE);
  y += 250;
  centered(ctx, String(s.points), y, display, 260, ORANGE);
  y += 66;
  centered(ctx, "points", y, body(), 44, SOFT);
  y += 92;
  if (s.frozenAt) centered(ctx, "Final results at the ceremony", y, body(700), 50, WHITE);
  else if (s.rank) centered(ctx, `#${s.rank} of ${s.players}`, y, display, 72, WHITE);
  y += 70;
  if (s.school) centered(ctx, s.frozenAt ? s.school.name : `${s.school.name} · #${s.school.rank} school`, y, body(), 38, SOFT);
  y += 56;
  centered(ctx, `${s.solved} ${s.solved === 1 ? "challenge" : "challenges"} solved`, y, body(), 38, SOFT);

  // Bottom band (ends at 1670): ARITHI + a QR so viewers can join.
  const bandTop = 1420;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.roundRect(60, bandTop, W - 120, 250, 28);
  ctx.fill();
  ctx.textAlign = "left";
  if (arithi) {
    const h = 96;
    const w = Math.min((arithi.width / arithi.height) * h, 520);
    ctx.drawImage(arithi, 100, bandTop + 36, w, (arithi.height / arithi.width) * w);
  } else {
    ctx.font = display(84);
    ctx.fillStyle = WHITE;
    ctx.fillText("ARITHI", 100, bandTop + 112);
  }
  ctx.font = body(400)(30);
  ctx.fillStyle = SOFT;
  ctx.fillText("Powered by ARITHI Innovation", 100, bandTop + 172);
  ctx.fillText("and Technologies", 100, bandTop + 210);
  if (qr) ctx.drawImage(qr, W - 100 - 180, bandTop + 22, 180, 180);
  ctx.textAlign = "center";
  ctx.font = body()(26);
  ctx.fillStyle = WHITE;
  ctx.fillText(`${window.location.host}/wall`, W - 100 - 90, bandTop + 232);

  return canvas;
}

// Phones: the share sheet (Instagram, WhatsApp…). Elsewhere, or if sharing isn't allowed: download the PNG.
export async function shareScoreCard(name: string, s: Omit<WallMe, "open">) {
  const canvas = await drawScoreCard(name, s);
  const blob = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("toBlob"))), "image/png"));
  const file = new File([blob], "avantra-wall-score.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      return await navigator.share({ files: [file], text: `My ARITHI Engagement Wall score at AVANTRA 2026. Join: ${window.location.origin}/wall` });
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // they closed the share sheet
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
