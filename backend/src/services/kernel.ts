/**
 * Kernel — Central Runtime Coordinator
 *
 * Acts as the system authority for:
 *   - lifecycle state management (INITIALIZING → READY / DEGRADED → SHUTDOWN)
 *   - tool registration and discovery
 *   - task scheduling and tracking
 *   - job routing to appropriate agents
 *   - policy enforcement on actions
 *   - in-memory audit logging
 *
 * The kernel has NO hard runtime dependencies (no Prisma, no Redis) so it can
 * be started and tested without any external services.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export enum KernelState {
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  DEGRADED = 'DEGRADED',
  SHUTDOWN = 'SHUTDOWN',
}

export interface ServiceHealth {
  database: boolean;
  redis: boolean;
  groq: boolean;
}

export interface ToolRegistration {
  name: string;
  description: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  tags: string[];
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface ScheduledTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  scheduledAt: Date;
  maxRetries: number;
  retries: number;
  status: TaskStatus;
}

export interface JobRoute {
  agent: string;
  priority: number;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

export interface AuditEntry {
  action: string;
  data: unknown;
  timestamp: string;
}

export interface KernelStatus {
  state: KernelState;
  toolCount: number;
  taskCount: number;
  uptimeMs: number;
  services: ServiceHealth;
}

// ── Routing table ─────────────────────────────────────────────────────────────

const JOB_ROUTING: Record<string, JobRoute> = {
  scrape: { agent: 'scraper', priority: 5 },
  research: { agent: 'researcher', priority: 4 },
  build: { agent: 'builder', priority: 3 },
  validate: { agent: 'validator', priority: 6 },
  monitor: { agent: 'monitor', priority: 7 },
  repair: { agent: 'repair', priority: 8 },
  plan: { agent: 'planner', priority: 2 },
  email: { agent: 'planner', priority: 3 },
  social: { agent: 'planner', priority: 3 },
  deploy: { agent: 'builder', priority: 6 },
};

// Actions blocked in DEGRADED state (database unavailable)
const DEGRADED_BLOCKED_ACTIONS = new Set(['deploy', 'delete', 'purge', 'migrate']);

const DEFAULT_MAX_RETRIES = 3;
const AUDIT_BUFFER_LIMIT = 500;

// ── Kernel class ──────────────────────────────────────────────────────────────

class Kernel {
  private state: KernelState = KernelState.INITIALIZING;
  private tools = new Map<string, ToolRegistration>();
  private tasks = new Map<string, ScheduledTask>();
  private services: ServiceHealth = { database: false, redis: false, groq: false };
  private startedAt: Date | null = null;
  private auditBuffer: AuditEntry[] = [];

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Initialize the kernel with service health results.
   * Database must be available for READY state; Redis and Groq degrade gracefully.
   */
  initialize(services: ServiceHealth): KernelState {
    this.services = { ...services };
    this.startedAt = new Date();
    this.state = services.database ? KernelState.READY : KernelState.DEGRADED;
    this.auditLog('kernel:initialized', {
      state: this.state,
      services,
    });
    return this.state;
  }

  getState(): KernelState {
    return this.state;
  }

  /**
   * Returns true when the kernel can handle requests (READY or DEGRADED).
   */
  isReady(): boolean {
    return this.state === KernelState.READY || this.state === KernelState.DEGRADED;
  }

  getServices(): ServiceHealth {
    return { ...this.services };
  }

  shutdown(): void {
    this.auditLog('kernel:shutdown', { previousState: this.state });
    this.state = KernelState.SHUTDOWN;
  }

  /** Reset to initial state — useful for testing. */
  reset(): void {
    this.state = KernelState.INITIALIZING;
    this.tools = new Map();
    this.tasks = new Map();
    this.services = { database: false, redis: false, groq: false };
    this.startedAt = null;
    this.auditBuffer = [];
  }

  // ── Tool Registry ───────────────────────────────────────────────────────────

  registerTool(tool: ToolRegistration): void {
    this.tools.set(tool.name, tool);
    this.auditLog('kernel:tool_registered', { name: tool.name, tags: tool.tags });
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  getTool(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  /**
   * List tool names. If `tag` is provided, only return tools with that tag.
   */
  listTools(tag?: string): string[] {
    if (!tag) return Array.from(this.tools.keys());
    return Array.from(this.tools.entries())
      .filter(([, t]) => t.tags.includes(tag))
      .map(([name]) => name);
  }

  // ── Task Scheduling ─────────────────────────────────────────────────────────

  scheduleTask(
    type: string,
    payload: Record<string, unknown>,
    options: { scheduledAt?: Date; maxRetries?: number } = {},
  ): ScheduledTask {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task: ScheduledTask = {
      id,
      type,
      payload,
      scheduledAt: options.scheduledAt ?? new Date(),
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      retries: 0,
      status: 'PENDING',
    };
    this.tasks.set(id, task);
    this.auditLog('kernel:task_scheduled', { id, type });
    return task;
  }

  updateTask(id: string, update: Partial<Pick<ScheduledTask, 'status' | 'retries'>>): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    Object.assign(task, update);
    return true;
  }

  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(status?: TaskStatus): ScheduledTask[] {
    const all = Array.from(this.tasks.values());
    return status ? all.filter((t) => t.status === status) : all;
  }

  // ── Job Routing ─────────────────────────────────────────────────────────────

  /**
   * Route a job type to the appropriate agent and priority.
   * Returns planner agent with priority 1 for unrecognized types.
   */
  routeJob(type: string): JobRoute {
    return JOB_ROUTING[type] ?? { agent: 'planner', priority: 1 };
  }

  // ── Policy Enforcement ──────────────────────────────────────────────────────

  /**
   * Check whether an action is allowed given the current kernel state.
   * All checks are logged to the audit buffer.
   */
  enforcePolicy(action: string, context: Record<string, unknown> = {}): PolicyResult {
    if (this.state === KernelState.SHUTDOWN) {
      return { allowed: false, reason: 'Kernel is shut down' };
    }

    if (this.state === KernelState.INITIALIZING) {
      return { allowed: false, reason: 'Kernel is still initializing' };
    }

    if (this.state === KernelState.DEGRADED && DEGRADED_BLOCKED_ACTIONS.has(action)) {
      return {
        allowed: false,
        reason: `Action "${action}" is blocked while system is in degraded state (database unavailable)`,
      };
    }

    this.auditLog(`policy:allowed:${action}`, context);
    return { allowed: true };
  }

  // ── Audit Logging ───────────────────────────────────────────────────────────

  auditLog(action: string, data: unknown = {}): void {
    this.auditBuffer.push({ action, data, timestamp: new Date().toISOString() });
    // Trim to avoid unbounded memory growth
    if (this.auditBuffer.length > AUDIT_BUFFER_LIMIT) {
      this.auditBuffer = this.auditBuffer.slice(-AUDIT_BUFFER_LIMIT);
    }
  }

  /** Return a copy of the audit log. Optionally filter by action prefix. */
  getAuditLog(actionPrefix?: string): AuditEntry[] {
    if (!actionPrefix) return [...this.auditBuffer];
    return this.auditBuffer.filter((e) => e.action.startsWith(actionPrefix));
  }

  // ── System Status ───────────────────────────────────────────────────────────

  getStatus(): KernelStatus {
    return {
      state: this.state,
      toolCount: this.tools.size,
      taskCount: this.tasks.size,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      services: this.getServices(),
    };
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────

/** The global kernel instance. Call `kernel.initialize(services)` on startup. */
export const kernel = new Kernel();
