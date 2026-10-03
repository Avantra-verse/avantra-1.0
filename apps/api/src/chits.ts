// Print-ready Engagement Wall chits: A4 portrait, 6 per page with dashed cut lines.
// Each chit: number, category, difficulty, points, question, options, code, and a QR that opens the challenge directly.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import QRCode from 'qrcode';
import { wallAttempts } from '@avantra/shared';

export type Chit = { number: number; code: string; category: string; difficulty: number; points: number; question: string; options: string[] };

const INK = rgb(0.1, 0.1, 0.25);
const ACCENT = rgb(0.95, 0.42, 0.13); // brochure orange
const GREY = rgb(0.45, 0.45, 0.5);
const WHITE = rgb(1, 1, 1);

const [W, H, M] = [595.28, 841.89, 20]; // A4 portrait, page margin
const [COLS, ROWS] = [2, 3];
const CW = (W - 2 * M) / COLS;
const CH = (H - 2 * M) / ROWS;
const PAD = 12;
const QR = 92;

// DejaVu Sans covers maths and science symbols (× ÷ √ π ≈ ≤ ² ° ₹ ∑) that the built-in PDF fonts don't.
const fontFile = (w: string) => readFileSync(join(__dirname, '..', 'assets', 'fonts', `DejaVuSans${w}.ttf`));
let fonts: { regular: Buffer; bold: Buffer } | undefined;

export const chitUrl = (code: string) => `${process.env.WEB_ORIGIN}/wall?code=${code}`;

export async function renderChits(chits: Chit[]): Promise<Uint8Array> {
  fonts ??= { regular: fontFile(''), bold: fontFile('-Bold') };
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('ARITHI Engagement Wall chits - AVANTRA 2026');
  const regular = await pdf.embedFont(fonts.regular, { subset: true });
  const bold = await pdf.embedFont(fonts.bold, { subset: true });

  let page: PDFPage | undefined;
  for (const [i, chit] of chits.entries()) {
    const slot = i % (COLS * ROWS);
    if (slot === 0) page = pdf.addPage([W, H]);
    const x = M + (slot % COLS) * CW;
    const y = H - M - (Math.floor(slot / COLS) + 1) * CH;
    await drawChit(page!, x, y, chit, regular, bold);
  }
  return pdf.save();
}

async function drawChit(page: PDFPage, x: number, y: number, c: Chit, regular: PDFFont, bold: PDFFont) {
  const text = (s: string, tx: number, ty: number, size: number, font = regular, color = INK) =>
    page.drawText(printable(font, s), { x: tx, y: ty, size, font, color });
  const top = y + CH;

  page.drawRectangle({ x, y, width: CW, height: CH, borderColor: GREY, borderWidth: 0.5, borderDashArray: [4, 3] }); // cut line

  // Header band
  page.drawRectangle({ x: x + PAD, y: top - PAD - 22, width: CW - 2 * PAD, height: 22, color: ACCENT });
  text('ARITHI ENGAGEMENT WALL', x + PAD + 8, top - PAD - 15, 9, bold, WHITE);
  const brand = 'AVANTRA 2026';
  text(brand, x + CW - PAD - 8 - bold.widthOfTextAtSize(brand, 9), top - PAD - 15, 9, bold, WHITE);

  // Left: number, category, difficulty, points. Right: QR + code.
  const infoTop = top - PAD - 22 - 10;
  text(`#${c.number}`, x + PAD, infoTop - 22, 24, bold);
  text(c.category.toUpperCase(), x + PAD, infoTop - 38, 9, bold, GREY);
  text(`Level ${c.difficulty}/8`, x + PAD, infoTop - 54, 9);
  for (let d = 0; d < 8; d++) {
    const filled = d < c.difficulty;
    page.drawCircle({ x: x + PAD + 4 + d * 11, y: infoTop - 66, size: 4, color: filled ? ACCENT : undefined, borderColor: ACCENT, borderWidth: 0.8 });
  }
  text(`${c.points} POINTS`, x + PAD, infoTop - 92, 16, bold, ACCENT);

  const qrX = x + CW - PAD - QR;
  const qrY = infoTop - QR;
  await drawQr(page, chitUrl(c.code), qrX, qrY, QR);
  const code = c.code.split('').join(' ');
  text(code, qrX + (QR - bold.widthOfTextAtSize(code, 12)) / 2, qrY - 14, 12, bold);
  const hint = 'Scan, or type the code at /wall';
  text(hint, qrX + (QR - regular.widthOfTextAtSize(hint, 6)) / 2, qrY - 23, 6, regular, GREY);

  // Question + options, shrunk to fit. If it still doesn't fit, the full text is on the student's screen.
  const options = c.options.map((o, k) => `${'ABCDEF'[k]})  ${o}`);
  const boxTop = qrY - 34;
  const boxBottom = y + PAD + 10;
  const width = CW - 2 * PAD;
  // Question in bold, options in regular; each wrapped with the font it's drawn in.
  const layout = (size: number) => [
    ...wrapAll([c.question], bold, size, width).map((line) => ({ line, font: bold })),
    ...wrapAll(options, regular, size, width).map((line) => ({ line, font: regular })),
  ];
  let size = 11;
  let lines = layout(size);
  while (lines.length * size * 1.3 > boxTop - boxBottom && size > 6.5) lines = layout((size -= 0.5));
  const fits = Math.floor((boxTop - boxBottom) / (size * 1.3));
  if (lines.length > fits) lines = [...lines.slice(0, fits - 1), { line: '… full question on your screen after scanning', font: regular }];
  lines.forEach(({ line, font }, k) => text(line, x + PAD, boxTop - size - k * size * 1.3, size, font));

  const tries = wallAttempts(c);
  const footer = `Correct answer = points for you and your school. ${tries === 1 ? 'Only 1 try!' : `${tries} tries.`}`;
  text(footer, x + PAD, y + PAD - 2, 6, regular, GREY);
}

// QR modules as one vector path: sharp at any print size, tiny file.
async function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (modules.get(r, c)) path += `M${c} ${r}h1v1h-1z`;
  page.drawSvgPath(path, { x, y: y + size, scale: size / n, color: rgb(0, 0, 0) });
}

function wrapAll(paragraphs: string[], font: PDFFont, size: number, width: number): string[] {
  return paragraphs.flatMap((p) => {
    const out: string[] = [];
    let line = '';
    for (const word of printable(font, p).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else out.push(line), (line = word);
    }
    return [...out, line];
  });
}

// Characters the font can't draw (emoji, rare scripts) become "?" instead of empty boxes.
const charsets = new WeakMap<PDFFont, Set<number>>();
function printable(font: PDFFont, s: string): string {
  const has = charsets.get(font) ?? new Set(font.getCharacterSet());
  charsets.set(font, has);
  return [...s].map((ch) => (has.has(ch.codePointAt(0)!) ? ch : '?')).join('');
}
