/**
 * Project and Requirement Factories
 * Creates mock project and requirement data for testing
 */

// Types matching Prisma schema
export interface MockProject {
  id: string;
  name: string;
  companyName: string | null;
  fileName: string;
  fileUrl: string | null;
  rawText: string;
  deadline: Date | null;
  deadlineText: string | null;
  userId: string;
  status: 'PROCESSING' | 'READY' | 'COMPLETED' | 'FAILED';
  lastReminderSent: Date | null;
  lastReminderType: string | null;
  expiresAt: Date | null;
  isSingleUseProject: boolean;
  evaluationCriteria: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockRequirement {
  id: string;
  projectId: string;
  text: string;
  section: string | null;
  sectionGroup: string | null;
  isMandatory: boolean;
  draftAnswer: string | null;
  internalNotes: string | null;
  wordLimit: number | null;
  characterLimit: number | null;
  status: 'UNANSWERED' | 'PARTIAL' | 'ANSWERED';
  type: 'PROCEDURAL' | 'DECLARATIVE' | 'DESCRIPTIVE' | 'EVIDENCE_BASED' | 'CONTEXTUAL' | 'QUANTITATIVE' | 'REFERENCE_BASED' | 'STAFFING';
  domainContext: 'FEATURE' | 'PROCESS' | 'LEGAL';
  requiresReview: boolean;
  isManuallyAdded: boolean;
  order: number;
  isAttestation: boolean;
  complianceStatus: 'PENDING' | 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE';
  createdAt: Date;
  updatedAt: Date;
}

// Counters for generating unique IDs
let projectCounter = 0;
let requirementCounter = 0;

// Generate unique IDs
function generateProjectId(): string {
  projectCounter++;
  return `proj_test_${projectCounter}_${Math.random().toString(36).substring(7)}`;
}

function generateRequirementId(): string {
  requirementCounter++;
  return `req_test_${requirementCounter}_${Math.random().toString(36).substring(7)}`;
}

// Sample RFP text for testing
const SAMPLE_RFP_TEXT = `
REQUEST FOR PROPOSAL (RFP)

PROJECT: Enterprise Software Solution
DEADLINE: March 15, 2025

SECTION 1: TECHNICAL REQUIREMENTS

1.1 The system shall support user authentication with multi-factor authentication.
1.2 The solution must integrate with existing Active Directory infrastructure.
1.3 All data at rest must be encrypted using AES-256 encryption.

SECTION 2: COMPLIANCE REQUIREMENTS

2.1 The vendor should demonstrate SOC 2 Type II compliance.
2.2 The solution must comply with GDPR requirements.

SECTION 3: SUPPORT REQUIREMENTS

3.1 Vendor shall provide 24/7 technical support with 4-hour response time SLA.
3.2 Vendor should offer training for end users.
`;

export interface CreateProjectOptions {
  id?: string;
  name?: string;
  companyName?: string | null;
  fileName?: string;
  fileUrl?: string | null;
  rawText?: string;
  deadline?: Date | null;
  deadlineText?: string | null;
  userId: string;
  status?: MockProject['status'];
  isSingleUseProject?: boolean;
  expiresAt?: Date | null;
}

/**
 * Create a mock project object
 */
export function createMockProject(options: CreateProjectOptions): MockProject {
  const now = new Date();

  return {
    id: options.id || generateProjectId(),
    name: options.name || 'Test RFP Project',
    companyName: options.companyName ?? 'Test Company Inc.',
    fileName: options.fileName || 'test-rfp.pdf',
    fileUrl: options.fileUrl ?? null,
    rawText: options.rawText || SAMPLE_RFP_TEXT,
    deadline: options.deadline ?? null,
    deadlineText: options.deadlineText ?? null,
    userId: options.userId,
    status: options.status || 'READY',
    lastReminderSent: null,
    lastReminderType: null,
    expiresAt: options.expiresAt ?? null,
    isSingleUseProject: options.isSingleUseProject ?? false,
    evaluationCriteria: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create project data for database insertion
 */
export function createProjectData(options: CreateProjectOptions): Omit<MockProject, 'createdAt' | 'updatedAt'> {
  const mockProject = createMockProject(options);
  const { createdAt: _, updatedAt: __, ...data } = mockProject;
  return data;
}

export interface CreateRequirementOptions {
  id?: string;
  projectId: string;
  text?: string;
  section?: string | null;
  sectionGroup?: string | null;
  isMandatory?: boolean;
  draftAnswer?: string | null;
  internalNotes?: string | null;
  wordLimit?: number | null;
  status?: MockRequirement['status'];
  type?: MockRequirement['type'];
  domainContext?: MockRequirement['domainContext'];
  order?: number;
  isAttestation?: boolean;
  complianceStatus?: MockRequirement['complianceStatus'];
  isManuallyAdded?: boolean;
}

/**
 * Create a mock requirement object
 */
export function createMockRequirement(options: CreateRequirementOptions): MockRequirement {
  const now = new Date();
  requirementCounter++;

  return {
    id: options.id || generateRequirementId(),
    projectId: options.projectId,
    text: options.text || 'The system shall support user authentication.',
    section: options.section ?? '1.1',
    sectionGroup: options.sectionGroup ?? 'SECTION 1: TECHNICAL REQUIREMENTS',
    isMandatory: options.isMandatory ?? true,
    draftAnswer: options.draftAnswer ?? null,
    internalNotes: options.internalNotes ?? null,
    wordLimit: options.wordLimit ?? null,
    characterLimit: null,
    status: options.status || 'UNANSWERED',
    type: options.type || 'DECLARATIVE',
    domainContext: options.domainContext || 'FEATURE',
    requiresReview: false,
    isManuallyAdded: options.isManuallyAdded ?? false,
    order: options.order ?? requirementCounter,
    isAttestation: options.isAttestation ?? false,
    complianceStatus: options.complianceStatus || 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create requirement data for database insertion
 */
export function createRequirementData(options: CreateRequirementOptions): Omit<MockRequirement, 'createdAt' | 'updatedAt'> {
  const mockReq = createMockRequirement(options);
  const { createdAt: _, updatedAt: __, ...data } = mockReq;
  return data;
}

/**
 * Create a set of sample requirements for a project
 */
export function createSampleRequirements(projectId: string, count: number = 5): MockRequirement[] {
  const requirements: MockRequirement[] = [];

  const samples = [
    { text: 'The system shall support user authentication with multi-factor authentication.', section: '1.1', isMandatory: true, type: 'DECLARATIVE' as const },
    { text: 'The solution must integrate with existing Active Directory infrastructure.', section: '1.2', isMandatory: true, type: 'DECLARATIVE' as const },
    { text: 'All data at rest must be encrypted using AES-256 encryption.', section: '1.3', isMandatory: true, type: 'DECLARATIVE' as const },
    { text: 'The vendor should demonstrate SOC 2 Type II compliance.', section: '2.1', isMandatory: false, type: 'EVIDENCE_BASED' as const },
    { text: 'Describe your disaster recovery procedures.', section: '2.2', isMandatory: true, type: 'DESCRIPTIVE' as const },
    { text: 'Vendor shall provide 24/7 technical support with 4-hour response time SLA.', section: '3.1', isMandatory: true, type: 'PROCEDURAL' as const },
    { text: 'Provide resumes for key personnel.', section: '3.2', isMandatory: false, type: 'STAFFING' as const },
    { text: 'What is your average response time for critical issues?', section: '4.1', isMandatory: true, type: 'QUANTITATIVE' as const },
  ];

  for (let i = 0; i < Math.min(count, samples.length); i++) {
    requirements.push(createMockRequirement({
      projectId,
      ...samples[i],
      order: i + 1,
    }));
  }

  return requirements;
}

/**
 * Create a project with requirements
 */
export function createProjectWithRequirements(
  userId: string,
  requirementCount: number = 5
): { project: MockProject; requirements: MockRequirement[] } {
  const project = createMockProject({ userId });
  const requirements = createSampleRequirements(project.id, requirementCount);

  return { project, requirements };
}

/**
 * Get sample RFP text
 */
export function getSampleRfpText(): string {
  return SAMPLE_RFP_TEXT;
}

/**
 * Reset counters (call in beforeEach if needed)
 */
export function resetProjectFactory(): void {
  projectCounter = 0;
  requirementCounter = 0;
}
