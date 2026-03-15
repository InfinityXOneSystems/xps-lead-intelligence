/**
 * Agent tool definitions — compatible with Groq / OpenAI function-calling API.
 * Each tool has a JSON schema and an executor that performs the real action.
 */

import * as gh from './github';
import * as docker from './docker';
import { prisma } from '../db/prisma';
import { startScrapingJob } from './scraper';
import { chatCompletion } from './groq';

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
  // Docker MCP tools
  {
    type: 'function',
    function: {
      name: 'docker_list_containers',
      description: 'List all Docker containers on the local machine (via Docker MCP gateway)',
      parameters: {
        type: 'object',
        properties: {
          all: { type: 'string', description: 'Include stopped containers: "true" or "false"' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docker_exec',
      description: 'Execute a shell command inside a running Docker container',
      parameters: {
        type: 'object',
        properties: {
          container_id: { type: 'string', description: 'Container ID or name' },
          command: { type: 'string', description: 'Shell command to run (e.g. "ls -la /app")' },
        },
        required: ['container_id', 'command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docker_get_logs',
      description: 'Get recent logs from a Docker container',
      parameters: {
        type: 'object',
        properties: {
          container_id: { type: 'string', description: 'Container ID or name' },
          tail: { type: 'string', description: 'Number of log lines to return (default 100)' },
        },
        required: ['container_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docker_write_file',
      description: 'Write a file to a running Docker container',
      parameters: {
        type: 'object',
        properties: {
          container_id: { type: 'string', description: 'Container ID or name' },
          path: { type: 'string', description: 'Absolute file path in container (e.g. /app/src/index.ts)' },
          content: { type: 'string', description: 'File content to write' },
        },
        required: ['container_id', 'path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'docker_read_file',
      description: 'Read a file from a running Docker container',
      parameters: {
        type: 'object',
        properties: {
          container_id: { type: 'string', description: 'Container ID or name' },
          path: { type: 'string', description: 'Absolute file path in container' },
        },
        required: ['container_id', 'path'],
      },
    },
  },
  // Sandbox tools
  {
    type: 'function',
    function: {
      name: 'sandbox_list',
      description: 'List all XPS sandboxes (running Docker sandbox apps)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_create',
      description: 'Create a new sandboxed app environment in Docker. Available templates: nextjs, react, node, express',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Unique sandbox name (lowercase, no spaces)' },
          template: { type: 'string', description: 'App template', enum: ['nextjs', 'react', 'node', 'express'] },
          description: { type: 'string', description: 'What this sandbox is for' },
        },
        required: ['name', 'template'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'sandbox_stop',
      description: 'Stop and remove a sandbox container',
      parameters: {
        type: 'object',
        properties: {
          sandbox_id: { type: 'string', description: 'Sandbox ID from sandbox_list' },
        },
        required: ['sandbox_id'],
      },
    },
  },
  // Code generation tool
  {
    type: 'function',
    function: {
      name: 'code_generate',
      description: 'Generate complete, working code for a React component, Next.js page, or Node.js module from a natural language description. Returns the full source code.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Natural language description of what to build' },
          type: { type: 'string', description: 'Code type', enum: ['react-component', 'nextjs-page', 'node-module', 'typescript', 'html'] },
          context: { type: 'string', description: 'Additional context (existing code, requirements, design system)' },
        },
        required: ['description', 'type'],
      },
    },
  },
  // Railway tools
  {
    type: 'function',
    function: {
      name: 'railway_get_services',
      description: 'Get Railway services for the Lead Intelligence project',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'railway_trigger_deploy',
      description: 'Trigger a Railway deployment via the CLI (uses RAILWAY_TOKEN)',
      parameters: {
        type: 'object',
        properties: {
          service: { type: 'string', description: 'Service name to deploy', enum: ['backend', 'frontend'] },
        },
        required: ['service'],
      },
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

      // ── Docker MCP ──
      case 'docker_list_containers':
        output = await docker.listContainers(args.all === 'true');
        break;

      case 'docker_exec': {
        const cmd = (args.command as string).split(' ');
        output = await docker.execInContainer(args.container_id as string, cmd);
        break;
      }

      case 'docker_get_logs':
        output = await docker.getContainerLogs(
          args.container_id as string,
          args.tail ? parseInt(args.tail as string, 10) : 100,
        );
        break;

      case 'docker_write_file':
        await docker.writeFileToContainer(
          args.container_id as string,
          args.path as string,
          args.content as string,
        );
        output = { success: true, path: args.path };
        break;

      case 'docker_read_file':
        output = await docker.readFileFromContainer(
          args.container_id as string,
          args.path as string,
        );
        break;

      // ── Sandbox ──
      case 'sandbox_list':
        output = await prisma.sandbox.findMany({ orderBy: { createdAt: 'desc' } });
        break;

      case 'sandbox_create': {
        // Find a free port in 4100-4200 range
        const existing = await prisma.sandbox.findMany({ select: { hostPort: true } });
        const usedPorts = new Set(existing.map((s) => s.hostPort).filter(Boolean));
        let hostPort = 4100;
        while (usedPorts.has(hostPort) && hostPort < 4200) hostPort++;

        const templateImages: Record<string, { image: string; port: number; cmd?: string[] }> = {
          nextjs: { image: 'node:18-alpine', port: 3000, cmd: ['sh', '-c', 'npm create next-app@latest . --yes && npm run dev'] },
          react: { image: 'node:18-alpine', port: 3000 },
          node: { image: 'node:18-alpine', port: 4000 },
          express: { image: 'node:18-alpine', port: 4000 },
        };
        const tmpl = templateImages[args.template as string] || templateImages.node;
        const sandboxName = `xps-sandbox-${args.name as string}`;

        // Create DB record first
        const sandbox = await prisma.sandbox.create({
          data: {
            name: sandboxName,
            template: args.template as string,
            hostPort,
            status: 'CREATING',
            previewUrl: `http://localhost:${hostPort}`,
            metadata: { description: args.description || '' } as never,
          },
        });

        // Create Docker container (fire and forget — update status async)
        docker.createSandbox({
          name: sandboxName,
          image: tmpl.image,
          hostPort,
          containerPort: tmpl.port,
          cmd: tmpl.cmd,
          labels: { 'xps.sandbox.id': sandbox.id },
        }).then(async (cid) => {
          await prisma.sandbox.update({
            where: { id: sandbox.id },
            data: { containerId: cid, status: 'RUNNING' },
          });
        }).catch(async (err) => {
          await prisma.sandbox.update({
            where: { id: sandbox.id },
            data: { status: 'ERROR', metadata: { error: String(err) } as never },
          });
        });

        output = { ...sandbox, message: `Sandbox ${sandboxName} is being created on port ${hostPort}` };
        break;
      }

      case 'sandbox_stop': {
        const sb = await prisma.sandbox.findUnique({ where: { id: args.sandbox_id as string } });
        if (!sb) throw new Error('Sandbox not found');
        if (sb.containerId) await docker.stopAndRemoveSandbox(sb.containerId);
        await prisma.sandbox.update({ where: { id: sb.id }, data: { status: 'STOPPED' } });
        output = { stopped: true, sandbox: sb.name };
        break;
      }

      // ── Code generation ──
      case 'code_generate': {
        const codePrompt = `You are an expert ${args.type as string} developer. Generate complete, production-ready code.

Task: ${args.description as string}
${args.context ? `Context: ${args.context as string}` : ''}

Requirements:
- Write complete, working code — no placeholders or TODOs
- Use TypeScript where applicable
- Follow best practices for ${args.type as string}
- Include all necessary imports
- If React: use functional components with hooks
- If styling: use Tailwind CSS classes

Return ONLY the code, no explanation, no markdown fences.`;

        output = await chatCompletion([
          { role: 'system', content: 'You are an expert code generator. Return only raw code with no explanation or markdown.' },
          { role: 'user', content: codePrompt },
        ], 'llama3-70b-8192');
        break;
      }

      // ── Railway ──
      case 'railway_get_services': {
        const token = process.env.RAILWAY_TOKEN;
        if (!token) throw new Error('RAILWAY_TOKEN not configured');
        const resp = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{ project(id: "0361239a-54f7-4db8-8350-d7931d2b9260") { name services { edges { node { id name } } } } }`,
          }),
        });
        output = await resp.json();
        break;
      }

      case 'railway_trigger_deploy': {
        const { execSync } = await import('child_process');
        try {
          const result = execSync(
            `railway up --service ${args.service as string} --detach --project 0361239a-54f7-4db8-8350-d7931d2b9260`,
            { env: { ...process.env }, timeout: 60000 },
          );
          output = { triggered: true, service: args.service, output: result.toString() };
        } catch (err) {
          throw new Error(`Railway deploy failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        break;
      }

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
