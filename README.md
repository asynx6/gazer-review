<div align="center">

# 🟢 Gazer

**AI code review bot untuk GitHub — komentar PR baris-per-baris dalam Bahasa Indonesia.**

Self-hosted · Zero dependency · Model agnostic (bisa 100% offline pakai Ollama)

[![CI](https://github.com/asynx6/gazer-review/actions/workflows/ci.yml/badge.svg)](https://github.com/asynx6/gazer-review/actions/workflows/ci.yml)
[![Docker build](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](#-docker)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Good first issues](https://img.shields.io/badge/help%20wanted-good%20first%20issues-7057ff)](https://github.com/asynx6/gazer-review/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Lihat demo review di PR nyata →](https://github.com/asynx6/gazer-demo/pull/1)

</div>

---

Gazer membaca diff setiap Pull Request, lalu menulis review di tempat yang seharusnya:
baris kodenya langsung. Bukan soal spacing — tapi **bug, security, dan performa**:

| | |
|---|---|
| 🔴 **Hardcoded secret** | nangkep API key / password yang kecemplung ke source |
| 🔴 **Injection** | SQL & command injection, path traversal, XSS |
| 🟠 **Logic hazard** | N+1 query, race condition, memory leak, `eval()` |
| 🟡 **Error handling** | response tidak dicek, error ditelan diam-diam |

Verdict resmi (APPROVE / COMMENT / REQUEST_CHANGES) + ringkasan PR dalam bahasa
Indonesia yang enak dibaca, bukan hasil translate kaku.

## ✨ Kenapa Gazer

- **Bahasa Indonesia asli** — prompt & output dirancang untuk developer Indonesia. Tool sejenis English-only.
- **100% gratis & offline bisa** — pakai [Ollama](https://ollama.com), kode kamu nggak pernah keluar dari mesinmu. Tidak ada subscription, tidak ada data dikirim ke vendor pihak ketiga.
- **Ringan** — murni Node.js `>=18`, **nol dependency**. Jalan bahkan di VPS 512MB.
- **Real-time** — webhook HMAC terverifikasi; commit di-push, review muncul ~30 detik kemudian.
- **Nggak cerewet** — max 8 komentar per PR (bisa diatur), skip hal sepele,
  dan **lockfile/vendor/dist/binary tidak pernah dikirim ke model** — hemat
  token sampai 99% pada PR yang banyak update dependency.

## ⚙️ Konfigurasi per-repo (`gazer.json`)

Taruh `gazer.json` di **root branch target** PR (mis. `main`) — disengaja, biar
PR masuk nggak bisa nyuntik aturan:

```json
{
  "ignore": ["migrations/.*\\.sql$", "legacy/"],
  "maxComments": 5,
  "extraRules": "Repo ini jalan di PHP 5 — jangan sarankan syntax >5.6."
}
```

| Key | Default | Fungsi |
|---|---|---|
| `ignore` | `[]` | regex pola path tambahan untuk dilewati |
| `maxComments` | 8 | batas inline comment (1–15) |
| `extraRules` | — | teks yang disuntikkan ke prompt (maks 1500 char) |

## 🏷️ Label otomatis

Setiap review, Gazer pasang label (dibuat otomatis kalau belum ada):

| Label | Kapan |
|---|---|
| 🔴 `gazer/security` | ada komentar critical, atau judul/body kena pola security (injection, secret, XSS, …) |
| 🟣 `gazer/request-changes` | verdict request_changes atau ada critical |
| 🟠 `gazer/high-priority` | ada komentar severity high |

Bisa jadi gate: "PR dengan label `gazer/security` nggak boleh di-merge tanpa review manusia".

## 🐳 Docker

```bash
docker build -t gazer .
docker run -d --name gazer -p 80:80 --env-file .env -v gazer-state:/app/data gazer
```

## 🚀 Quickstart (2 menit)

```bash
git clone https://github.com/asynx6/gazer-review && cd gazer-review
cp .env.example .env
```

Isi `.env`:

```ini
GH_TOKEN=***        # GitHub PAT dengan scope repo
LLM_BASE_URL=https://api.b.ai/v1       # atau endpoint mana pun (lihat bawah)
LLM_API_KEY=***
LLM_MODEL=qwen3.8-flash
REPOS=nama-kamu/repo-1,nama-kamu/repo-2
```

Lalu:

```bash
node index.js review nama-kamu/repo-1 12    # review 1 PR sekarang juga
# atau biarkan jaga 24 jam:
node index.js serve                         # webhook real-time + polling cadangan
node index.js attach nama-kamu/repo-1       # daftarkan webhook repo
```

### Pakai model lokal / provider mana pun

Gazer bicara bahasa OpenAI-compatible, jadi tinggal ganti `LLM_BASE_URL`:

| Provider | Base URL | Contoh model | Biaya |
|---|---|---|---|
| Ollama (lokal) | `http://localhost:11434/v1` | `qwen2.5-coder:7b` | Gratis, offline |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | Free tier |
| OpenRouter | `https://openrouter.ai/api/v1` | bebas pilih | Free tier ada |
| b.ai | `https://api.b.ai/v1` | `qwen3.8-flash` | murah |
| llama.cpp / vLLM | endpoint lokal kamu | apa saja | Gratis |

## ⚙️ Cara kerja

```
PR dibuka / commit baru
   │  webhook HMAC  ──► validasi signature 401 kalau palsu
   ▼
fetch diff  ──► LLM (prompt Indonesia) ──► JSON terstruktur
   │                                            │
   │        line divalidasi vs diff ◄───────────┘
   ▼
GitHub review API → inline comment per baris + verdict
```

- **Line validator** — LLM sering noh baris ngawur. Gazer menghitung baris `+`
  asli dari diff; komentar yang meleset digeser ke baris valid terdekat,
  yang di luar itu dibuang. Tidak ada komentar nyasar.
- **State** (`.gazer-state.json`) menyimpan SHA terakhir per PR → commit baru
  = review baru; tidak ada commit baru = diam. Tidak boros token.
- **Review lama di-clean** sebelum posting baru, jadi tab Files nggak menumpuk.
- **Polling cadangan** 15 menit sekali kalau webhook nggak terpasang.

## 📚 Dokumentasi

- [CONTRIBUTING.md](CONTRIBUTING.md) — cara develop & PR
- [docs/prompts.md](docs/prompts.md) — rekayasa prompt & cara menyesuaikan
- [docs/troubleshooting.md](docs/troubleshooting.md) — error umum webhook/API

## 💡 Ide pengembangan

Butuh bantuan? Buka [Issues](https://github.com/asynx6/gazer-review/issues) —
ada label `good first issue` buat mulai, dan diskusi peta jalan di [issue #4](https://github.com/asynx6/gazer-review/issues/4).

## 📄 Lisensi

[MIT](LICENSE) — pakai, modifikasi, jual lagi, bebas.
Attribusi appreciated, tidak diwajibkan.
