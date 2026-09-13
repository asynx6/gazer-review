// Test runner nol dependency: node test.js
import { parseAddedLines, validateComments, filterDiff } from './src/diff.js';
import { parseReview } from './src/prompt.js';

let pass = 0, fail = 0;
function eq(actual, expected, name) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`FAIL ${name}\n  exp: ${e}\n  got: ${a}`); }
}

// ── parseAddedLines ──────────────────────────────────────────────
const diff = [
  'diff --git a/x.js b/x.js',
  'index 111..222 100644',
  '--- a/x.js',
  '+++ b/x.js',
  '@@ -1,4 +1,5 @@',
  ' line1',
  '-old',
  '+new2',
  '+new3',
  ' line4',
  '@@ -10,2 +11,1 @@',
  '-del',
  '+added11',
  'diff --git a/y.php b/y.php',
  '--- /dev/null',
  '+++ b/y.php',
  '@@ -0,0 +1,3 @@',
  '+a1',
  '+a2',
  '+a3',
].join('\n');
const m = parseAddedLines(diff);
eq([...m.get('x.js')], [2, 3, 11], 'parseAddedLines basic');
eq([...m.get('y.php')], [1, 2, 3], 'parseAddedLines new file');

// ── validateComments ─────────────────────────────────────────────
const v = validateComments(
  [
    { path: 'x.js', line: 2 },          // valid
    { path: 'x.js', line: 1 },          // konteks → nudge ke 2
    { path: 'x.js', line: 999 },        // jauh → buang
    { path: 'y.php', line: 2 },         // valid
    { path: 'z.js', line: 1 },          // file tak ada → buang
    { path: 'x.js', line: '3' },        // tipe salah → buang
  ],
  m,
);
eq(v.map((c) => [c.line, !!c.nudged]), [[2, false], [2, true], [2, false]], 'validateComments');

// ── filterDiff ───────────────────────────────────────────────────
const dirty = [
  'diff --git a/package-lock.json b/package-lock.json',
  '--- a/package-lock.json',
  '+++ b/package-lock.json',
  '@@ -1,2 +1,2 @@',
  '-"a": 1',
  '+"a": 2',
  'diff --git a/src/app.js b/src/app.js',
  '--- a/src/app.js',
  '+++ b/src/app.js',
  '@@ -1,1 +1,2 @@',
  ' keep',
  '+added',
  'diff --git a/assets/logo.png b/assets/logo.png',
  'Binary files a/assets/logo.png and b/assets/logo.png differ',
].join('\n');
const f = filterDiff(dirty, ['legacy/']);
eq(f.skipped.sort(), ['assets/logo.png', 'package-lock.json'], 'filterDiff skips noise+binary');
eq(f.diff.includes('src/app.js'), true, 'filterDiff keeps real code');
const f2 = filterDiff(dirty, ['src/']); // pola ignore tambahan
eq(f2.skipped.length, 3, 'filterDiff custom pattern');

// ── parseReview ──────────────────────────────────────────────────
eq(!!parseReview('{"verdict":"approve","inline":[]}'), true, 'parseReview plain');
eq(!!parseReview('hallo\n```json\n{"inline":[]}\n```'), true, 'parseReview fenced');
eq(!!parseReview('xx {"inline":[]} yy'), true, 'parseReview embedded');
eq(parseReview('bukan json'), null, 'parseReview garbage → null');
eq(!!parseReview('{"inline":[]} // komentar penutup'), true, 'parseReview trailing slice');

// ── labels ───────────────────────────────────────────────────────
const { decideLabels } = await import('./src/labels.js');
eq(decideLabels([{ severity: 'high', title: 'XSS', body: 'x' }], 'comment'),
  ['gazer/security', 'gazer/high-priority'], 'label security via kata kunci');
eq(decideLabels([{ severity: 'critical', title: 'bug', body: 'x' }], 'approve'),
  ['gazer/security', 'gazer/request-changes'], 'critical selalu security+changes');
eq(decideLabels([{ severity: 'minor', title: 'typo', body: 'x' }], 'approve'),
  [], 'minor bersih → tanpa label');
eq(decideLabels([{ severity: 'high', title: 'query lambat', body: 'N+1 detected' }], 'comment'),
  ['gazer/high-priority'], 'high tanpa security kata → cuma priority');

// ── userPrompt truncation ────────────────────────────────────────
const { userPrompt } = await import('./src/prompt.js');
const big = ('x'.repeat(59990) + '\n' + 'y'.repeat(200)); // 60091 char, newline di 59991
const p = userPrompt({ number: 1, title: 't', head: {}, base: {}, body: '' }, big, {});
eq(p.includes('dipotong di sini'), true, 'prompt memotong diff besar');
eq(p.endsWith('```\n'), true, 'potongan tidak menggantung di tengah fence');

console.log(`\n${fail === 0 ? '✔' : '✖'} ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
