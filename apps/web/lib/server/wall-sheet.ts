// Spreadsheet in/out for Engagement Wall challenges: admins fill the template in Excel or Google Sheets and upload it as CSV.
import { answerMatches, WALL_CATEGORIES, WallChallengeInput } from '@avantra/shared';

const OPTION_COLUMNS = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f'];
export const SHEET_COLUMNS = ['number', 'category', 'difficulty', 'points', 'question', ...OPTION_COLUMNS, 'answers'];

// Template rows (written with toCsv): a typed answer and a multiple choice.
export const SHEET_EXAMPLES = [
  { number: 1, category: 'Mathematics', difficulty: 3, points: 30, question: 'What is 25 × 40?', answers: '1000 | one thousand' },
  { number: 2, category: 'Science', difficulty: 5, question: 'Which planet is called the Red Planet?', option_a: 'Venus', option_b: 'Mars', option_c: 'Jupiter', option_d: 'Saturn', answers: 'B' },
];

// RFC 4180: quoted cells may hold commas, quotes ("") and line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  text = text.replace(/^﻿/, ''); // Excel's byte-order mark
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') (cell += '"'), i++;
      else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell), rows.push(row);
      (row = []), (cell = '');
    } else cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}

// Sheet → validated challenges, or every problem with its spreadsheet row number (header = row 1).
export function readSheet(text: string): { challenges: WallChallengeInput[]; errors: string[] } {
  const [header = [], ...rows] = parseCsv(text);
  const cols = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const missing = ['number', 'category', 'difficulty', 'question', 'answers'].filter((c) => !cols.includes(c));
  if (missing.length) return { challenges: [], errors: [`Missing columns: ${missing.join(', ')}. Download the template to see the layout.`] };

  const challenges: WallChallengeInput[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    if (!r.some((c) => c.trim())) return; // blank row
    const get = (c: string) => (r[cols.indexOf(c)] ?? '').trim();
    const num = (c: string) => (get(c) === '' ? undefined : Number(get(c)));
    const options = OPTION_COLUMNS.map(get).filter(Boolean);
    // Multiple choice answers may be the option letter ("B") or the option text.
    const answers = get('answers')
      .split('|')
      .map((a) => a.trim())
      .filter(Boolean)
      .map((a) => (options.length && /^[a-f]$/i.test(a) && !answerMatches(a, options) ? (options['ABCDEF'.indexOf(a.toUpperCase())] ?? a) : a));
    const category = WALL_CATEGORIES.find((c) => c.toLowerCase() === get('category').toLowerCase()) ?? get('category');
    const parsed = WallChallengeInput.safeParse({
      number: num('number'),
      category,
      difficulty: num('difficulty'),
      points: num('points'),
      question: get('question'),
      options: options.length ? options : undefined,
      answers,
    });
    if (parsed.success) challenges.push(parsed.data);
    else for (const issue of parsed.error.issues) errors.push(`Row ${i + 2}: ${issue.path.join('.') || 'row'}: ${issue.message}`);
  });
  if (!challenges.length && !errors.length) errors.push('The sheet has no challenges');
  return { challenges, errors };
}
