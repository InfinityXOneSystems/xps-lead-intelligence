/**
 * Worker system tests.
 *
 * Redis and the underlying cache functions are mocked so no real Redis
 * connection is needed. Tests cover: enqueue, getJobStatus, processNextJob
 * (success, failure, retry, DLQ), getDLQJobs, and retryDLQJob.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock Redis client
const mockLpop = jest.fn();
const mockRpush = jest.fn();
const mockLrange = jest.fn();
const mockLrem = jest.fn();

jest.mock('../services/redis', () => ({
  cacheGet: jest.fn(),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
  getRedisClient: jest.fn(() => ({
    lpop: mockLpop,
    rpush: mockRpush,
    lrange: mockLrange,
    lrem: mockLrem,
  })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  enqueueJob,
  getJobStatus,
  processNextJob,
  registerJobHandler,
  clearHandlers,
  getDLQJobs,
  retryDLQJob,
  Job,
} from '../services/worker';

const { cacheGet, cacheSet } = jest.requireMock('../services/redis') as {
  cacheGet: jest.Mock;
  cacheSet: jest.Mock;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a job object as it would be stored in Redis cache. */
function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'test_job_abc123',
    type: 'scrape',
    payload: { url: 'https://example.com' },
    status: 'PENDING',
    retries: 0,
    maxRetries: 3,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  clearHandlers();
  mockLpop.mockResolvedValue(null);
  mockRpush.mockResolvedValue(1);
  mockLrange.mockResolvedValue([]);
  mockLrem.mockResolvedValue(1);
});

// ── enqueueJob ────────────────────────────────────────────────────────────────

describe('enqueueJob', () => {
  it('creates a job with PENDING status and correct type', async () => {
    const job = await enqueueJob('scrape', { url: 'https://example.com' });
    expect(job.type).toBe('scrape');
    expect(job.status).toBe('PENDING');
    expect(job.retries).toBe(0);
    expect(job.maxRetries).toBe(3);
    expect(typeof job.id).toBe('string');
    expect(job.id).toContain('scrape');
  });

  it('persists job state via cacheSet', async () => {
    await enqueueJob('email_send', { to: 'test@example.com' });
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('job:'),
      expect.stringContaining('"status":"PENDING"'),
      86400,
    );
  });

  it('pushes job ID onto the Redis queue', async () => {
    await enqueueJob('lead_score', { leadId: 'lead_1' });
    expect(mockRpush).toHaveBeenCalledWith(
      'queue:lead_score',
      expect.any(String),
    );
  });

  it('respects custom maxRetries', async () => {
    const job = await enqueueJob('scrape', {}, { maxRetries: 5 });
    expect(job.maxRetries).toBe(5);
  });

  it('includes a createdAt timestamp', async () => {
    const job = await enqueueJob('social_post', {});
    expect(job.createdAt).toBeDefined();
    expect(() => new Date(job.createdAt)).not.toThrow();
  });

  it('still creates job when Redis is unavailable', async () => {
    mockRpush.mockRejectedValueOnce(new Error('Redis down'));
    const job = await enqueueJob('scrape', {});
    expect(job.id).toBeDefined();
    expect(cacheSet).toHaveBeenCalled(); // state persisted despite queue failure
  });
});

// ── getJobStatus ──────────────────────────────────────────────────────────────

describe('getJobStatus', () => {
  it('returns null when job not found in cache', async () => {
    cacheGet.mockResolvedValueOnce(null);
    const result = await getJobStatus('nonexistent');
    expect(result).toBeNull();
  });

  it('returns the parsed job when found', async () => {
    const job = makeJob({ status: 'RUNNING' });
    cacheGet.mockResolvedValueOnce(JSON.stringify(job));
    const result = await getJobStatus(job.id);
    expect(result).not.toBeNull();
    expect(result?.status).toBe('RUNNING');
    expect(result?.type).toBe('scrape');
  });
});

// ── processNextJob ────────────────────────────────────────────────────────────

describe('processNextJob — success', () => {
  it('returns processed:false when queue is empty', async () => {
    mockLpop.mockResolvedValue(null);
    const result = await processNextJob('scrape');
    expect(result.processed).toBe(false);
    expect(result.jobId).toBeUndefined();
  });

  it('processes a job successfully and marks it COMPLETED', async () => {
    const job = makeJob();
    mockLpop.mockResolvedValueOnce(job.id);
    // processNextJob reads job once; updateJobState(RUNNING) reads once;
    // updateJobState(COMPLETED) reads once — 3 cacheGet calls total.
    const raw = JSON.stringify(job);
    cacheGet.mockResolvedValue(raw);

    registerJobHandler('scrape', async () => ({ leadsFound: 5 }));
    const result = await processNextJob('scrape');

    expect(result.processed).toBe(true);
    expect(result.jobId).toBe(job.id);
    expect(cacheSet).toHaveBeenCalled();
  });

  it('returns processed:false when no handler is registered', async () => {
    const job = makeJob({ type: 'agent_task' });
    mockLpop.mockResolvedValueOnce(job.id);
    cacheGet.mockResolvedValueOnce(JSON.stringify(job));

    const result = await processNextJob('agent_task');
    expect(result.processed).toBe(false);
    expect(result.error).toContain('No handler');
  });
});

