// Parse unified diff → peta path → Set(added line numbers, sisi RIGHT)
// Line RIGHT = nomor baris di file hasil; hanya baris `+` yang boleh dikomentari.

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
  // hitung juga "total lines" per file untuk validasi batas
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
