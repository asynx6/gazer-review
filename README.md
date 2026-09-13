# 🟢 Gazer — AI Code Review Bot (Bahasa Indonesia)

Bot review Pull Request otomatis pakai LLM. Komen langsung di PR dengan bahasa
Indonesia teknis: tangkep bug, security issue, dan masalah performa — tanpa
ngoceh soal gaya.

Ringan: **zero dependency** (cuma Node.js >= 18), polling-based, cocok jalan di
VPS 1GB RAM. Model, harga token, semuanya bisa diatur sendiri (OpenAI-compatible).

## Kenapa Gazer

CodeRabbit, Greptile, dsb. bagus tapi: (1) English-only, (2) mahal per developer,
(3) kirim kode ke server mereka. Gazer: self-host, bisa pakai API key sendiri
atau endpoint lokal, dan review-nya nyambung dibaca developer Indonesia.

## Fitur

- 🇮🇩 Review markdown berbahasa Indonesia, terstruktur: verdict + prioritas + action items
- 📍 **Inline comment baris-per-baris** langsung di tab Files PR — garis menunjuk baris `+` yang beneran (divalidasi terhadap diff, auto-nudge ke baris valid terdekat)
- 🔒 Deteksi hardcoded secret, command/SQL injection, XSS, path traversal, N+1, race condition
- ✅ Verdict review: APPROVE / COMMENT / REQUEST_CHANGES (auto-degradasi kalau GitHub menolaknya, mis. PR sendiri)
- ♻️ Review ulang otomatis saat ada commit baru (review lama dibersihkan, bukan spam)
- 💾 State persist di file — restart aman, tidak double-bayar API
- 🧠 Model agnostic: semua endpoint OpenAI-compatible (`/v1/chat/completions`)

## Setup

```bash
git clone https://github.com/asynx6/gazer-review && cd gazer-review
cp .env.example .env   # isi token & model
node index.js          # polling mode (default tiap 3 menit)
node index.js --once   # satu sweep lalu keluar (buat cron)
node index.js review owner/repo 12         # review manual 1 PR
node index.js review owner/repo 12 --force # paksa review ulang
```

`.env`:

| Var | Keterangan |
|---|---|
| `GH_TOKEN` | GitHub PAT (scope `repo`) dari akun bot |
| `LLM_BASE_URL` | endpoint OpenAI-compatible, default `https://api.b.ai/v1` |
| `LLM_API_KEY` | kunci API |
| `LLM_MODEL` | mis. `qwen3.8-flash` |
| `REPOS` | daftar repo: `owner/repo1,owner/repo2` |
| `POLL_INTERVAL_MS` | interval polling (default 180000) |

## Cara kerja

```
poll open PR → fetch diff → LLM review (prompt ID) → komen/update komentar
                ↑ state: .gazer-state.json menyimpan head SHA terakhir
```

## Roadmap

- [x] Inline comment per-baris diff (v0.2) + verdict review
- [ ] Webhook mode (real-time, tak perlu polling) via GitHub App
- [ ] Label otomatis (`security`, `needs-tests`)
- [ ] Multi-repo config per-file + org-wide scan
- [ ] Landing page + billing untuk hosted version

## Lisensi

MIT. Demo nyata: lihat komentar di https://github.com/asynx6/gazer-demo/pull/1
