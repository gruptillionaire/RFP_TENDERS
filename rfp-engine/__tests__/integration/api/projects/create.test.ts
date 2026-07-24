/**
 * Project Creation API Integration Tests
 * Tests POST /api/projects
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSession } from '../../../setup/test-utils';

// Use vi.hoisted for variables referenced in vi.mock
const mockAuth = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $executeRaw: vi.fn(),
}));

const mockCheckQuota = vi.hoisted(() => vi.fn());
const mockGetSingleUseStatus = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
  setRLSContext: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimiters: {
    projects: vi.fn().mockResolvedValue({ success: true, remaining: 10 }),
  },
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/quota', () => ({
  checkAndIncrementQuota: mockCheckQuota,
  getSingleUseQuotaStatus: mockGetSingleUseStatus,
}));

vi.mock('@/lib/parsers/pdf', () => ({
  parsePDF: vi.fn().mockResolvedValue('Extracted PDF text with requirements'),
}));

vi.mock('@/lib/parsers/docx', () => ({
  parseDOCX: vi.fn().mockResolvedValue('Extracted DOCX text with requirements'),
}));

vi.mock('file-type', () => ({
  default: {
    fromBuffer: vi.fn().mockResolvedValue({ mime: 'application/pdf' }),
  },
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
  AuditAction: { PROJECT_CREATE: 'project.create' },
  AuditResource: { PROJECT: 'project' },
}));

// Import the route handler after mocking
import { POST, GET } from '@/app/api/projects/route';

describe('Projects API', () => {
  const testUserId = 'user-123';
  const testEmail = 'test@example.com';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(createMockSession(testUserId, testEmail));
    mockPrisma.user.findUnique.mockResolvedValue({
      id: testUserId,
      emailVerified: new Date(),
    });
    mockCheckQuota.mockResolvedValue({ allowed: true, remaining: 10, limit: 10 });
    mockGetSingleUseStatus.mockResolvedValue({ hasCredits: false, extractionsRemaining: 0 });
    mockPrisma.project.findFirst.mockResolvedValue(null);
  });

  describe('POST /api/projects', () => {
    function createProjectFormData(
      file: { name: string; content: string | Buffer },
      options: { name?: string; allowDuplicate?: boolean } = {}
    ): FormData {
      const formData = new FormData();
      const blob = new Blob([file.content], { type: 'application/pdf' });
      const mockFile = new File([blob], file.name, { type: 'application/pdf' });
      formData.append('file', mockFile);

      if (options.name) {
        formData.append('name', options.name);
      }
      if (options.allowDuplicate) {
        formData.append('allowDuplicate', 'true');
      }

      return formData;
    }

    describe('authentication', () => {
      it('rejects unauthenticated requests', async () => {
        mockAuth.mockResolvedValue(null);

        const formData = createProjectFormData({ name: 'test.pdf', content: 'PDF content' });
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
      });

      it('rejects unverified email users', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
          id: testUserId,
          emailVerified: null,
        });

        const formData = createProjectFormData({ name: 'test.pdf', content: 'PDF content' });
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toContain('verify');
      });
    });

    describe('quota enforcement', () => {
      it('rejects request when quota exceeded', async () => {
        mockCheckQuota.mockResolvedValue({ allowed: false, remaining: 0, limit: 2 });

        const formData = createProjectFormData({ name: 'test.pdf', content: 'PDF content' });
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toContain('credits');
      });

      it('allows request with single-use credits', async () => {
        mockCheckQuota.mockResolvedValue({ allowed: false, remaining: 0, limit: 0 });
        mockGetSingleUseStatus.mockResolvedValue({
          hasCredits: true,
          extractionsRemaining: 1,
          draftsRemaining: 60,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        mockPrisma.project.create.mockResolvedValue({
          id: 'project-123',
          name: 'test',
          status: 'PROCESSING',
        });

        const formData = createProjectFormData({ name: 'test.pdf', content: 'PDF content' });
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('PROCESSING');
      });
    });

    describe('file validation', () => {
      it('rejects request without file', async () => {
        const formData = new FormData();
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toContain('file');
      });
    });

    describe('duplicate handling', () => {
      it('rejects duplicate filename by default', async () => {
        mockPrisma.project.findFirst.mockResolvedValueOnce(null);
        mockPrisma.project.findFirst.mockResolvedValueOnce({
          id: 'existing-project',
          name: 'Existing Project',
          status: 'READY',
        });

        const formData = createProjectFormData({ name: 'duplicate.pdf', content: 'PDF content' });
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe('duplicate');
        expect(body.existingProjectId).toBe('existing-project');
      });

      it('allows duplicate when allowDuplicate is true', async () => {
        mockPrisma.project.create.mockResolvedValue({
          id: 'project-123',
          name: 'test',
          status: 'PROCESSING',
        });

        const formData = createProjectFormData(
          { name: 'test.pdf', content: 'PDF content' },
          { allowDuplicate: true }
        );
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
      });
    });

    describe('processing conflict handling', () => {
      it('blocks upload when another project is processing', async () => {
        mockPrisma.project.findFirst.mockResolvedValue({
          id: 'processing-project',
          name: 'Processing Project',
          status: 'PROCESSING',
          createdAt: new Date(),
        });

        const formData = createProjectFormData({ name: 'test.pdf', content: 'PDF content' });
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe('processing');
      });
    });

    describe('successful creation', () => {
      it('creates project in PROCESSING state', async () => {
        mockPrisma.project.create.mockResolvedValue({
          id: 'project-123',
          name: 'Test Project',
          status: 'PROCESSING',
        });

        const formData = createProjectFormData(
          { name: 'test.pdf', content: 'PDF content' },
          { name: 'Test Project' }
        );
        const request = new Request('http://localhost:3000/api/projects', {
          method: 'POST',
          body: formData,
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.id).toBe('project-123');
        expect(body.name).toBe('Test Project');
        expect(body.status).toBe('PROCESSING');
      });
    });
  });

  describe('GET /api/projects', () => {
    it('returns empty array when no projects', async () => {
      mockPrisma.project.findMany.mockResolvedValue([]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual([]);
    });

    it('returns user projects with requirement counts', async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        {
          id: 'project-1',
          name: 'Project 1',
          status: 'READY',
          _count: { requirements: 25 },
        },
        {
          id: 'project-2',
          name: 'Project 2',
          status: 'PROCESSING',
          _count: { requirements: 0 },
        },
      ]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(2);
      expect(body[0]._count.requirements).toBe(25);
    });

    it('rejects unauthenticated requests', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });
  });
});
