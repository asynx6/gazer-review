// Auto-label: keputusan murni (bisa diuji), terpisah dari API GitHub.

const SECURITY_RE = /injection|secret|xss|ssrf|path traversal|deserial|auth|password|token|kredensial/i;

export const LABELS = {
  security: { name: 'gazer/security', color: 'b60205', description: 'Isu keamanan terdeteksi AI' },
  changes: { name: 'gazer/request-changes', color: 'd4c5f9', description: 'Gazer minta perubahan sebelum merge' },
  high: { name: 'gazer/high-priority', color: 'f9d0c4', description: 'Catatan high-severity dari Gazer' },
};

export function decideLabels(inlineComments, verdict) {
  const out = [];
  const has = (sev) => inlineComments.some((c) => c.severity === sev);
  const securityFlag =
    has('critical') ||
    inlineComments.some((c) => SECURITY_RE.test(`${c.title} ${c.body}`));
  if (securityFlag) out.push(LABELS.security.name);
  if (verdict === 'request_changes' || has('critical')) out.push(LABELS.changes.name);
  if (has('high')) out.push(LABELS.high.name);
  return [...new Set(out)];
}

export async function applyLabels(repo, prNumber, names) {
  const H = {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  // pastikan label ada (422 = sudah ada, aman diabaikan)
  for (const name of names) {
    const meta = Object.values(LABELS).find((l) => l.name === name);
    if (!meta) continue;
    await fetch(`https://api.github.com/repos/${repo}/labels`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ name: meta.name, color: meta.color, description: meta.description }),
    }).catch(() => {});
  }
  if (names.length) {
    const r = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/labels`, {
      method: 'PUT',
      headers: H,
      body: JSON.stringify({ labels: names }),
    });
    if (!r.ok) throw new Error(`set labels HTTP ${r.status}`);
  }
  return names;
}
