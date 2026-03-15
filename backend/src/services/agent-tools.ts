/**
 * Agent tool definitions — compatible with Groq / OpenAI function-calling API.
 * Each tool has a JSON schema and an executor that performs the real action.
 */

import * as gh from './github';
import { prisma } from '../db/prisma';
import { startScrapingJob } from './scraper';

// ─── Tool schema type ─────────────────────────────────────────────────────────

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export interface ToolCallResult {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  error?: string;
  durationMs: number;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
  // GitHub — Repositories
  {
    type: 'function',
    function: {
      name: 'github_list_repos',
      description: 'List GitHub repositories accessible to the XPS Orchestrator GitHub App',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_get_repo',
      description: 'Get details about a specific GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner (user or org)' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_search_repos',
      description: 'Search GitHub repositories by keyword',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (e.g. "machine learning stars:>1000")' },
        },
        required: ['query'],
      },
    },
  },
  // GitHub — Issues
  {
    type: 'function',
    function: {
      name: 'github_list_issues',
      description: 'List issues in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: { type: 'string', description: 'Issue state', enum: ['open', 'closed', 'all'] },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_issue',
      description: 'Create a new issue in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'Issue title' },
          body: { type: 'string', description: 'Issue body (markdown)' },
          labels: { type: 'string', description: 'Comma-separated list of label names' },
        },
        required: ['owner', 'repo', 'title', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_comment_issue',
      description: 'Add a comment to an existing GitHub issue or PR',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          issue_number: { type: 'string', description: 'Issue or PR number' },
          body: { type: 'string', description: 'Comment text (markdown)' },
        },
        required: ['owner', 'repo', 'issue_number', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_close_issue',
      description: 'Close an existing GitHub issue',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          issue_number: { type: 'string', description: 'Issue number' },
        },
        required: ['owner', 'repo', 'issue_number'],
      },
    },
  },
  // GitHub — Pull Requests
  {
    type: 'function',
    function: {
      name: 'github_list_prs',
      description: 'List pull requests in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          state: { type: 'string', description: 'PR state', enum: ['open', 'closed', 'all'] },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_create_pr',
      description: 'Create a new pull request',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'PR title' },
          head: { type: 'string', description: 'Head branch name' },
          base: { type: 'string', description: 'Base branch name (e.g. main)' },
          body: { type: 'string', description: 'PR description (markdown)' },
        },
        required: ['owner', 'repo', 'title', 'head', 'base', 'body'],
      },
    },
  },
  // GitHub — Files
  {
    type: 'function',
    function: {
      name: 'github_get_file',
      description: 'Read the contents of a file in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          path: { type: 'string', description: 'File path relative to repo root' },
          ref: { type: 'string', description: 'Branch, tag or commit SHA (optional)' },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_write_file',
      description: 'Create or update a file in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          path: { type: 'string', description: 'File path relative to repo root' },
          message: { type: 'string', description: 'Commit message' },
          content: { type: 'string', description: 'File content (plain text)' },
          branch: { type: 'string', description: 'Target branch (optional, defaults to default branch)' },
        },
        required: ['owner', 'repo', 'path', 'message', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_branches',
      description: 'List branches in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  // GitHub — Workflows
  {
    type: 'function',
    function: {
      name: 'github_list_workflows',
      description: 'List GitHub Actions workflows in a repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_trigger_workflow',
      description: 'Trigger a GitHub Actions workflow dispatch event',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          workflow_id: { type: 'string', description: 'Workflow file name (e.g. deploy.yml) or numeric ID' },
          ref: { type: 'string', description: 'Branch or tag to run on' },
          inputs: { type: 'string', description: 'JSON string of workflow inputs (optional)' },
        },
        required: ['owner', 'repo', 'workflow_id', 'ref'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_get_workflow_runs',
      description: 'Get recent workflow run results from GitHub Actions',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
          workflow_id: { type: 'string', description: 'Workflow file name or ID (optional)' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  // GitHub — Search
  {
    type: 'function',
    function: {
      name: 'github_search_code',
      description: 'Search code across GitHub repositories',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Code search query (e.g. "filename:package.json express")' },
        },
        required: ['query'],
      },
    },
  },
  // GitHub — Releases
  {
    type: 'function',
    function: {
      name: 'github_list_releases',
      description: 'List releases in a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner' },
          repo: { type: 'string', description: 'Repository name' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  // Leads tools
  {
    type: 'function',
    function: {
      name: 'leads_list',
      description: 'List all leads in the XPS Lead Intelligence database',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leads_create',
      description: 'Create a new lead in the database',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Lead email address' },
          name: { type: 'string', description: 'Lead full name' },
          company: { type: 'string', description: 'Company name' },
          phone: { type: 'string', description: 'Phone number' },
          website: { type: 'string', description: 'Company website URL' },
          source: { type: 'string', description: 'Lead source (e.g. github, linkedin)' },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leads_scrape',
      description: 'Start an autonomous lead scraping job from a specified source',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source to scrape (e.g. github, linkedin, producthunt)' },
        },
        required: ['source'],
      },
    },
  },
  // System tools
  {
    type: 'function',
    function: {
      name: 'system_get_connectors',
      description: 'Get the status of all system connectors (GitHub, Railway, Google, etc.)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ─── Tool executor ─────────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  const start = Date.now();

  try {
    let output: unknown;

    switch (toolName) {
      // ── GitHub repos ──
      case 'github_list_repos':
        output = await gh.listRepos();
        break;

      case 'github_get_repo':
        output = await gh.getRepo(args.owner as string, args.repo as string);
        break;

      case 'github_search_repos':
        output = await gh.searchRepositories(args.query as string);
        break;

      // ── GitHub issues ──
      case 'github_list_issues':
        output = await gh.listIssues(
          args.owner as string,
          args.repo as string,
          (args.state as 'open' | 'closed' | 'all') || 'open',
        );
        break;

      case 'github_create_issue': {
        const labels = args.labels
          ? (args.labels as string).split(',').map((l) => l.trim())
          : undefined;
        output = await gh.createIssue(
          args.owner as string,
          args.repo as string,
          args.title as string,
          args.body as string,
          labels,
        );
        break;
      }

      case 'github_comment_issue':
        output = await gh.commentOnIssue(
          args.owner as string,
          args.repo as string,
          parseInt(args.issue_number as string, 10),
          args.body as string,
        );
        break;

      case 'github_close_issue':
        output = await gh.closeIssue(
          args.owner as string,
          args.repo as string,
          parseInt(args.issue_number as string, 10),
        );
        break;

      // ── GitHub PRs ──
      case 'github_list_prs':
        output = await gh.listPullRequests(
          args.owner as string,
          args.repo as string,
          (args.state as 'open' | 'closed' | 'all') || 'open',
        );
        break;

      case 'github_create_pr':
        output = await gh.createPullRequest(
          args.owner as string,
          args.repo as string,
          args.title as string,
          args.head as string,
          args.base as string,
          args.body as string,
        );
        break;

      // ── GitHub files ──
      case 'github_get_file':
        output = await gh.getFileContents(
          args.owner as string,
          args.repo as string,
          args.path as string,
          args.ref as string | undefined,
        );
        break;

      case 'github_write_file': {
        // Try to get existing sha for update
        let sha: string | undefined;
        try {
          const existing = await gh.getFileContents(
            args.owner as string,
            args.repo as string,
            args.path as string,
            args.branch as string | undefined,
          );
          sha = existing.sha;
        } catch {
          // File doesn't exist yet — create
        }
        output = await gh.createOrUpdateFile(
          args.owner as string,
          args.repo as string,
          args.path as string,
          args.message as string,
          args.content as string,
          sha,
          args.branch as string | undefined,
        );
        break;
      }

      case 'github_list_branches':
        output = await gh.listBranches(args.owner as string, args.repo as string);
        break;

      // ── GitHub workflows ──
      case 'github_list_workflows':
        output = await gh.listWorkflows(args.owner as string, args.repo as string);
        break;

      case 'github_trigger_workflow': {
        let inputs: Record<string, string> = {};
        if (args.inputs) {
          try {
            inputs = JSON.parse(args.inputs as string) as Record<string, string>;
          } catch { /* ignore */ }
        }
        output = await gh.triggerWorkflow(
          args.owner as string,
          args.repo as string,
          args.workflow_id as string,
          args.ref as string,
          inputs,
        );
        break;
      }

      case 'github_get_workflow_runs':
        output = await gh.getWorkflowRuns(
          args.owner as string,
          args.repo as string,
          args.workflow_id as string | undefined,
        );
        break;

      // ── GitHub search ──
      case 'github_search_code':
        output = await gh.searchCode(args.query as string);
        break;

      case 'github_list_releases':
        output = await gh.listReleases(args.owner as string, args.repo as string);
        break;

      // ── Leads ──
      case 'leads_list':
        output = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
        break;

      case 'leads_create':
        output = await prisma.lead.create({
          data: {
            email: args.email as string,
            name: args.name as string | undefined,
            company: args.company as string | undefined,
            phone: args.phone as string | undefined,
            website: args.website as string | undefined,
            source: args.source as string | undefined,
          },
        });
        break;

      case 'leads_scrape': {
        const jobId = await startScrapingJob(args.source as string);
        output = { jobId, message: `Scraping job started for source: ${args.source as string}` };
        break;
      }

      // ── System ──
      case 'system_get_connectors':
        output = await prisma.connector.findMany();
        break;

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    return {
      tool: toolName,
      input: args,
      output,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      tool: toolName,
      input: args,
      output: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}
