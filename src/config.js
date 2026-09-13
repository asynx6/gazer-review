// Config per-repo: gazer.json di root branch PR (opsional).
// Contoh:
// {
//   "ignore": ["migrations/.*\\.sql$", "legacy/"],
//   "maxComments": 5,
//   "extraRules": "Repo ini PHP 5 — sarankan hanya perbaikan yang kompatibel PHP 5. Jangan komentar soal typed properties."
// }

export async function repoConfig(repo, ref) {
  if (!repo || !ref) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/gazer.json?ref=${encodeURIComponent(ref)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GH_TOKEN}`,
          'Accept': 'application/vnd.github+json',
        },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.content) return null;
    const json = JSON.parse(Buffer.from(data.content.replace(/\s+/g, ''), 'base64').toString('utf8'));
    return {
      ignore: Array.isArray(json.ignore) ? json.ignore : [],
      maxComments: Number.isFinite(json.maxComments) ? Math.min(Math.max(json.maxComments, 1), 15) : 8,
      extraRules: typeof json.extraRules === 'string' ? json.extraRules.slice(0, 1500) : '',
    };
  } catch {
    return null;
  }
}
