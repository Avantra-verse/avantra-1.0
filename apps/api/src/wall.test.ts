import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerMatches, wallAnswersValid } from '@avantra/shared';

test('wall answers: forgiving on case, spaces, full stops and number formats; strict otherwise', () => {
  assert.ok(answerMatches('  Photo  Synthesis. ', ['photo synthesis']));
  assert.ok(answerMatches('1,000', ['1000']));
  assert.ok(answerMatches('3.50', ['3.5']));
  assert.ok(answerMatches('mars', ['Venus', 'Mars']));
  assert.ok(!answerMatches('100', ['1000']));
  assert.ok(!answerMatches('mar', ['Mars']));
  assert.ok(!answerMatches('-5', ['5']));
});

test('wall multiple choice: 2+ options, answers must be options', () => {
  assert.ok(wallAnswersValid({ answers: ['anything'] }));
  assert.ok(wallAnswersValid({ options: ['A', 'B'], answers: ['b'] }));
  assert.ok(!wallAnswersValid({ options: ['A'], answers: ['A'] }));
  assert.ok(!wallAnswersValid({ options: ['A', 'B'], answers: ['C'] }));
});

test('wall sheet: CSV quoting, option letters, categories, row errors', async () => {
  const { readSheet, SHEET_COLUMNS, SHEET_EXAMPLES } = await import('./wall-sheet.ts');
  const { toCsv } = await import('./csv.ts');
  const ok = readSheet(toCsv(SHEET_COLUMNS, SHEET_EXAMPLES));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.challenges[1].answers, ['Mars'], 'letter B → option text');
  assert.deepEqual(ok.challenges[0].answers, ['1000', 'one thousand']);

  const sheet = 'Number,Category,Difficulty,Question,Option A,Option B,Answers\r\n' + '3,science,2,"Is ""H2O"" water,\nyes or no?",Yes,No,a\r\n' + '\r\n' + '4,Cooking,9,Q,,,x\n';
  const { challenges, errors } = readSheet(sheet);
  assert.deepEqual([challenges.length, challenges[0].category, challenges[0].question, challenges[0].answers], [1, 'Science', 'Is "H2O" water,\nyes or no?', ['Yes']]);
  assert.equal(errors.length, 2);
  assert.ok(errors.every((e) => e.startsWith('Row 4: ')), errors.join('; '));
  assert.match(readSheet('foo,bar\n1,2').errors[0], /Missing columns/);
});
