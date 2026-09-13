import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadWebhookState } from './attach.js';
import { reviewPR } from './review.js';

function getSecret() {
  return process.env.WEBHOOK_SECRET || loadWebhookState().secret || '';
}

function verify(sig, body) {
  const secret = getSecret();
  if (!sig || !secret) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handleEvent(event, payload) {
  if (event === 'ping') {
    console.log('[webhook] ping diterima — koneksi hidup');
    return;
  }
  if (event !== 'pull_request') return;
  const repo = payload.repository?.full_name;
  const n = payload.pull_request?.number;
  const action = payload.action;
  if (!repo || !n) return;
  if (!['opened', 'reopened', 'synchronize', 'ready_for_review'].includes(action)) return;
  console.log(`[webhook] ${action} → ${repo}#${n}`);
  await reviewPR(repo, n);
}

export function startServer(port = Number(process.env.WEBHOOK_PORT || 80)) {
  if (!getSecret()) {
    console.warn('PERINGATAN: WEBHOOK_SECRET kosong — webhook tak akan lolos verifikasi. Jalankan `node index.js attach <repo>` dulu.');
  }
  const server = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/healthz')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bot: 'gazer' }));
      return;
    }
    if (req.method === 'POST' && req.url === '/webhook') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks);
        if (!verify(req.headers['x-hub-signature-256'], raw)) {
          res.writeHead(401);
          res.end('bad signature');
          return;
        }
        let payload;
        try {
          payload = JSON.parse(raw.toString('utf8'));
        } catch {
          res.writeHead(400);
          res.end('bad json');
          return;
        }
        // respons cepat; review jalan async
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ accepted: true }));
        handleEvent(req.headers['x-github-event'], payload).catch((e) =>
          console.error('[webhook] error:', e.message)
        );
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  server.listen(port, () => console.log(`Gazer webhook server mendengarkan port ${port}`));
  return server;
}
