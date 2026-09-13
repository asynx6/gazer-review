# Security Policy

## Ganguan (Reporting a Vulnerability)

Kalau kamu nemu celah keamanan di Gazer, tolong **jangan** buka issue publik.
Laporkan lewat salah satu:

- GitHub Security Advisory: https://github.com/asynx6/gazer-review/security/advisories/new
- Email maintainer (cek profil GitHub `asynx6`)

Kami berusaha merespons dalam 72 jam.

## Yang perlu kamu tahu soal risiko desain

1. **Kode kamu dikirim ke endpoint LLM** yang kamu konfigurasi sendiri di `.env`.
   Kalau pakai provider pihak ketiga, kode PR lewat server mereka.
   **Mau 100% lokal? Pakai Ollama** — tidak ada data keluar mesinmu.
2. **`gazer.json` sengaja hanya dibaca dari branch target (mis. `main`)**, bukan
   dari branch PR — supaya PR jahat tidak bisa menyuntik `extraRules` ke prompt.
3. **Webhook diverifikasi HMAC-SHA256** dengan secret yang digenerate saat
   `attach`; request tanpa signature valid langsung 401.
4. **Token GitHub**: pakai PAT dengan scope sekecil mungkin. Untuk polling biasa
   cukup scope `repo`; `admin:repo_hook` hanya perlu saat `attach/detach`.
5. Review AI bisa salah. Jangan jadikan Gazer satu-satunya gate keamanan —
   manusia tetap harus merge.
