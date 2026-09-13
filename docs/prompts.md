# Prompt Engineering Gazer

Keluaran review sepenuhnya dikendalikan `src/prompt.js`. Kalau kualitas review
kurang pas, ubah di sini dulu sebelum nyentuh logika.

## Skema keluaran yang diminta

Model WAJIB membalik JSON:

```json
{
  "summary": "…",
  "verdict": "approve|comment|request_changes",
  "inline": [{ "path": "…", "line": 0, "severity": "critical|high|minor", "title": "…", "body": "…" }],
  "general": "…"
}
```

`parseReview()` toleran: JSON mentah, dalam ``` fence, atau tercampur teks lain.
Kalau gagal dua percobaan → skip (PR akan dicoba lagi di siklus berikutnya).

## Aturan penting di prompt

1. **Hanya baris `+`** — model dilarang menunjuk baris konteks/hapus. Validator
   `src/diff.js` tetap mengoreksi yang bandel (auto-nudge ±5 baris).
2. **Maks 8 inline** — mencegah wall of text; kalau model membludak,
   `review.js` memotong ke 8 teratas.
3. **`verdict: approve` hanya tanpa critical/high** — GitHub menolak
   request_changes di PR sendiri; sudah ditangani dengan degradasi ke COMMENT.

## Menyesuaikan untuk tim kamu

Contoh perubahan yang umum:

- Tambah aturan: `"Selalu cek fungsi ini di-terima input user (taint tracking)."`
- Kurangi noise: `"Abaikan semua yang terkait penamaan."`
- Bahasa lain: ganti baris `Bahasa:` — struktur JSON tetap.

Simpan varian prompt kamu sebagai fork; kirim PR kalau menurutmu berguna umum.
