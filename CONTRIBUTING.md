# Contributing ke Gazer

Senang kamu di sini! 🟢

## Mulai

1. Perlu Node.js >= 18 — tidak ada langkah install, project ini zero dependency.
2. Clone, salin `.env.example` → `.env`, isi.
3. Uji pakai repo sandbox sendiri: bikin repo, bikin branch, buka PR, lalu
   `node index.js review kamu/repo 1`.

## Struktur kode

```
index.js          loader .env + router mode CLI (serve | attach | review | --once)
src/llm.js        client chat-completion (OpenAI-compatible)
src/github.js     wrapper REST API GitHub
src/prompt.js     system prompt + parser JSON keluaran model
src/diff.js       parser diff → baris '+' valid; validator & auto-nudge komentar
src/review.js     orkestrasi: fetch → LLM → validasi → posting review
src/webhook.js    HTTP server + verifikasi HMAC
src/attach.js     pasang/lepas webhook per repo
```

## Konvensi

- Kode dalam English, komentar secukupnya, pesan error boleh bilingual.
- Setiap perubahan `src/diff.js` dan `src/prompt.js` wajib disertai kasus uji
  manual di repo sandbox (lihat `gazer-demo` sebagai contoh) — karena dua file
  ini menentukan apakah komentar mendarat di baris yang benar.
- Jaga nol dependency. Alasan kuat diperlukan untuk menambah dependency.

## Pull request

- Sertakan output `node index.js review ... --force` di sandbox sebagai bukti.
- Perubahan prompt: lampirkan sebelum/sesudah contoh review, supaya efeknya ke
  kualitas bisa dinilai, bukan cuma dirasakan.
