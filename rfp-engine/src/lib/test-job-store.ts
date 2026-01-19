/**
 * Simple in-memory job store for test extractions.
 * Note: Results won't persist across cold starts - this is fine for testing.
 */

export interface TestJob {
  id: string;
  status: 'processing' | 'complete' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// In-memory store with auto-cleanup after 1 hour
const jobs = new Map<string, TestJob>();
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

// Cleanup old jobs periodically
function cleanupOldJobs() {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt.getTime() > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

export function createTestJob(id: string): TestJob {
  cleanupOldJobs();
  const job: TestJob = {
    id,
    status: 'processing',
    createdAt: new Date(),
  };
  jobs.set(id, job);
  return job;
}

export function getTestJob(id: string): TestJob | undefined {
  return jobs.get(id);
}

export function completeTestJob(id: string, result: unknown): void {
  const job = jobs.get(id);
  if (job) {
    job.status = 'complete';
    job.result = result;
    job.completedAt = new Date();
  }
}

export function failTestJob(id: string, error: string): void {
  const job = jobs.get(id);
  if (job) {
    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
  }
}