describe('processNextJob — retries', () => {
  it('re-queues a failed job when retries < maxRetries', async () => {
    const job = makeJob({ retries: 0, maxRetries: 3 });
    mockLpop.mockResolvedValueOnce(job.id);
    // processNextJob reads once; updateJobState(RUNNING) reads once;
    // after failure: re-read for retries count; updateJobState(PENDING) reads once — 4 total.
    cacheGet.mockResolvedValue(JSON.stringify(job));

    registerJobHandler('scrape', async () => { throw new Error('timeout'); });
    const result = await processNextJob('scrape');

    expect(result.processed).toBe(false);
    expect(result.error).toBe('timeout');
    // Should re-push to queue for retry
    expect(mockRpush).toHaveBeenCalledWith('queue:scrape', job.id);
  });

  it('moves job to DLQ after maxRetries exhausted', async () => {
    const job = makeJob({ retries: 2, maxRetries: 3 }); // one more failure → DLQ
    mockLpop.mockResolvedValueOnce(job.id);
    cacheGet.mockResolvedValue(JSON.stringify(job));

    registerJobHandler('scrape', async () => { throw new Error('permanent failure'); });
    const result = await processNextJob('scrape');

    expect(result.processed).toBe(false);
    // Should push to DLQ, not scrape queue
    const dlqCall = mockRpush.mock.calls.find((c: string[]) => c[0] === 'queue:dlq');
    expect(dlqCall).toBeDefined();
    // Should NOT re-queue in scrape queue
    const scrapeCall = mockRpush.mock.calls.find((c: string[]) => c[0] === 'queue:scrape');
    expect(scrapeCall).toBeUndefined();
  });

  it('marks DLQ jobs with status DLQ in stored state', async () => {
    const job = makeJob({ retries: 2, maxRetries: 3 });
    mockLpop.mockResolvedValueOnce(job.id);
    cacheGet.mockResolvedValue(JSON.stringify(job));

    registerJobHandler('scrape', async () => { throw new Error('fail'); });
    await processNextJob('scrape');

    const dlqWrite = cacheSet.mock.calls.find(
      (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('"DLQ"'),
    );
    expect(dlqWrite).toBeDefined();
  });
});

// ── getDLQJobs ────────────────────────────────────────────────────────────────

describe('getDLQJobs', () => {
  it('returns empty array when DLQ is empty', async () => {
    mockLrange.mockResolvedValueOnce([]);
    const jobs = await getDLQJobs();
    expect(jobs).toEqual([]);
  });

  it('returns job IDs from the DLQ', async () => {
    mockLrange.mockResolvedValueOnce(['scrape_123', 'email_456']);
    const jobs = await getDLQJobs();
    expect(jobs).toHaveLength(2);
    expect(jobs).toContain('scrape_123');
  });

  it('returns empty array when Redis is unavailable', async () => {
    mockLrange.mockRejectedValueOnce(new Error('Redis down'));
    const jobs = await getDLQJobs();
    expect(jobs).toEqual([]);
  });
});

// ── retryDLQJob ───────────────────────────────────────────────────────────────

describe('retryDLQJob', () => {
  it('returns false when job not found', async () => {
    cacheGet.mockResolvedValueOnce(null);
    expect(await retryDLQJob('nonexistent')).toBe(false);
  });

  it('returns false when job is not in DLQ status', async () => {
    const job = makeJob({ status: 'COMPLETED' });
    cacheGet.mockResolvedValueOnce(JSON.stringify(job));
    expect(await retryDLQJob(job.id)).toBe(false);
  });

  it('re-enqueues a DLQ job and resets retries', async () => {
    const job = makeJob({ status: 'DLQ', retries: 3 });
    cacheGet.mockResolvedValueOnce(JSON.stringify(job));

    const result = await retryDLQJob(job.id);
    expect(result).toBe(true);

    // Should update state to PENDING with retries=0
    const pendingWrite = cacheSet.mock.calls.find(
      (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('"PENDING"'),
    );
    expect(pendingWrite).toBeDefined();

    // Should push back to origin queue
    expect(mockRpush).toHaveBeenCalledWith(`queue:${job.type}`, job.id);
    // Should remove from DLQ
    expect(mockLrem).toHaveBeenCalledWith('queue:dlq', 0, job.id);
  });
});
