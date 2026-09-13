# Changelog
Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/), project ini memakai [Semantic Versioning](https://semver.org/lang/id/).

## [0.5.0] - 2026-09-13
### Added
- **Re-review INCREMENTAL**: setelah review pertama, commit berikutnya hanya mengirim diff sha-terakhir→head (`GET /compare`) — PR yang di-push berulang tidak lagi membengkak (terbukti 16KB → 5.4KB, dan ronde yang timeout 3x jadi selesai <1 menit)
- Prompt mode incremental: larangan mengulang temuan yang sudah pernah dikomentari
### Fixed
- Timeout LLM default 90s terlalu kecil untuk diff >12KB → 180s
- Validasi baris saat incremental memakai diff penuh (nomor baris GitHub relatif ke head), konten tetap diff kecil

## [0.4.1] - 2026-09-13
### Added
- Auto-label PR: `gazer/security`, `gazer/request-changes`, `gazer/high-priority` (label dibuat otomatis, murni dari `src/labels.js` yang teruji)
- `Dockerfile` + `docker-compose.yml` — deploy sekali jalan
- `SECURITY.md`, issue & PR template
- Timeout LLM 90s + retry otomatis untuk kegagalan jaringan/429/5xx
- Test bertambah jadi 17 kasus (labels, truncation prompt)

### Fixed
- Race condition: dua webhook untuk PR sama sekarang digabung jadi satu review (`inFlight` guard)
- Filter komentar review lama pakai penanda tersembunyi, bukan kata 'Gazer' sembarang (tidak lagi mengancam komentar user yang menyebut Gazer)
- Truncation diff 60KB sekarang memotong di batas baris, bukan tengah baris

## [0.4.0] - 2026-09-13
### Added
- Filter noise diff: lockfile/vendor/dist/binary tidak dikirim ke model
- Config `gazer.json` per-repo (dibaca dari branch target, anti prompt-injection)
- Unit test runner zero-dep + CI matrix Node 18/20/22
### Changed
- Config parse gagal jadi terlihat di log, bukan silent

## [0.3.0] - 2026-09-13
### Added
- Webhook real-time HMAC (`serve` + `attach`/`detach`), polling cadangan 15 menit

## [0.2.0] - 2026-09-13
### Added
- Inline comment baris-per-baris + verdict review + line validator dengan auto-nudge

## [0.1.0] - 2026-09-13
### Added
- Review PR polling + komentar markdown Bahasa Indonesia
