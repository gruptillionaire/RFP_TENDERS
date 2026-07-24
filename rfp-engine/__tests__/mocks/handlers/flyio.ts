/**
 * Fly.io Extraction Worker Mock Handlers
 * Mocks extraction initiation and status polling
 */

import { http, HttpResponse, delay } from 'msw';

// Mock extraction jobs store
interface MockExtractionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  requirements?: MockRequirement[];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface MockRequirement {
  id: string;
  category: string;
  text: string;
  mandatory: boolean;
  pageNumber?: number;
  sectionNumber?: string;
}

const extractionJobs = new Map<string, MockExtractionJob>();

// Configurable behavior
let autoComplete = true;
let completionDelay = 100; // ms
let shouldFail = false;
let failureMessage = 'Extraction failed';

// Configure mock behavior
export function setAutoComplete(complete: boolean): void {
  autoComplete = complete;
}

export function setCompletionDelay(ms: number): void {
  completionDelay = ms;
}

export function setExtractionFailure(fail: boolean, message = 'Extraction failed'): void {
  shouldFail = fail;
  failureMessage = message;
}

export function resetFlyIOMocks(): void {
  extractionJobs.clear();
  autoComplete = true;
  completionDelay = 100;
  shouldFail = false;
  failureMessage = 'Extraction failed';
}

// Get a specific job (for test assertions)
export function getExtractionJob(jobId: string): MockExtractionJob | undefined {
  return extractionJobs.get(jobId);
}

// Manually complete a job
export function completeExtractionJob(jobId: string, requirements: MockRequirement[]): void {
  const job = extractionJobs.get(jobId);
  if (job) {
    job.status = 'completed';
    job.progress = 100;
    job.requirements = requirements;
    job.completedAt = new Date();
  }
}

// Manually fail a job
export function failExtractionJob(jobId: string, error: string): void {
  const job = extractionJobs.get(jobId);
  if (job) {
    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date();
  }
}

// Default mock requirements for completed jobs
const DEFAULT_MOCK_REQUIREMENTS: MockRequirement[] = [
  {
    id: 'req-1',
    category: 'Technical',
    text: 'The system shall support user authentication with multi-factor authentication.',
    mandatory: true,
    pageNumber: 5,
    sectionNumber: '2.1',
  },
  {
    id: 'req-2',
    category: 'Technical',
    text: 'The solution must integrate with existing Active Directory infrastructure.',
    mandatory: true,
    pageNumber: 6,
    sectionNumber: '2.2',
  },
  {
    id: 'req-3',
    category: 'Security',
    text: 'All data at rest must be encrypted using AES-256 encryption.',
    mandatory: true,
    pageNumber: 12,
    sectionNumber: '4.1',
  },
  {
    id: 'req-4',
    category: 'Compliance',
    text: 'The vendor should demonstrate SOC 2 Type II compliance.',
    mandatory: false,
    pageNumber: 15,
    sectionNumber: '5.1',
  },
  {
    id: 'req-5',
    category: 'Support',
    text: 'Vendor shall provide 24/7 technical support with 4-hour response time SLA.',
    mandatory: true,
    pageNumber: 20,
    sectionNumber: '6.1',
  },
];

// Generate unique job ID
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export const flyioHandlers = [
  // Start extraction
  http.post('https://rfp-extraction-worker.fly.dev/extract', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file');
    const projectId = formData.get('projectId');

    if (!file || !projectId) {
      return HttpResponse.json(
        { error: 'Missing file or projectId' },
        { status: 400 }
      );
    }

    const jobId = generateJobId();

    const job: MockExtractionJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };

    extractionJobs.set(jobId, job);

    // Auto-complete job after delay if configured
    if (autoComplete && !shouldFail) {
      setTimeout(() => {
        const j = extractionJobs.get(jobId);
        if (j && j.status !== 'completed' && j.status !== 'failed') {
          j.status = 'processing';
          j.progress = 50;
        }
      }, completionDelay / 2);

      setTimeout(() => {
        const j = extractionJobs.get(jobId);
        if (j && j.status !== 'completed' && j.status !== 'failed') {
          j.status = 'completed';
          j.progress = 100;
          j.requirements = DEFAULT_MOCK_REQUIREMENTS;
          j.completedAt = new Date();
        }
      }, completionDelay);
    } else if (shouldFail) {
      setTimeout(() => {
        const j = extractionJobs.get(jobId);
        if (j) {
          j.status = 'failed';
          j.error = failureMessage;
          j.completedAt = new Date();
        }
      }, completionDelay);
    }

    return HttpResponse.json({
      jobId,
      status: 'pending',
    });
  }),

  // Check extraction status
  http.get('https://rfp-extraction-worker.fly.dev/status/:jobId', async ({ params }) => {
    await delay(10); // Small delay to simulate network

    const job = extractionJobs.get(params.jobId as string);

    if (!job) {
      return HttpResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      requirements: job.requirements,
      error: job.error,
    });
  }),

  // Get extraction results
  http.get('https://rfp-extraction-worker.fly.dev/results/:jobId', async ({ params }) => {
    const job = extractionJobs.get(params.jobId as string);

    if (!job) {
      return HttpResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (job.status !== 'completed') {
      return HttpResponse.json(
        { error: 'Job not completed' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      jobId: job.id,
      requirements: job.requirements,
      completedAt: job.completedAt?.toISOString(),
    });
  }),
];
