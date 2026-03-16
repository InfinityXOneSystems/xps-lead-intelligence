/**
 * Kernel module tests.
 *
 * The kernel has no external dependencies so no mocking is required.
 * Tests cover: lifecycle, tool registry, task scheduling, job routing,
 * policy enforcement, and audit logging.
 */
import {
  kernel,
  KernelState,
  ServiceHealth,
  ToolRegistration,
} from '../services/kernel';

// ── Reset kernel between tests ────────────────────────────────────────────────

beforeEach(() => {
  kernel.reset();
});

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('Kernel lifecycle', () => {
  it('starts in INITIALIZING state', () => {
    expect(kernel.getState()).toBe(KernelState.INITIALIZING);
    expect(kernel.isReady()).toBe(false);
  });

  it('transitions to READY when database is available', () => {
    const services: ServiceHealth = { database: true, redis: true, groq: true };
    const state = kernel.initialize(services);
    expect(state).toBe(KernelState.READY);
    expect(kernel.getState()).toBe(KernelState.READY);
    expect(kernel.isReady()).toBe(true);
  });

  it('transitions to DEGRADED when database is unavailable', () => {
    const services: ServiceHealth = { database: false, redis: true, groq: true };
    const state = kernel.initialize(services);
    expect(state).toBe(KernelState.DEGRADED);
    expect(kernel.isReady()).toBe(true); // degraded is still operable
  });

  it('isReady returns true in both READY and DEGRADED states', () => {
    kernel.initialize({ database: true, redis: false, groq: false });
    expect(kernel.isReady()).toBe(true);

    kernel.reset();
    kernel.initialize({ database: false, redis: false, groq: false });
    expect(kernel.isReady()).toBe(true);
  });

  it('transitions to SHUTDOWN on shutdown()', () => {
    kernel.initialize({ database: true, redis: true, groq: true });
    kernel.shutdown();
    expect(kernel.getState()).toBe(KernelState.SHUTDOWN);
    expect(kernel.isReady()).toBe(false);
  });

  it('records uptime after initialization', () => {
    kernel.initialize({ database: true, redis: true, groq: true });
    const status = kernel.getStatus();
    expect(status.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('getServices returns the health passed to initialize()', () => {
    const services: ServiceHealth = { database: true, redis: false, groq: true };
    kernel.initialize(services);
    expect(kernel.getServices()).toEqual(services);
  });
});

// ── Tool Registry ─────────────────────────────────────────────────────────────

describe('Tool Registry', () => {
  beforeEach(() => {
    kernel.initialize({ database: true, redis: true, groq: true });
  });

  it('registers a tool and finds it by name', () => {
    const tool: ToolRegistration = {
      name: 'test_tool',
      description: 'A test tool',
      handler: jest.fn().mockResolvedValue({ ok: true }),
      tags: ['test'],
    };
    kernel.registerTool(tool);
    expect(kernel.hasTool('test_tool')).toBe(true);
    expect(kernel.getTool('test_tool')).toBe(tool);
  });

  it('listTools() returns all registered tool names', () => {
    kernel.registerTool({ name: 'alpha', description: '', handler: jest.fn(), tags: [] });
    kernel.registerTool({ name: 'beta', description: '', handler: jest.fn(), tags: [] });
    expect(kernel.listTools()).toContain('alpha');
    expect(kernel.listTools()).toContain('beta');
  });

  it('listTools(tag) filters by tag', () => {
    kernel.registerTool({ name: 'github_list', description: '', handler: jest.fn(), tags: ['github'] });
    kernel.registerTool({ name: 'leads_list', description: '', handler: jest.fn(), tags: ['leads'] });
    expect(kernel.listTools('github')).toContain('github_list');
    expect(kernel.listTools('github')).not.toContain('leads_list');
  });

  it('hasTool returns false for unregistered tools', () => {
    expect(kernel.hasTool('nonexistent')).toBe(false);
  });

  it('getTool returns undefined for unregistered tools', () => {
    expect(kernel.getTool('nonexistent')).toBeUndefined();
  });

  it('overwriting a registered tool updates the entry', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    kernel.registerTool({ name: 'same_name', description: 'v1', handler: handler1, tags: [] });
    kernel.registerTool({ name: 'same_name', description: 'v2', handler: handler2, tags: [] });
    expect(kernel.getTool('same_name')?.description).toBe('v2');
  });

  it('getStatus.toolCount reflects registered tools', () => {
    expect(kernel.getStatus().toolCount).toBe(0);
    kernel.registerTool({ name: 't1', description: '', handler: jest.fn(), tags: [] });
    kernel.registerTool({ name: 't2', description: '', handler: jest.fn(), tags: [] });
    expect(kernel.getStatus().toolCount).toBe(2);
  });
});

// ── Task Scheduling ───────────────────────────────────────────────────────────

describe('Task Scheduling', () => {
  beforeEach(() => {
    kernel.initialize({ database: true, redis: true, groq: true });
  });

  it('scheduleTask creates a task with PENDING status', () => {
    const task = kernel.scheduleTask('scrape', { url: 'https://example.com' });
    expect(task.id).toBeDefined();
    expect(task.type).toBe('scrape');
    expect(task.status).toBe('PENDING');
    expect(task.retries).toBe(0);
    expect(task.maxRetries).toBe(3);
  });

  it('getTask retrieves a previously scheduled task', () => {
    const task = kernel.scheduleTask('email_send', { to: 'test@example.com' });
    const retrieved = kernel.getTask(task.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.type).toBe('email_send');
  });

  it('updateTask changes the task status', () => {
    const task = kernel.scheduleTask('research', { query: 'saas market' });
    const updated = kernel.updateTask(task.id, { status: 'RUNNING' });
    expect(updated).toBe(true);
    expect(kernel.getTask(task.id)?.status).toBe('RUNNING');
  });

  it('updateTask increments retries correctly', () => {
    const task = kernel.scheduleTask('build', {});
    kernel.updateTask(task.id, { retries: 1 });
    kernel.updateTask(task.id, { retries: 2 });
    expect(kernel.getTask(task.id)?.retries).toBe(2);
  });

  it('updateTask returns false for unknown task IDs', () => {
    expect(kernel.updateTask('nonexistent_id', { status: 'COMPLETED' })).toBe(false);
  });

  it('listTasks() returns all tasks', () => {
    kernel.scheduleTask('scrape', {});
    kernel.scheduleTask('validate', {});
    expect(kernel.listTasks().length).toBe(2);
  });

  it('listTasks(status) filters by status', () => {
    const t1 = kernel.scheduleTask('scrape', {});
    kernel.scheduleTask('validate', {});
    kernel.updateTask(t1.id, { status: 'RUNNING' });
    const running = kernel.listTasks('RUNNING');
    expect(running.length).toBe(1);
    expect(running[0].id).toBe(t1.id);
    expect(kernel.listTasks('PENDING').length).toBe(1);
  });

  it('scheduleTask respects custom maxRetries', () => {
    const task = kernel.scheduleTask('plan', {}, { maxRetries: 5 });
    expect(task.maxRetries).toBe(5);
  });

  it('scheduleTask respects custom scheduledAt', () => {
    const future = new Date(Date.now() + 60_000);
    const task = kernel.scheduleTask('monitor', {}, { scheduledAt: future });
    expect(task.scheduledAt.getTime()).toBeCloseTo(future.getTime(), -2);
  });

  it('getStatus.taskCount reflects scheduled tasks', () => {
    expect(kernel.getStatus().taskCount).toBe(0);
    kernel.scheduleTask('scrape', {});
    expect(kernel.getStatus().taskCount).toBe(1);
  });
});

// ── Job Routing ───────────────────────────────────────────────────────────────

describe('Job Routing', () => {
  beforeEach(() => {
    kernel.initialize({ database: true, redis: true, groq: true });
  });

  it('routes scrape jobs to scraper agent', () => {
    const route = kernel.routeJob('scrape');
    expect(route.agent).toBe('scraper');
    expect(route.priority).toBeGreaterThan(0);
  });

  it('routes build jobs to builder agent', () => {
    expect(kernel.routeJob('build').agent).toBe('builder');
  });

  it('routes monitor jobs to monitor agent', () => {
    expect(kernel.routeJob('monitor').agent).toBe('monitor');
  });

  it('routes research jobs to researcher agent', () => {
    expect(kernel.routeJob('research').agent).toBe('researcher');
  });

  it('routes validate jobs to validator agent', () => {
    expect(kernel.routeJob('validate').agent).toBe('validator');
  });

  it('routes repair jobs to repair agent', () => {
    expect(kernel.routeJob('repair').agent).toBe('repair');
  });

  it('routes unknown types to planner with priority 1', () => {
    const route = kernel.routeJob('completely_unknown_type');
    expect(route.agent).toBe('planner');
    expect(route.priority).toBe(1);
  });
});

// ── Policy Enforcement ────────────────────────────────────────────────────────

describe('Policy Enforcement', () => {
  it('blocks all actions while INITIALIZING', () => {
    const result = kernel.enforcePolicy('scrape');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('initializing');
  });

  it('blocks all actions after SHUTDOWN', () => {
    kernel.initialize({ database: true, redis: true, groq: true });
    kernel.shutdown();
    const result = kernel.enforcePolicy('scrape');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('shut down');
  });

  it('allows safe actions in READY state', () => {
    kernel.initialize({ database: true, redis: true, groq: true });
    expect(kernel.enforcePolicy('scrape').allowed).toBe(true);
    expect(kernel.enforcePolicy('research').allowed).toBe(true);
    expect(kernel.enforcePolicy('monitor').allowed).toBe(true);
  });

  it('allows safe actions in DEGRADED state', () => {
    kernel.initialize({ database: false, redis: false, groq: false });
    expect(kernel.enforcePolicy('scrape').allowed).toBe(true);
    expect(kernel.enforcePolicy('research').allowed).toBe(true);
  });

  it('blocks destructive actions in DEGRADED state', () => {
    kernel.initialize({ database: false, redis: false, groq: false });
    expect(kernel.enforcePolicy('deploy').allowed).toBe(false);
    expect(kernel.enforcePolicy('delete').allowed).toBe(false);
    expect(kernel.enforcePolicy('purge').allowed).toBe(false);
  });

  it('allows deploy in READY state', () => {
    kernel.initialize({ database: true, redis: true, groq: true });
    expect(kernel.enforcePolicy('deploy').allowed).toBe(true);
  });
});

// ── Audit Logging ─────────────────────────────────────────────────────────────

describe('Audit Logging', () => {
  beforeEach(() => {
    kernel.initialize({ database: true, redis: true, groq: true });
  });

  it('records audit entries', () => {
    kernel.auditLog('test:action', { foo: 'bar' });
    const log = kernel.getAuditLog();
    const entry = log.find((e) => e.action === 'test:action');
    expect(entry).toBeDefined();
    expect(entry?.data).toEqual({ foo: 'bar' });
    expect(typeof entry?.timestamp).toBe('string');
  });

  it('getAuditLog(prefix) filters by action prefix', () => {
    kernel.auditLog('kernel:start', {});
    kernel.auditLog('policy:check', {});
    kernel.auditLog('kernel:stop', {});
    const kernelEntries = kernel.getAuditLog('kernel:');
    expect(kernelEntries.every((e) => e.action.startsWith('kernel:'))).toBe(true);
    expect(kernelEntries.length).toBeGreaterThanOrEqual(2);
  });

  it('initialize() writes an audit entry', () => {
    // initialize was called in beforeEach
    const log = kernel.getAuditLog('kernel:initialized');
    expect(log.length).toBeGreaterThan(0);
  });

  it('enforcePolicy writes an allowed audit entry', () => {
    kernel.enforcePolicy('scrape', { agent: 'scraper' });
    const log = kernel.getAuditLog('policy:allowed:scrape');
    expect(log.length).toBeGreaterThan(0);
  });
});
