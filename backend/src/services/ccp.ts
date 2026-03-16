/**
 * Cognitive Control Plane (CCP)
 *
 * The CCP governs all agent execution. It sits between user input and the
 * agent orchestrator and is responsible for:
 *
 *   - intent analysis (fast keyword-based classification)
 *   - task decomposition into ordered steps
 *   - agent selection (which agent type should handle the task)
 *   - policy checks via the kernel before any execution
 *   - confidence scoring on the classification
 *   - delegating approved tasks to the agent orchestrator
 *
 * The CCP does NOT implement its own LLM loop — it uses the existing
 * orchestrator for actual execution after the plan is approved.
 */

import { kernel } from './kernel';
import { processAgentMessage, AgentResponse } from './orchestrator';

// ── Agent types ───────────────────────────────────────────────────────────────

export type AgentType =
  | 'planner'
  | 'builder'
  | 'researcher'
  | 'scraper'
  | 'validator'
  | 'monitor'
  | 'repair';

// ── Agent registry ────────────────────────────────────────────────────────────

/**
 * Each agent type defines:
 *   - the tools it is permitted to call
 *   - the system-level description of its role
 */
export interface AgentDefinition {
  type: AgentType;
  description: string;
  allowedTools: string[];
}

export const AGENT_REGISTRY: Record<AgentType, AgentDefinition> = {
  planner: {
    type: 'planner',
    description: 'Decomposes high-level goals into ordered tasks and coordinates other agents.',
    allowedTools: ['*'], // planner can delegate to any tool
  },
  builder: {
    type: 'builder',
    description: 'Writes, tests, and deploys code. Creates GitHub issues and PRs.',
    allowedTools: [
      'github_write_file', 'github_create_issue', 'github_create_pr',
      'code_generate', 'sandbox_exec', 'railway_deploy',
    ],
  },
  researcher: {
    type: 'researcher',
    description: 'Searches, analyzes, and synthesizes information from external sources.',
    allowedTools: [
      'github_search_repos', 'github_list_repos', 'github_get_repo',
      'leads_scrape', 'leads_list',
    ],
  },
  scraper: {
    type: 'scraper',
    description: 'Crawls public web sources to extract structured lead data.',
    allowedTools: ['leads_scrape', 'leads_create', 'leads_list'],
  },
  validator: {
    type: 'validator',
    description: 'Verifies that outputs are correct, complete, and production-ready.',
    allowedTools: ['leads_list', 'system_get_connectors'],
  },
  monitor: {
    type: 'monitor',
    description: 'Watches system health, agent activity, and external service status.',
    allowedTools: ['system_get_connectors', 'railway_get_deployments', 'railway_get_logs'],
  },
  repair: {
    type: 'repair',
    description: 'Diagnoses failures and applies fixes with minimal blast radius.',
    allowedTools: [
      'github_list_issues', 'github_create_issue',
      'railway_get_logs', 'railway_get_deployments',
    ],
  },
};

// ── Intent classification ─────────────────────────────────────────────────────

