// Parse unified diff → peta path → Set(added line numbers, sisi RIGHT)
// Line RIGHT = nomor baris di file hasil; hanya baris `+` yang boleh dikomentari.

// File yang hampir selalu noise: lockfiles, vendor, build output, minified, binary-ish.
const DEFAULT_SKIP_PATTERNS = [
  /(^|\/)package-lock\.json$/i,
  /(^|\/)yarn\.lock$/i,
  /(^|\/)pnpm-lock\.yaml$/i,
  /(^|\/)composer\.lock$/i,
  /(^|\/)go\.sum$/i,
  /(^|\/)Cargo\.lock$/i,
  /(^|\/)Gemfile\.lock$/i,
  /(^|\/)poetry\.lock$/i,
  /\.min\.(js|css)$/i,
  /\.map$/i,
  /(^|\/)(vendor|node_modules|dist|build|\.next|out)\//i,
  /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp4|pdf|zip|gz)$/i,
];

function matchSkip(path, extraPatterns = []) {
  for (const re of DEFAULT_SKIP_PATTERNS) if (re.test(path)) return true;
  for (const p of extraPatterns || []) {
    try {
      if (new RegExp(p, 'i').test(path)) return true;
    } catch {
      if (path.toLowerCase().includes(String(p).toLowerCase())) return true;
    }
  }
  return false;
}

// Potong diff jadi per-file, buang file yang di-skip → hemat token & fokus review.
export function filterDiff(diffText, extraPatterns = []) {
  const chunks = diffText.split(/^(?=diff --git )/m).filter(Boolean);
  const kept = [];
  const skipped = [];
  for (const chunk of chunks) {
    const m = chunk.match(/^diff --git a\/(\S+) b\/(\S+)/m);
    if (!m) { kept.push(chunk); continue; }
    const path = m[2];
    const isBinary = /Binary files .* differ/.test(chunk);
    if (isBinary || matchSkip(path, extraPatterns)) {
      skipped.push(path);
    } else {
      kept.push(chunk);
    }
  }
  return { diff: kept.join(''), skipped };
}

export function parseAddedLines(diffText) {
  const map = new Map();
  let cur = null; // current file path (RIGHT side)
  let right = 0; // current RIGHT line counter

  for (const raw of diffText.split(/\r?\n/)) {
    if (raw.startsWith('diff --git')) { cur = null; continue; }
    if (raw.startsWith('+++ ')) {
      let p = raw.slice(4).trim();
      if (p.startsWith('b/')) p = p.slice(2);
      if (p === '/dev/null') { cur = null; continue; }
      cur = p;
      map.set(cur, map.get(cur) || new Set());
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { right = Number(hunk[1]); continue; }
    if (!cur) continue;

    if (raw.startsWith('+')) {
      map.get(cur).add(right);
      right++;
    } else if (raw.startsWith('-')) {
      // left only
    } else {
      right++; // context line
    }
  }
  return map;
}

export function validateComments(comments, addedMap) {
  const out = [];
  for (const c of comments || []) {
    if (!c || typeof c.path !== 'string' || typeof c.line !== 'number') continue;
    const lines = addedMap.get(c.path);
    if (!lines) continue; // file tidak ada di diff
    let line = Math.round(c.line);
    if (lines.has(line)) {
      out.push(c);
      continue;
    }
    // deketin ke garis `+` terdekat dalam rentang ±5 baris
    let best = null;
    for (const l of lines) {
      const d = Math.abs(l - line);
      if (d <= 5 && (!best || d < Math.abs(best - line))) best = l;
    }
    if (best !== null) {
      out.push({ ...c, line: best, nudged: true });
    }
  }
  return out;
}
