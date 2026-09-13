import { chat } from './llm.js';
import { SYSTEM_PROMPT, userPrompt, parseReview } from './prompt.js';
import { parseAddedLines, validateComments, filterDiff } from './diff.js';
import { repoConfig } from './config.js';
import * as gh from './github.js';
import { readFileSync, writeFileSync } from 'node:fs';

const SIGNATURE = '<!-- gazer-review-bot -->';
const STATE_DIR = process.env.GAZER_STATE_DIR || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const STATE_FILE = `${STATE_DIR}/.gazer-state.json`.replace(/^\/([A-Za-z]:)/, '$1');
const SEV_ICON = { critical: '🔴', high: '🟠', minor: '🟡' };
const EVENT = { approve: 'APPROVE', comment: 'COMMENT', request_changes: 'REQUEST_CHANGES' };

function loadSeen() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveSeen(seen) {
  try { writeFileSync(STATE_FILE, JSON.stringify(seen, null, 1)); } catch { /* best-effort */ }
}

const seen = loadSeen();

function renderSummary(pr, review, headSha) {
  const lines = [];
  lines.push(`## 🔍 Review Gazer`);
  lines.push('');
  lines.push(`**Verdict:** ${verdictLabel(review.verdict)} — ${review.summary || ''}`);
  if (review.general) { lines.push(''); lines.push(review.general); }
  if (review.inline?.length) {
    lines.push('');
    lines.push(`Catatan baris-per-baris ada di tab **Files** (${review.inline.length} komentar):`);
    for (const c of review.inline) {
      lines.push(`- ${SEV_ICON[c.severity] || '🟢'} \`${c.path}:${c.line}\` — **${c.title || 'catatan'}**`);
    }
  }
  lines.push('');
  lines.push(`---\n<sub>Direview otomatis oleh 🟢 <b>Gazer</b> · ${headSha?.slice(0, 7)} · review ulang otomatis saat ada commit baru.</sub>\n${SIGNATURE}`);
  return lines.join('\n');
}

function verdictLabel(v) {
  return v === 'approve' ? '✅ APPROVE' : v === 'request_changes' ? '❌ REQUEST CHANGES' : '💬 COMMENT';
}

// hapus komentar review lama milik bot (pakai penanda, bukan kata 'Gazer' sembarang)
async function cleanOldComments(repo, prNumber) {
  try {
    const old = await gh.listReviewComments(repo, prNumber);
    for (const c of old || []) {
      if ((c.body || '').includes(SIGNATURE)) {
        await fetch(`https://api.github.com/repos/${repo}/pulls/comments/${c.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${process.env.GH_TOKEN}`, 'Accept': 'application/vnd.github+json' },
        });
      }
    }
  } catch { /* cleanup tidak fatal */ }
}

const inFlight = new Set(); // kunci repo#pr yang sedang direview → cegah webhook dobel

export async function reviewPR(repo, prNumber, { force = false } = {}) {
  const key = `${repo}#${prNumber}`;
  if (inFlight.has(key)) {
    console.log(`  ${key}: review sedang jalan, lewati`);
    return;
  }
  inFlight.add(key);
  try {
    return await doReview(repo, prNumber, key, force);
  } finally {
    inFlight.delete(key);
  }
}

