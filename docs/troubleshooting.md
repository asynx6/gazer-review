# Troubleshooting

## `Konfigurasi belum lengkap`
`.env` tidak ketemu atau `GH_TOKEN` / `LLM_API_KEY` / `REPOS` kosong.
Gazer membaca `.env` di folder project — cek `node -e "console.log(process.cwd())"`
saat menjalankannya.

## `GitHub 401 Bad credentials`
Token kadaluarsa / scope kurang. PAT butuh scope `repo` (dan `admin:repo_hook`
untuk `attach`). Kalau pakai fine-grained token: izin *Pull requests* (RW) dan
*Webhooks* (RW) pada repo target.

## `GitHub 422 … your own pull request`
GitHub melarang approve/request_changes pada PR milik sendiri — sudah
ditangani otomatis (degradasi ke COMMENT). Bukan bug.

## Webhook tidak pernah masuk
- `node index.js serve` jalan & port bisa diakses publik? tes: `curl http://IP/webhook` → harus `401 bad signature` (404/timeout = masalah routing).
- GitHub → Settings → Webhooks → Recent Deliveries: status merah?
- `401` padahal signature benar → secret di `.gazer-webhooks.json` beda dengan
  yang terdaftar; jalankan ulang `node index.js attach owner/repo`.
- IP publik berubah (VPS di-restart) → update `WEBHOOK_URL` lalu attach ulang.

## Review tidak pernah muncul padahal webhook OK
Kemungkinan model balikin teks, bukan JSON → cek log, cari `gagal parse JSON`.
Coba `LLM_MODEL` yang lebih patuh instruksi, atau naikkan `max_tokens` di
`src/review.js` kalau diff besar.

## Mahal / boros token
Review hanya jalan saat SHA berubah. Polling default 15 menit (mode serve) —
perbesar `POLL_INTERVAL_MS`, atau andalkan webhook saja dengan menjalankan
`node index.js --once` dari cron sesuai jadwal yang kamu mau.
