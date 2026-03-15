import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { cacheGet, cacheSet } from './redis';

// ─── GitHub App client (singleton) ─────────────────────────────────────────

let _app: App | null = null;

function getApp(): App {
  if (_app) return _app;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!appId || !privateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set to use GitHub App features');
  }

  _app = new App({ appId, privateKey });
  return _app;
}

// ─── Unauthenticated fallback (read-only public data) ───────────────────────

function getPublicOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  return new Octokit({ auth: token });
}

// ─── Installation token (cached) ────────────────────────────────────────────

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const cacheKey = `gh:install:${installationId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    const { token } = JSON.parse(cached) as { token: string };
    return new Octokit({ auth: token });
  }

  const app = getApp();
  const octokit = await app.getInstallationOctokit(installationId);
  // Cache for 55 minutes (tokens last 60 min)
  const { token } = (await octokit.auth({ type: 'installation' })) as { token: string };
  await cacheSet(cacheKey, JSON.stringify({ token }), 55 * 60);
  return octokit;
}

// ─── Get the best available Octokit ─────────────────────────────────────────

export async function getOctokit(installationId?: number): Promise<Octokit> {
  if (installationId) {
    try {
      return await getInstallationOctokit(installationId);
    } catch {
      // fall through to public
    }
  }
  // Try App-level auth first
  try {
    const app = getApp();
    // Get first installation
    const { data: installations } = await app.octokit.request('GET /app/installations', {
      per_page: 1,
    });
    if (installations.length > 0) {
      return await getInstallationOctokit(installations[0].id);
    }
  } catch {
    // fall through
  }
  return getPublicOctokit();
}

// ─── List App installations ──────────────────────────────────────────────────

export async function listInstallations() {
  const app = getApp();
  const { data } = await app.octokit.request('GET /app/installations');
  return data;
}

// ─── Repositories ────────────────────────────────────────────────────────────

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  updated_at: string | null;
}

export async function listRepos(installationId?: number): Promise<GitHubRepo[]> {
  const octokit = await getOctokit(installationId);
  if (installationId) {
    const { data } = await octokit.request('GET /installation/repositories', { per_page: 100 });
    return data.repositories as GitHubRepo[];
  }
  const { data } = await octokit.repos.listForAuthenticatedUser({ per_page: 100, sort: 'updated' });
  return data as GitHubRepo[];
}

export async function getRepo(owner: string, repo: string, installationId?: number) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.repos.get({ owner, repo });
  return data;
}

// ─── Issues ──────────────────────────────────────────────────────────────────

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user: { login: string } | null;
  labels: { name?: string }[];
  created_at: string;
  updated_at: string;
}

export async function listIssues(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  installationId?: number,
): Promise<GitHubIssue[]> {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.issues.listForRepo({ owner, repo, state, per_page: 50 });
  return data.filter((i) => !i.pull_request) as GitHubIssue[];
}

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[],
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.issues.create({ owner, repo, title, body, labels });
  return data;
}

export async function commentOnIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  return data;
}

export async function closeIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' });
  return data;
}

// ─── Pull Requests ────────────────────────────────────────────────────────────

export async function listPullRequests(
  owner: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open',
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.pulls.list({ owner, repo, state, per_page: 30 });
  return data;
}

export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body: string,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.pulls.create({ owner, repo, title, head, base, body });
  return data;
}

export async function mergePullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  mergeMethod: 'merge' | 'squash' | 'rebase' = 'squash',
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: mergeMethod });
  return data;
}

// ─── File Contents ────────────────────────────────────────────────────────────

export async function getFileContents(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
  installationId?: number,
): Promise<{ content: string; sha: string; encoding: string }> {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  if (Array.isArray(data)) throw new Error('Path is a directory, not a file');
  const file = data as { content?: string; sha: string; encoding: string };
  return {
    content: file.content ? Buffer.from(file.content, 'base64').toString('utf8') : '',
    sha: file.sha,
    encoding: file.encoding,
  };
}

export async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  message: string,
  content: string,
  sha?: string,
  branch?: string,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const encoded = Buffer.from(content, 'utf8').toString('base64');
  const params: Parameters<typeof octokit.repos.createOrUpdateFileContents>[0] = {
    owner,
    repo,
    path,
    message,
    content: encoded,
  };
  if (sha) params.sha = sha;
  if (branch) params.branch = branch;
  const { data } = await octokit.repos.createOrUpdateFileContents(params);
  return data;
}

export async function listBranches(owner: string, repo: string, installationId?: number) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.repos.listBranches({ owner, repo, per_page: 50 });
  return data;
}

export async function createBranch(
  owner: string,
  repo: string,
  branchName: string,
  fromSha: string,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: fromSha,
  });
  return data;
}

// ─── Workflows ────────────────────────────────────────────────────────────────

export async function listWorkflows(owner: string, repo: string, installationId?: number) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.actions.listRepoWorkflows({ owner, repo });
  return data.workflows;
}

export async function triggerWorkflow(
  owner: string,
  repo: string,
  workflowId: string | number,
  ref: string,
  inputs: Record<string, string> = {},
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  await octokit.actions.createWorkflowDispatch({ owner, repo, workflow_id: workflowId, ref, inputs });
  return { triggered: true, workflow: workflowId, ref };
}

export async function getWorkflowRuns(
  owner: string,
  repo: string,
  workflowId?: string | number,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  if (workflowId) {
    const { data } = await octokit.actions.listWorkflowRuns({ owner, repo, workflow_id: workflowId, per_page: 10 });
    return data.workflow_runs;
  }
  const { data } = await octokit.actions.listWorkflowRunsForRepo({ owner, repo, per_page: 10 });
  return data.workflow_runs;
}

// ─── Code Search ─────────────────────────────────────────────────────────────

export async function searchCode(query: string, installationId?: number) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.search.code({ q: query, per_page: 20 });
  return data.items.map((item) => ({
    name: item.name,
    path: item.path,
    repository: item.repository.full_name,
    html_url: item.html_url,
    score: item.score,
  }));
}

export async function searchRepositories(query: string, installationId?: number) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.search.repos({ q: query, sort: 'stars', per_page: 20 });
  return data.items.map((r) => ({
    full_name: r.full_name,
    description: r.description,
    html_url: r.html_url,
    stargazers_count: r.stargazers_count,
    language: r.language,
  }));
}

// ─── Releases ────────────────────────────────────────────────────────────────

export async function listReleases(owner: string, repo: string, installationId?: number) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.repos.listReleases({ owner, repo, per_page: 10 });
  return data;
}

export async function createRelease(
  owner: string,
  repo: string,
  tagName: string,
  name: string,
  body: string,
  draft = false,
  prerelease = false,
  installationId?: number,
) {
  const octokit = await getOctokit(installationId);
  const { data } = await octokit.repos.createRelease({ owner, repo, tag_name: tagName, name, body, draft, prerelease });
  return data;
}

// ─── App metadata ────────────────────────────────────────────────────────────

export async function getAppInfo() {
  const app = getApp();
  const { data } = await app.octokit.request('GET /app');
  return data;
}

export function isConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}