async function doReview(repo, prNumber, key, force) {
  const pr = await gh.getPR(repo, prNumber);
  if (!pr || pr.draft) return;

  const headSha = pr.head?.sha;
  if (!force && seen[key] === headSha) return; // sudah direview, tidak ada commit baru

  const diff0 = await gh.fetchDiff(repo, prNumber);
  if (!diff0 || diff0.trim().length === 0) return;

  // buang noise: lockfile, vendor, dist, minified, binary → hemat token, fokus review
  const cfg = (await repoConfig(repo, pr.base?.ref)) || {};
  const { diff, skipped } = filterDiff(diff0, cfg.ignore);
  if (!diff.trim()) {
    console.log(`  ${key}: semua file termasuk noise (lockfile/vendor) — skip, hemat token`);
    seen[key] = headSha;
    saveSeen(seen);
    return;
  }

  console.log(`[${new Date().toISOString()}] reviewing ${key} (${diff.length} bytes diff${skipped.length ? `, ${skipped.length} file noise dilewati` : ''})...`);
  let raw;
  try {
    raw = await chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(pr, diff, cfg) },
    ], { temperature: 0.3, maxTokens: 2500 });
  } catch (e) {
    console.error(`  LLM failed for ${key}: ${e.message}`);
    return;
  }

  let review = parseReview(raw);
  if (!review || !Array.isArray(review.inline)) {
    // retry sekali dengan penekanan JSON
    try {
      raw = await chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(pr, diff, cfg) },
        { role: 'user', content: 'Keluaran sebelumnya bukan JSON valid. Ulangi, HANYA JSON objek, tanpa teks lain.' },
      ], { temperature: 0.1, maxTokens: 2500 });
      review = parseReview(raw);
    } catch { /* lanjut */ }
  }
  if (!review || !Array.isArray(review.inline)) {
    console.error(`  gagal parse JSON review untuk ${key}`);
    return;
  }

  // validasi line: hanya boleh menunjuk baris '+' yang ada di diff
  const addedMap = parseAddedLines(diff);
  const valid = validateComments(review.inline, addedMap).slice(0, cfg.maxComments || 8);
  const comments = valid.map((c) => ({
    path: c.path,
    line: c.line,
    body: `${SEV_ICON[c.severity] || '🟢'} **${c.title || c.severity || 'catatan'}**\n\n${c.body || ''}\n\n<sub>— Gazer${c.nudged ? ' (line disesuaikan ke baris `+` terdekat)' : ''}</sub>\n${SIGNATURE}`,
  }));
  review.inline = valid;

  // komentar lama milik bot di PR ini dibersihkan biar nggak dobel per commit
  await cleanOldComments(repo, prNumber);

  const summary = renderSummary(pr, review, headSha);

  async function send(event) {
    if (comments.length > 0) {
      await gh.createReview(repo, prNumber, { commit_id: headSha, body: summary, event, comments });
      console.log(`  posted review dengan ${comments.length} inline comment (${event})`);
    } else {
      await gh.createReview(repo, prNumber, { commit_id: headSha, body: summary, event });
      console.log(`  posted review (tanpa inline, ${event})`);
    }
  }

  try {
    await send(EVENT[review.verdict] || 'COMMENT');
  } catch (e) {
    if (String(e.message).includes('your own')) {
      // GitHub melarang approve/request_changes pada PR milik sendiri → COMMENT saja
      try {
        await send('COMMENT');
      } catch (e2) {
        console.error(`  COMMENT juga gagal: ${e2.message}`);
        return;
      }
    } else {
      console.error(`  posting review gagal: ${e.message} — fallback ke issue comment`);
      try {
        const issues = await gh.getComments(repo, prNumber);
        const mine = issues?.find((c) => (c.body || '').includes(SIGNATURE));
        if (mine) await gh.updateComment(repo, mine.id, summary);
        else await gh.postComment(repo, prNumber, summary);
      } catch (e2) {
        console.error(`  fallback juga gagal: ${e2.message}`);
        return; // jangan tandai seen → retry di siklus berikutnya
      }
    }
  }

  seen[key] = headSha;
  saveSeen(seen);

  // auto-label (non-fatal)
  try {
    const { decideLabels, applyLabels } = await import('./labels.js');
    const names = decideLabels(review.inline, review.verdict);
    if (names.length) {
      await applyLabels(repo, prNumber, names);
      console.log(`  label: ${names.join(', ')}`);
    }
  } catch (e) {
    console.error(`  label gagal (non-fatal): ${e.message}`);
  }
}

export async function sweepRepos(repos) {
  for (const repo of repos) {
    try {
      const prs = await gh.listOpenPRs(repo);
      for (const pr of prs || []) {
        await reviewPR(repo, pr.number);
      }
    } catch (e) {
      console.error(`  sweep ${repo} failed: ${e.message}`);
    }
  }
}

export { loadSeen, saveSeen, seen };
