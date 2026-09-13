import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const GH = 'https://api.github.com';
const STATE = new URL('../.gazer-webhooks.json', import.meta.url);

export function loadWebhookState() {
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    return {};
  }
}

function saveWebhookState(st) {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
}

async function ghApi(path, opts = {}) {
  const res = await fetch(GH + path, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${process.env.GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${text.slice(0, 200)}`);
  return res.status === 204 ? null : JSON.parse(text);
}

export async function attachRepo(repo) {
  const url = process.env.WEBHOOK_URL;
  if (!url) throw new Error('WEBHOOK_URL belum diset di .env (mis. http://8.215.85.186/webhook)');
  if (!repo) throw new Error('Usage: node index.js attach owner/repo');

  const st = loadWebhookState();
  const secret = st.secret || randomBytes(24).toString('hex');
  st.secret = secret;

  const hooks = await ghApi(`/repos/${repo}/hooks`);
  const existing = (hooks || []).find((h) => h.config?.url === url);
  if (existing) {
    await ghApi(`/repos/${repo}/hooks/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ config: { ...existing.config, secret }, events: ['pull_request'] }),
    });
    console.log(`↻ webhook untuk ${repo} diperbarui`);
  } else {
    await ghApi(`/repos/${repo}/hooks`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['pull_request'],
        config: { url, content_type: 'json', secret, insecure_ssl: '0' },
      }),
    });
    console.log(`+ webhook untuk ${repo} dibuat → ${url}`);
  }

  // pastikan repo ikut dipantau sweep juga (belt & suspenders)
  st.repos = Array.from(new Set([...(st.repos || []), repo]));
  saveWebhookState(st);
}

export async function detachRepo(repo) {
  const url = process.env.WEBHOOK_URL;
  const hooks = await ghApi(`/repos/${repo}/hooks`).catch(() => []);
  const existing = (hooks || []).find((h) => h.config?.url === url);
  if (existing) {
    await ghApi(`/repos/${repo}/hooks/${existing.id}`, { method: 'DELETE' });
    console.log(`- webhook ${repo} dihapus`);
  } else {
    console.log(`tidak ada webhook di ${repo}`);
  }
}
