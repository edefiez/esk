import { getConfig } from './config.js';

const GH_API = 'https://api.github.com';
// GitHub OAuth App "esk" Client ID — replace with the real one after creation
const ESK_CLIENT_ID = 'Ov23liXXXXXXXXXXXXXX';

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * GitHub Device Flow OAuth
 * Returns the access token after browser authorization
 */
export async function githubDeviceFlow() {
  // 1. Request a device code
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: ESK_CLIENT_ID,
      scope: 'repo read:user'
    })
  });
  const data = await res.json();
  const { device_code, user_code, verification_uri, expires_in, interval } = data;

  return {
    userCode: user_code,
    verificationUri: verification_uri,
    expiresIn: expires_in,
    // Poll function — call in a loop until the token is obtained
    poll: async () => {
      const pollRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: ESK_CLIENT_ID,
          device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      });
      const pollData = await pollRes.json();
      if (pollData.access_token) return pollData.access_token;
      if (pollData.error === 'authorization_pending') return null;
      throw new Error(pollData.error_description || pollData.error);
    },
    interval
  };
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function ghFetch(path, options = {}) {
  const config = await getConfig();
  const token = config.github?.token;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };
  const res = await fetch(`${GH_API}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status}: ${err.message || path}`);
  }
  return res.json();
}

export async function getAuthenticatedUser() {
  return ghFetch('/user');
}

export async function checkRepoAccess(repo) {
  return ghFetch(`/repos/${repo}`);
}

// ─── Registry / files ───────────────────────────────────────────────────────

export async function getRegistryJson(repo) {
  try {
    const data = await ghFetch(`/repos/${repo}/contents/registry.json`);
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    return { registry: JSON.parse(content), sha: data.sha };
  } catch {
    return { registry: null, sha: null };
  }
}

export async function updateRegistryJson(repo, registry, sha) {
  const content = Buffer.from(JSON.stringify(registry, null, 2)).toString('base64');
  return ghFetch(`/repos/${repo}/contents/registry.json`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'chore: update registry.json [esk]',
      content,
      sha
    })
  });
}

export async function getFileContent(repo, path) {
  try {
    const data = await ghFetch(`/repos/${repo}/contents/${path}`);
    return {
      content: Buffer.from(data.content, 'base64').toString('utf8'),
      sha: data.sha
    };
  } catch {
    return { content: null, sha: null };
  }
}

export async function createOrUpdateFile(repo, path, content, message, sha = null) {
  const encoded = Buffer.from(content).toString('base64');
  const body = { message, content: encoded };
  if (sha) body.sha = sha;
  return ghFetch(`/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Multi-source skill search
 * sources: array of configured sources
 */
export async function searchSkillsMultiSource(query, sources) {
  const results = [];

  for (const source of sources.filter(s => s.enabled)) {
    try {
      let repos = [];

      if (source.type === 'github-repo') {
        if (source.repo) repos = [{ full_name: source.repo, label: source.label }];
      } else if (source.type === 'github-topic') {
        const data = await ghFetch(
          `/search/repositories?q=${encodeURIComponent(query + ' topic:' + source.topic)}&per_page=10`
        );
        repos = data.items.map(r => ({ full_name: r.full_name, stars: r.stargazers_count, label: source.label }));
      } else if (source.type === 'github-topics') {
        const topicQuery = source.topics.map(t => `topic:${t}`).join('+');
        const data = await ghFetch(
          `/search/repositories?q=${encodeURIComponent(query)}+${topicQuery}&per_page=10`
        );
        repos = data.items.map(r => ({ full_name: r.full_name, stars: r.stargazers_count, label: source.label }));
      }

      // For each repo found, read its registry.json
      for (const repo of repos) {
        const { registry } = await getRegistryJson(repo.full_name).catch(() => ({ registry: null }));
        if (!registry?.skills) continue;
        const matchingSkills = registry.skills.filter(s =>
          s.id?.toLowerCase().includes(query.toLowerCase()) ||
          s.label?.toLowerCase().includes(query.toLowerCase()) ||
          s.description?.toLowerCase().includes(query.toLowerCase())
        );
        for (const skill of matchingSkills) {
          results.push({
            ...skill,
            sourceId: source.id,
            sourceLabel: repo.label || source.label,
            repo: repo.full_name,
            stars: repo.stars || 0,
            trusted: source.trusted || false
          });
        }
      }
    } catch {
      // Source unavailable — continue without error
    }
  }

  // Deduplicate by skill id + repo
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.repo}::${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
