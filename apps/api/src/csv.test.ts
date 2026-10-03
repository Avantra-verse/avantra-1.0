import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv.ts';

test('csv: quoting, dates, empty values, formula injection', () => {
  const csv = toCsv(['name', 'school', 'paid', 'when'], [
    { name: 'Asha "Ash" Rao', school: 'DPS, Rourkela', paid: true, when: new Date('2026-12-19T05:00:00Z') },
    { name: '=HYPERLINK("http://x")', school: null, paid: false },
    { name: '-5+3', school: 'Line\nbreak' },
  ]);
  const [header, a, b, c] = csv.slice(1).split('\r\n');
  assert.ok(csv.startsWith('﻿'));
  assert.equal(header, 'name,school,paid,when');
  assert.equal(a, '"Asha ""Ash"" Rao","DPS, Rourkela",true,2026-12-19T05:00:00.000Z');
  assert.equal(b, `"'=HYPERLINK(""http://x"")",,false,`);
  assert.equal(c, `"'-5+3","Line
break",,`); // the newline stays inside the quoted cell
});
