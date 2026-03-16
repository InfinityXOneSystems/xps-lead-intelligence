/**
 * Worker System — Redis-backed Job Queue
 *
 * Responsibilities:
 *   - enqueue jobs for async processing
 *   - track job status (PENDING → RUNNING → COMPLETED | FAILED | DLQ)
 *   - retry failed jobs up to maxRetries
 *   - move exhausted jobs to dead-letter queue (DLQ)
 *   - support handler registration per job type
 *
 * Built on top of the existing redis.ts cache layer so it degrades gracefully
 * when Redis is unavailable.
 */

import { cacheGet, cacheSet, getRedisClient } from './redis';

// ── Types ─────────────────────────────────────────────────────────────────────

export type JobType = 'scrape' | 'email_send' | 'social_post' | 'lead_score' | 'agent_task' | string;

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DLQ';

export interface Job<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  payload: T;
  status: JobStatus;
  retries: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: unknown;
}

export type JobHandler<T = Record<string, unknown>> = (payload: T) => Promise<unknown>;

export interface ProcessResult {
  processed: boolean;
  jobId?: string;
  error?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QUEUE_PREFIX = 'queue:';
const JOB_PREFIX = 'job:';
const DLQ_KEY = 'queue:dlq';
const JOB_TTL_SECONDS = 86_400; // 24 h
const DEFAULT_MAX_RETRIES = 3;

// ── In-process handler registry ───────────────────────────────────────────────

// Handlers are registered per job type. They are in-process functions (not
// persisted) so they must be re-registered on each process start.
const handlers = new Map<string, JobHandler>();

export function registerJobHandler<T = Record<string, unknown>>(
  type: JobType,
  handler: JobHandler<T>,
): void {
  handlers.set(type, handler as JobHandler);
}

export function hasHandler(type: JobType): boolean {
  return handlers.has(type);
}

/** Remove all registered handlers — useful in tests. */
export function clearHandlers(): void {
  handlers.clear();
}

// ── Job lifecycle ─────────────────────────────────────────────────────────────

/**
 * Enqueue a new job. Returns the job object with its generated ID.
 * If Redis is unavailable the job state is written to the cache-only path and
 * the caller should handle the case where the queue entry was not written.
 */
export async function enqueueJob<T = Record<string, unknown>>(
  type: JobType,
  payload: T,
  options: { maxRetries?: number } = {},
): Promise<Job<T>> {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: Job<T> = {
    id,
    type,
    payload,
    status: 'PENDING',
    retries: 0,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    createdAt: new Date().toISOString(),
  };

  // Persist job state via cache layer
  await cacheSet(JOB_PREFIX + id, JSON.stringify(job), JOB_TTL_SECONDS);

  // Push job ID onto the type-specific Redis list (right-push for FIFO order)
  try {
    const redis = getRedisClient();
    await redis.rpush(QUEUE_PREFIX + type, id);
  } catch {
    // Redis unavailable — job state is stored but will not be auto-processed
  }

  return job;
}

/**
 * Read the current state of a job by ID.
 * Returns null when not found (expired or never created).
 */
export async function getJobStatus<T = Record<string, unknown>>(jobId: string): Promise<Job<T> | null> {
  const raw = await cacheGet(JOB_PREFIX + jobId);
  if (!raw) return null;
  return JSON.parse(raw) as Job<T>;
}

/**
 * Update the persisted job state. Merges the `update` fields onto the stored
 * job object and writes back to the cache.
 */
export async function updateJobState(
  jobId: string,
  status: JobStatus,
  update: Partial<Pick<Job, 'error' | 'result' | 'startedAt' | 'completedAt' | 'retries'>> = {},
): Promise<void> {
  const raw = await cacheGet(JOB_PREFIX + jobId);
  if (!raw) return;
  const job = JSON.parse(raw) as Job;
  Object.assign(job, { status, ...update });
  await cacheSet(JOB_PREFIX + jobId, JSON.stringify(job), JOB_TTL_SECONDS);
}

// ── Job processing ────────────────────────────────────────────────────────────

/**
 * Pop and process the next job of the given type.
 *
 * The job is executed via the registered handler. On failure the job is:
 *   - re-queued if retries < maxRetries
 *   - moved to the dead-letter queue (DLQ) once retries are exhausted
 *
 * Returns `processed: false` when there is nothing to process or Redis is down.
 */
export async function processNextJob(type: JobType): Promise<ProcessResult> {
  let jobId: string | null = null;
  try {
    const redis = getRedisClient();
    jobId = await redis.lpop(QUEUE_PREFIX + type);
  } catch (err) {
    return { processed: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!jobId) return { processed: false };

  const raw = await cacheGet(JOB_PREFIX + jobId);
  if (!raw) return { processed: false, jobId };

  const job = JSON.parse(raw) as Job;
  const handler = handlers.get(type);

  if (!handler) {
    await updateJobState(jobId, 'FAILED', { error: `No handler registered for type: ${type}` });
    return { processed: false, jobId, error: 'No handler registered' };
  }

  // Mark as RUNNING
  await updateJobState(jobId, 'RUNNING', { startedAt: new Date().toISOString() });

  try {
    const result = await handler(job.payload);
    await updateJobState(jobId, 'COMPLETED', {
      completedAt: new Date().toISOString(),
      result: result as Record<string, unknown>,
    });
    return { processed: true, jobId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    // Re-read to get latest retries count (handler may have updated it)
    const latestRaw = await cacheGet(JOB_PREFIX + jobId);
    const latest = latestRaw ? (JSON.parse(latestRaw) as Job) : job;
    const nextRetries = latest.retries + 1;

    if (nextRetries < latest.maxRetries) {
      // Re-queue for retry
      await updateJobState(jobId, 'PENDING', { retries: nextRetries, error });
      try {
        const redis = getRedisClient();
        await redis.rpush(QUEUE_PREFIX + type, jobId);
      } catch { /* Redis down — cannot re-queue */ }
    } else {
      // Exhausted — send to dead-letter queue
      await updateJobState(jobId, 'DLQ', {
        retries: nextRetries,
        error,
        completedAt: new Date().toISOString(),
      });
      try {
        const redis = getRedisClient();
        await redis.rpush(DLQ_KEY, jobId);
      } catch { /* Redis down — cannot move to DLQ */ }
    }

    return { processed: false, jobId, error };
  }
}

// ── Dead-letter queue ─────────────────────────────────────────────────────────

/** Return all job IDs currently in the dead-letter queue. */
export async function getDLQJobs(): Promise<string[]> {
  try {
    const redis = getRedisClient();
    return await redis.lrange(DLQ_KEY, 0, -1);
  } catch {
    return [];
  }
}

/**
 * Move a job from the DLQ back to its origin queue for reprocessing.
 * Resets retries to 0.
 */
export async function retryDLQJob(jobId: string): Promise<boolean> {
  const raw = await cacheGet(JOB_PREFIX + jobId);
  if (!raw) return false;

  const job = JSON.parse(raw) as Job;
  if (job.status !== 'DLQ') return false;

  // Reset and re-enqueue
  job.status = 'PENDING';
  job.retries = 0;
  job.error = undefined;
  await cacheSet(JOB_PREFIX + jobId, JSON.stringify(job), JOB_TTL_SECONDS);

  try {
    const redis = getRedisClient();
    await redis.rpush(QUEUE_PREFIX + job.type, jobId);
    await redis.lrem(DLQ_KEY, 0, jobId);
    return true;
  } catch {
    return false;
  }
}