export interface IntentPattern {
  pattern: RegExp;
  type: string;
  agent: AgentType;
  tasks: string[];
  confidence: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    pattern: /scrape|crawl|extract|harvest|collect leads/i,
    type: 'scrape',
    agent: 'scraper',
    tasks: ['scrape_leads', 'validate_results', 'score_leads'],
    confidence: 0.9,
  },
  {
    pattern: /build|create|generate|write code|implement|develop/i,
    type: 'build',
    agent: 'builder',
    tasks: ['plan', 'build', 'test', 'commit'],
    confidence: 0.85,
  },
  {
    pattern: /research|find|search|discover|analyze market|investigate/i,
    type: 'research',
    agent: 'researcher',
    tasks: ['search', 'analyze', 'summarize', 'report'],
    confidence: 0.8,
  },
  {
    pattern: /validate|verify|check|test quality|audit|review/i,
    type: 'validate',
    agent: 'validator',
    tasks: ['validate', 'report_issues'],
    confidence: 0.85,
  },
  {
    pattern: /monitor|watch|track|alert|health|status/i,
    type: 'monitor',
    agent: 'monitor',
    tasks: ['collect_metrics', 'check_health', 'alert_on_failure'],
    confidence: 0.85,
  },
  {
    pattern: /fix|repair|debug|resolve|recover|rollback/i,
    type: 'repair',
    agent: 'repair',
    tasks: ['diagnose', 'repair', 'verify'],
    confidence: 0.9,
  },
  {
    pattern: /deploy|release|publish|launch/i,
    type: 'deploy',
    agent: 'builder',
    tasks: ['build', 'test', 'deploy', 'verify'],
    confidence: 0.8,
  },
  {
    pattern: /plan|design|architect|outline|breakdown/i,
    type: 'plan',
    agent: 'planner',
    tasks: ['analyze', 'decompose', 'prioritize', 'delegate'],
    confidence: 0.75,
  },
];

// ── Intent / Plan types ────────────────────────────────────────────────────────

export interface Intent {
  type: string;
  agent: AgentType;
  tasks: string[];
  confidence: number;
}

export interface ExecutionPlan {
  intent: Intent;
  sessionId: string;
  approved: boolean;
  reason?: string;
}

// ── Core CCP functions ────────────────────────────────────────────────────────

/**
 * Classify the user message into an intent without calling the LLM.
 * Falls back to 'planner' agent with 0.5 confidence for unrecognized input.
 */
export function analyzeIntent(message: string): Intent {
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.pattern.test(message)) {
      return {
        type: pattern.type,
        agent: pattern.agent,
        tasks: pattern.tasks,
        confidence: pattern.confidence,
      };
    }
  }

  // Default: route to planner with low confidence
  return {
    type: 'general',
    agent: 'planner',
    tasks: ['plan', 'execute', 'report'],
    confidence: 0.5,
  };
}

/**
 * Validate an intent against kernel policy and produce an execution plan.
 * If the kernel blocks the action the plan is marked `approved: false`.
 */
export function createExecutionPlan(intent: Intent, sessionId?: string): ExecutionPlan {
  const sid = sessionId ?? `ccp_${Date.now()}`;

  const policy = kernel.enforcePolicy(intent.type, {
    agent: intent.agent,
    tasks: intent.tasks,
    confidence: intent.confidence,
  });

  if (!policy.allowed) {
    kernel.auditLog('ccp:plan_rejected', { intent, sessionId: sid, reason: policy.reason });
    return { intent, sessionId: sid, approved: false, reason: policy.reason };
  }

  kernel.auditLog('ccp:plan_approved', { intent, sessionId: sid });
  return { intent, sessionId: sid, approved: true };
}

/**
 * Full CCP pipeline: analyze → plan → execute.
 *
 * 1. Classifies the user's intent
 * 2. Checks kernel policy
 * 3. Delegates to the agent orchestrator if approved
 *
 * Returns a result object compatible with the existing orchestrator response
 * shape, augmented with intent information.
 */
export async function executeWithCCP(
  userMessage: string,
  sessionId?: string,
): Promise<AgentResponse & { intent: Intent }> {
  const intent = analyzeIntent(userMessage);
  const plan = createExecutionPlan(intent, sessionId);

  if (!plan.approved) {
    return {
      sessionId: plan.sessionId,
      message: `Request blocked by system policy: ${plan.reason}`,
      toolCalls: [],
      steps: 0,
      intent,
    };
  }

  const result = await processAgentMessage(userMessage, plan.sessionId);
  return { ...result, intent };
}

/**
 * Return the definition of a registered agent type.
 */
export function getAgentDefinition(type: AgentType): AgentDefinition {
  return AGENT_REGISTRY[type];
}

/**
 * List all registered agent types with their descriptions.
 */
export function listAgents(): AgentDefinition[] {
  return Object.values(AGENT_REGISTRY);
}
