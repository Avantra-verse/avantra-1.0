import { PDFDocument, type PDFFont, rgb, StandardFonts } from 'pdf-lib';

export type CertificateData = { name: string; school: string | null; event: string; rank: number | null; code: string; verifyUrl: string };

const PLACE = ['', '1st place', '2nd place', '3rd place'];
const INK = rgb(0.1, 0.1, 0.25);
const ACCENT = rgb(0.95, 0.42, 0.13); // brochure orange

// ponytail: standard PDF fonts only cover Latin text; accents are stripped and other scripts dropped.
// If students enter names in Devanagari/Odia, embed a Noto Sans TTF with @pdf-lib/fontkit.
function latin(font: PDFFont, text: string): string {
  return [...text.normalize('NFKD').replace(/\p{M}/gu, '')]
    .filter((ch) => {
      try {
        font.encodeText(ch);
        return true;
      } catch {
        return false;
      }
    })
    .join('')
    .trim();
}

export async function renderCertificate(c: CertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`AVANTRA 2026 certificate - ${c.code}`);
  const page = pdf.addPage([842, 595]); // A4 landscape, points
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();

  const center = (text: string, y: number, size: number, font = regular, color = INK) => {
    const t = latin(font, text);
    page.drawText(t, { x: (width - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: 595 - 48, borderColor: ACCENT, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: 595 - 68, borderColor: INK, borderWidth: 0.75 });

  center('AVANTRA 2026', 500, 34, bold, ACCENT);
  center('Inter-School Science & Innovation Festival', 474, 14);
  center(c.rank ? 'CERTIFICATE OF EXCELLENCE' : 'CERTIFICATE OF PARTICIPATION', 420, 22, bold);
  center('This is to certify that', 380, 13);
  center(c.name, 340, 30, bold);
  if (c.school) center(`of ${c.school}`, 312, 14);
  center(c.rank ? `secured ${PLACE[c.rank]} in ${c.event}` : `participated in ${c.event}`, 270, 17, bold);
  center('held on 19-20 December 2026 at SSRVM IEMS Sec-20', 246, 13);

  // Signature lines; signed copies can be printed, or a signature image drawn here later.
  for (const [x, label] of [[200, 'Director, SSRVM IEMS Sec-20'], [642, 'Event Manager, AVANTRA 2026']] as const) {
    page.drawLine({ start: { x: x - 110, y: 175 }, end: { x: x + 110, y: 175 }, thickness: 0.75, color: INK });
    page.drawText(label, { x: x - regular.widthOfTextAtSize(label, 10) / 2, y: 160, size: 10, font: regular, color: INK });
  }

  center('Organised by SSRVM IEMS Sec-20   |   Event Partner: ARITHI Innovation and Technologies Pvt. Ltd.', 110, 11);
  center(`Certificate ID ${c.code}   |   Verify at ${c.verifyUrl}`, 70, 9, regular, rgb(0.4, 0.4, 0.45));
  return pdf.save();
}
