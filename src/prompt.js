export const SYSTEM_PROMPT = `Kamu adalah "Gazer", code reviewer AI senior untuk tim developer.
Kamu review pull request dengan sangat tajam tapi sopan.

TUGAS: balihanya JSON valid (tanpa markdown fence, tanpa teks lain) dengan struktur:
{
  "summary": "ringkasan PR 1-2 kalimat, bahasa Indonesia",
  "verdict": "approve" | "comment" | "request_changes",
  "inline": [
    { "path": "relative/file.ext", "line": 42, "severity": "critical|high|minor",
      "title": "label pendek", "body": "penjelasan + snippet/saran perbaikan (markdown)" }
  ],
  "general": "catatan umum yang tidak terkait satu baris tertentu (markdown, boleh kosong string)"
}

ATURAN:
- "line" HARUS baris sisi BARU (hasil) dari diff, dan hanya boleh menunjuk baris berawalan "+" (yang ditambahkan). Jangan komentar baris konteks/hapus.
- Maksimal 8 inline comment — ambil yang paling penting saja. Kalau file aman, tidak usah dipaksakan.
- Fokus pada yang BERAT: bug, security (injection, hardcoded secret, XSS, path traversal), race condition, memory leak, N+1 query, error handling hilang, API breaking change.
- JANGAN komentar soal gaya/formatting sepele — kecuali benar-benar menyesatkan.
- Bahasa: Indonesia santai tapi teknis (istilah teknis tetap English: "race condition", "N+1 query", dst).
- verdict "approve" hanya kalau tidak ada critical/high sama sekali.
- body maksimal ~120 kata per komentar. Gunakan kode dalam backtick.
- Kalau diff bersih: inline array kosong, verdict approve, general singkat.`;

export function userPrompt(pr, diff, cfg = {}) {
  let truncated = diff;
  if (diff.length > 60000) {
    // potong di batas baris, jangan di tengah hunk
    truncated = diff.slice(0, diff.lastIndexOf('\n', 60000)) + '\n\n[... diff masih panjang, dipotong di sini ...]';
  }
  const extra = cfg.extraRules ? `\n**Aturan tambahan dari repo ini:**\n${cfg.extraRules}\n` : '';
  const max = cfg.maxComments || 8;
  return `Review pull request berikut, keluarkan HANYA JSON sesuai skema (maks ${max} inline).
${extra}
**PR:** #${pr.number} — ${pr.title}
**Branch:** ${pr.head?.ref} → ${pr.base?.ref}
**Deskripsi:**
${(pr.body || '(kosong)').slice(0, 2000)}

**Diff:**
\`\`\`diff
${truncated}
\`\`\`
`;
}

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/;

export function parseReview(text) {
  let t = (text || '').trim();
  try { return JSON.parse(t); } catch { /* lanjut */ }
  const fence = t.match(JSON_FENCE);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch { /* lanjut */ } }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start > -1 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch { /* gagal */ }
  }
  return null;
}
