// ============================================================
// Complaint types — matches backend Prisma schema + DTOs
// ============================================================

export enum ComplaintStatus {
  SUBMITTED = 'SUBMITTED',           // Citizen submitted
  UNDER_REVIEW = 'UNDER_REVIEW',     // HOD/Supervisor reviewing
  ASSIGNED = 'ASSIGNED',             // Assigned to field worker
  IN_PROGRESS = 'IN_PROGRESS',       // Worker started work
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Work done, waiting approval
  COMPLETED = 'COMPLETED',           // Approved and completed
  REJECTED = 'REJECTED',             // Rejected with reason
  CLOSED = 'CLOSED',                 // Finalized and closed
}

export enum ComplaintPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum RejectionReason {
  DUPLICATE = 'DUPLICATE',
  INVALID_CATEGORY = 'INVALID_CATEGORY',
  INSUFFICIENT_INFO = 'INSUFFICIENT_INFO',
  OUT_OF_JURISDICTION = 'OUT_OF_JURISDICTION',
  NOT_MUNICIPAL_ISSUE = 'NOT_MUNICIPAL_ISSUE',
  ALREADY_RESOLVED = 'ALREADY_RESOLVED',
  OTHER = 'OTHER',
}

export enum AttachmentType {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
}

export enum AttachmentStage {
  SUBMISSION = 'SUBMISSION',   // Initial complaint photos
  PROOF = 'PROOF',             // Work completion proof
  INSPECTION = 'INSPECTION',   // Supervisor inspection
}

export type ComplaintRiskReason = 'UNVERIFIED_EMAIL' | 'UNVERIFIED_KYC';

/** Staff-only metadata for location-based municipality routing. */
export interface ComplaintLocationRoutingInfo {
  isExternalCitizenReport?: boolean;
  operationalMunicipality?: { id: string; name: string; code: string } | null;
  reporterRegisteredMunicipality?: { id: string; name: string; code: string } | null;
  municipalityResolutionMethod?: string | null;
  municipalityResolutionCandidates?: unknown;
  reporterVerificationStatus?: string | null;
}

/** Staff-only metadata for lower-trust citizen submissions. */
export interface ComplaintRiskInfo {
  isRiskySubmission: boolean;
  riskReasons: ComplaintRiskReason[];
  submittedByEmailVerified?: boolean | null;
  submittedByKycVerified?: boolean | null;
}

export interface ComplaintSummary extends ComplaintLocationRoutingInfo {
  id: string;
  referenceCode: string | null;
  title: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  category: { id: string; name: string };
  department?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  address?: string | null;
  dueDate?: string | null;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Present only for staff/admin API responses when the submitter was unverified. */
  isRiskySubmission?: boolean;
  riskReasons?: ComplaintRiskReason[];
  submittedByEmailVerified?: boolean | null;
  submittedByKycVerified?: boolean | null;
}

export interface ComplaintDetail extends ComplaintSummary {
  description: string;
  latitude?: string | null;
  longitude?: string | null;
  rejectionReason?: RejectionReason | null;
  rejectionNotes?: string | null;
  resolvedAt?: string | null;
  escalatedAt?: string | null;
  attachments: ComplaintAttachment[];
  currentAssignment?: ComplaintAssignment | null;
  statusHistory: ComplaintStatusLog[];
  feedback?: ComplaintFeedback | null;
  /**
   * True when the caller is reading this complaint only because their
   * department has a pending inbound transfer/help request. The response
   * has been sanitized (no internal notes, no citizen identity, no proof
   * photos, no assignee identity). Frontend should render a banner and
   * hide actions that would fail server-side authorization.
   */
  previewOnly?: boolean;
}

export interface ComplaintAttachment {
  id: string;
  type: AttachmentType;
  stage: AttachmentStage;
  url: string;
  filename: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
}

export interface ComplaintAssignment {
  assignedTo: { id: string; firstName: string; lastName: string };
  assignedBy: { id: string; firstName: string; lastName: string };
  notes?: string | null;
  createdAt: string;
}

export interface ComplaintStatusLog {
  id: string;
  fromStatus: ComplaintStatus | null;
  toStatus: ComplaintStatus;
  changedBy: { id: string; firstName: string; lastName: string };
  notes?: string | null;
  createdAt: string;
}

export interface ComplaintFeedback {
  id: string;
  rating: number; // 1-5
  comment?: string | null;
  createdAt: string;
}

// ============================================================
// Request DTOs
// ============================================================

export interface CreateComplaintRequest {
  categoryId: string;
  title: string;
  description: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export type ComplaintBucketId =
  | 'needsAttention'
  | 'assignedToMe'
  | 'myDepartment'
  | 'all'
  | 'overdue'
  | 'myReports'
  | 'completed'
  | 'rejected'
  | 'closed'
  | 'history';

export interface ComplaintQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ComplaintStatus | ComplaintStatus[];
  priority?: ComplaintPriority | ComplaintPriority[];
  categoryId?: string;
  departmentId?: string;
  /** Staff (view_all): complaints with departmentId = null */
  unrouted?: boolean;
  myAssignments?: boolean;
  unassigned?: boolean;
  overdue?: boolean;
  /** Excludes COMPLETED / CLOSED / REJECTED so the action-queue list matches its count. */
  openOnly?: boolean;
  /** History view — terminal complaints only (COMPLETED / REJECTED / CLOSED). */
  terminalOnly?: boolean;
  /**
   * Worker history: when true the assignment filter ignores `isActive`, so
   * a worker can see closed work they were previously assigned to.
   */
  includeAssignmentHistory?: boolean;
  /** Staff only: complaints from unverified citizens. */
  riskyOnly?: boolean;
  /** Staff inbox bucket — same filters as GET /complaints/stats/buckets */
  bucket?: ComplaintBucketId;
}

export interface AssignComplaintRequest {
  assignedToId: string;
  notes?: string;
}

export interface ChangeStatusRequest {
  status: ComplaintStatus;
  notes?: string;
}

export interface SetPriorityRequest {
  priority: ComplaintPriority;
  dueDate?: string; // ISO date string
}

export interface RejectComplaintRequest {
  reason: RejectionReason;
  notes?: string;
}

export interface ClassifyComplaintRequest {
  categoryId: string;
}

export interface ClassifyComplaintResponse {
  id: string;
  categoryId: string;
  departmentId: string | null;
  category: { id: string; name: string };
}

export interface ComplaintMapPoint {
  id: string;
  referenceCode: string | null;
  title: string;
  latitude: number;
  longitude: number;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  category: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
  };
  department?: {
    id: string;
    name: string;
    nameAr?: string | null;
    nameFr?: string | null;
  } | null;
  address?: string | null;
  createdAt: string;
}

export interface ComplaintMapPointsResponse {
  points: ComplaintMapPoint[];
  center: { latitude: number; longitude: number };
  boundary?: {
    geojson: { type: string; coordinates: unknown };
    bounds: [number, number, number, number];
  } | null;
  total: number;
}

export interface ComplaintMapPointsQueryParams {
  status?: ComplaintStatus | ComplaintStatus[];
  priority?: ComplaintPriority | ComplaintPriority[];
  categoryId?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface SubmitFeedbackRequest {
  rating: number; // 1-5
  comment?: string;
}
