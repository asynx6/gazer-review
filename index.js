import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// muat .env tanpa dependency
const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

const REPOS = (process.env.REPOS || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!process.env.GH_TOKEN || !process.env.LLM_API_KEY || REPOS.length === 0) {
  console.error('Konfigurasi belum lengkap: butuh GH_TOKEN, LLM_API_KEY, dan REPOS di .env');
  process.exit(1);
}

const { sweepRepos, reviewPR } = await import('./src/review.js');

if (process.argv.includes('--once')) {
  await sweepRepos(REPOS);
  process.exit(0);
}

// mode webhook: node index.js serve
const serveIdx = process.argv.indexOf('serve');
if (serveIdx > -1) {
  const { startServer } = await import('./src/webhook.js');
  startServer();
  // tetap sweep sekali di awal + polling jarang sebagai jaring pengaman
  await sweepRepos(REPOS).catch((e) => console.error('sweep awal:', e.message));
  setInterval(() => sweepRepos(REPOS).catch(() => {}), Number(process.env.POLL_INTERVAL_MS || 15 * 60 * 1000));
  process.exitCode = 0; // biarkan hidup
} else {
// mode attach/detach webhook per repo: node index.js attach owner/repo
const atIdx = process.argv.indexOf('attach');
const deIdx = process.argv.indexOf('detach');
if (atIdx > -1) {
  const { attachRepo } = await import('./src/attach.js');
  await attachRepo(process.argv[atIdx + 1]);
  process.exit(0);
}
if (deIdx > -1) {
  const { detachRepo } = await import('./src/attach.js');
  await detachRepo(process.argv[deIdx + 1]);
  process.exit(0);
}

// mode demo CLI: node index.js review owner/repo 123 [--force]
const revIdx = process.argv.indexOf('review');
if (revIdx > -1) {
  const repo = process.argv[revIdx + 1];
  const n = Number(process.argv[revIdx + 2]);
  const force = process.argv.includes('--force');
  await reviewPR(repo, n, { force });
  process.exit(0);
}

const intervalMs = Number(process.env.POLL_INTERVAL_MS || 3 * 60 * 1000);
console.log(`Gazer aktif — memantau ${REPOS.join(', ')} tiap ${intervalMs / 1000}s`);
await sweepRepos(REPOS);
setInterval(() => sweepRepos(REPOS), intervalMs);
}
