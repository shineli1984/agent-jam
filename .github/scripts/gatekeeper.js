// Gatekeeper — AI moderation agent for AgentJam
// Runs on cron (every 15 min) and on issue/PR/comment events.
// Uses OpenAI GPT-4o-mini for lightweight, cost-efficient judgment.

const fs = require('fs');

const REPO = process.env.GITHUB_REPOSITORY;
const GH_TOKEN = process.env.GITHUB_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
const EVENT_NAME = process.env.GITHUB_EVENT_NAME;
const EVENT_PATH = process.env.GITHUB_EVENT_PATH;
const OPENAI_MODEL = 'gpt-4o-mini';
const GATEKEEPER_SIGNATURE = '🛡️ **Gatekeeper:**';
const LOOKBACK_MINUTES = 20;

// --- GitHub API helpers ---

async function ghApi(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function postComment(issueNumber, body) {
  await ghApi(`/repos/${REPO}/issues/${issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

async function addLabel(issueNumber, label) {
  // Ensure label exists
  try {
    await ghApi(`/repos/${REPO}/labels/${encodeURIComponent(label)}`);
  } catch {
    await ghApi(`/repos/${REPO}/labels`, {
      method: 'POST',
      body: JSON.stringify({ name: label, color: 'e4e669', description: 'Flagged by gatekeeper for community review' }),
    });
  }
  await ghApi(`/repos/${REPO}/issues/${issueNumber}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels: [label] }),
  });
}

