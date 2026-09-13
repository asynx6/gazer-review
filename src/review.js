import { chat } from './llm.js';
import { SYSTEM_PROMPT, userPrompt } from './prompt.js';
import * as gh from './github.js';
import { readFileSync, writeFileSync } from 'node:fs';

const SIGNATURE = '<!-- gazer-review-bot -->';
const STATE_FILE = new URL('../.gazer-state.json', import.meta.url);

function loadSeen() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
}
function saveSeen(seen) {
  try { writeFileSync(STATE_FILE, JSON.stringify(seen, null, 1)); } catch { /* best-effort */ }
}

const seen = loadSeen();

export async function reviewPR(repo, prNumber, { force = false } = {}) {
  const pr = await gh.getPR(repo, prNumber);
  if (!pr || pr.draft) return;

  const key = `${repo}#${prNumber}`;
  const headSha = pr.head?.sha;
  if (!force && seen[key] === headSha) return; // sudah direview, tidak ada commit baru

  const diff = await gh.fetchDiff(repo, prNumber);
  if (!diff || diff.trim().length === 0) return;

  console.log(`[${new Date().toISOString()}] reviewing ${key} (${diff.length} bytes diff)...`);
  let review;
  try {
    review = await chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt(pr, diff) },
    ], { temperature: 0.3, maxTokens: 1500 });
  } catch (e) {
    console.error(`  LLM failed for ${key}: ${e.message}`);
    return;
  }

  const body = `${review}\n\n---\n<sub>Direview otomatis oleh 🟢 <b>Gazer</b> · ${headSha?.slice(0, 7)} · PR akan direview ulang kalau ada commit baru.</sub>\n${SIGNATURE}`;

  // update komentar lama kalau ada, kalau tidak bikin baru
  const comments = await gh.getComments(repo, prNumber);
  const mine = comments?.find((c) => (c.body || '').includes(SIGNATURE));
  if (mine) {
    await gh.updateComment(repo, mine.id, body);
    console.log(`  updated comment #${mine.id}`);
  } else {
    await gh.postComment(repo, prNumber, body);
    console.log(`  posted new comment`);
  }
  seen[key] = headSha;
  saveSeen(seen);
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
