const GH = 'https://api.github.com';
const token = process.env.GH_TOKEN;

async function req(path, opts = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return null;
  return res.json();
}

export const listOpenPRs = (repo) => req(`/repos/${repo}/pulls?state=open&per_page=20`);
export const getPR = (repo, n) => req(`/repos/${repo}/pulls/${n}`);
export const getComments = (repo, n) => req(`/repos/${repo}/issues/${n}/comments?per_page=50`);
export const postComment = (repo, n, body) => req(`/repos/${repo}/issues/${n}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
export const updateComment = (repo, id, body) => req(`/repos/${repo}/issues/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ body }) });

// diff via plain fetch with diff accept header
export async function fetchDiff(repo, n) {
  const res = await fetch(`${GH}/repos/${repo}/pulls/${n}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3.diff',
    },
  });
  if (!res.ok) throw new Error(`diff fetch ${res.status}`);
  return res.text();
}