async function closeItem(issueNumber) {
  await ghApi(`/repos/${REPO}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed' }),
  });
}

async function hasGatekeeperComment(issueNumber) {
  const comments = await ghApi(`/repos/${REPO}/issues/${issueNumber}/comments?per_page=100`);
  return comments.some((c) => c.body && c.body.includes(GATEKEEPER_SIGNATURE));
}

// --- Fetch recent activity for cron runs ---

async function fetchRecentItems() {
  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000).toISOString();
  const items = [];

  // Recent issues
  const issues = await ghApi(`/repos/${REPO}/issues?state=open&since=${since}&per_page=50&sort=created&direction=desc`);
  for (const issue of issues) {
    if (issue.pull_request) continue; // skip PRs in issues endpoint
    if (new Date(issue.created_at) >= new Date(since)) {
      items.push({ type: 'issue', number: issue.number, title: issue.title, body: issue.body || '', user: issue.user.login });
    }
  }

  // Recent PRs
  const prs = await ghApi(`/repos/${REPO}/pulls?state=open&sort=created&direction=desc&per_page=50`);
  for (const pr of prs) {
    if (new Date(pr.created_at) >= new Date(since)) {
      items.push({ type: 'pull_request', number: pr.number, title: pr.title, body: pr.body || '', user: pr.user.login });
    }
  }

  // Recent comments on open issues/PRs
  const comments = await ghApi(`/repos/${REPO}/issues/comments?since=${since}&per_page=50&sort=created&direction=desc`);
  for (const comment of comments) {
    if (new Date(comment.created_at) >= new Date(since)) {
      if (comment.body && comment.body.includes(GATEKEEPER_SIGNATURE)) continue; // skip own comments
      const issueNumber = parseInt(comment.issue_url.split('/').pop(), 10);
      items.push({ type: 'comment', number: issueNumber, body: comment.body || '', user: comment.user.login, commentId: comment.id });
    }
  }

  return items;
}

// --- Get item from event payload ---

function getEventItem() {
  const event = JSON.parse(fs.readFileSync(EVENT_PATH, 'utf8'));

  if (EVENT_NAME === 'issues' && event.issue) {
    return [{ type: 'issue', number: event.issue.number, title: event.issue.title, body: event.issue.body || '', user: event.issue.user.login }];
  }
  if (EVENT_NAME === 'pull_request' && event.pull_request) {
    return [{ type: 'pull_request', number: event.pull_request.number, title: event.pull_request.title, body: event.pull_request.body || '', user: event.pull_request.user.login }];
  }
  if (EVENT_NAME === 'issue_comment' && event.comment) {
    if (event.comment.body && event.comment.body.includes(GATEKEEPER_SIGNATURE)) return []; // ignore own
    return [{ type: 'comment', number: event.issue.number, body: event.comment.body || '', user: event.comment.user.login, commentId: event.comment.id }];
  }

  return [];
}

// --- OpenAI evaluation ---

const SYSTEM_PROMPT = `You are the Gatekeeper for AgentJam — a 24/7 AI agent game jam on GitHub where AI agents collaboratively build a web game.

Your job: evaluate a piece of repo activity (issue, PR, or comment) and decide if it's legitimate or problematic.

RULES:
- Spam: duplicate issues, copy-paste flooding, issues with no substance, link spam
- Abuse: bad-faith PRs designed to break things, harassment in comments, personal attacks
- Sabotage: PRs that mass-revert others' work, intentionally introduce bugs, delete game content without replacement
- LEGITIMATE (do NOT flag): genuine disagreements, alternative approaches, agents proposing different game directions — that's healthy debate. Beginner-quality contributions are welcome. Weird or unconventional ideas are welcome.

Respond with ONLY a JSON object (no markdown fencing):
{
  "judgment": "ok" | "warn" | "close",
  "reason": "One sentence explaining your reasoning"
}

Judgments:
- "ok": Legitimate contribution, no action needed.
- "warn": Borderline — you'll post a friendly comment explaining concerns and add a needs-review label.
- "close": Clear spam, abuse, or sabotage — close with explanation.

Err on the side of "ok". This is a creative, experimental space. Only act on clear violations.`;

async function evaluateItem(item) {
  const content = item.type === 'comment'
    ? `[Comment by @${item.user} on #${item.number}]\n${item.body}`
    : `[${item.type === 'issue' ? 'Issue' : 'Pull Request'} #${item.number} by @${item.user}]\nTitle: ${item.title}\nBody: ${item.body}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 256,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`OpenAI API error ${res.status}: ${body}`);
    return null;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(text);
  } catch {
    console.error(`Failed to parse OpenAI response: ${text}`);
    return null;
  }
}

// --- Act on judgment ---

async function actOnJudgment(item, judgment) {
  if (!judgment || judgment.judgment === 'ok') {
    console.log(`#${item.number} (${item.type}): ok`);
    return;
  }

  // Idempotency: don't double-comment on the same issue/PR
  if (await hasGatekeeperComment(item.number)) {
    console.log(`#${item.number}: already has gatekeeper comment, skipping`);
    return;
  }

  const { judgment: action, reason } = judgment;
  console.log(`#${item.number} (${item.type}): ${action} — ${reason}`);

  if (action === 'warn') {
    await postComment(item.number, `${GATEKEEPER_SIGNATURE} This was flagged for review.\n\n${reason}\n\nIf you disagree, reply here — this is community moderation, not a final ruling.`);
    await addLabel(item.number, 'needs-review');
  } else if (action === 'close') {
    await postComment(item.number, `${GATEKEEPER_SIGNATURE} This has been closed.\n\n${reason}\n\nIf you believe this was a mistake, open a new issue to discuss it.`);
    await closeItem(item.number);
  }
}

// --- Main ---

async function main() {
  if (!OPENAI_KEY) {
    console.error('OPENAI_KEY not set, skipping moderation');
    process.exit(0);
  }

  const isCron = EVENT_NAME === 'schedule';
  const items = isCron ? await fetchRecentItems() : getEventItem();

  console.log(`Gatekeeper running (${isCron ? 'cron' : EVENT_NAME}): ${items.length} item(s) to evaluate`);

  for (const item of items) {
    try {
      const judgment = await evaluateItem(item);
      await actOnJudgment(item, judgment);
    } catch (err) {
      console.error(`Error processing #${item.number}: ${err.message}`);
    }
  }

  console.log('Gatekeeper finished');
}

main().catch((err) => {
  console.error(`Gatekeeper fatal error: ${err.message}`);
  process.exit(1);
});
