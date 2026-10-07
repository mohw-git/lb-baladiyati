export type HelpRequestStatus =
  | 'PENDING_SOURCE_APPROVAL'
  | 'SOURCE_REJECTED'
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'REJECTED'
  | 'CANCELLED';

interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface HelpAttachment {
  url: string;
  filename: string;
  mime: string;
  size?: number;
}

export interface HelpRequest {
  id: string;
  municipalityId: string;
  complaintId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  fromDepartment?: { id: string; name: string; headUserId?: string | null };
  toDepartment?:   { id: string; name: string; headUserId?: string | null };
  complaint?:      { id: string; title: string; referenceCode: string | null };

  requestedById: string;
  requestedBy?:  UserRef;
  reason: string;

  status: HelpRequestStatus;

  sourceApprovedById: string | null;
  sourceApprovedBy?: UserRef | null;
  sourceApprovedAt: string | null;
  sourceRejectedById: string | null;
  sourceRejectedBy?: UserRef | null;
  sourceRejectedAt: string | null;
  sourceRejectReason: string | null;

  respondedById: string | null;
  respondedBy?:  UserRef | null;
  respondedAt:   string | null;
  responseReason: string | null;

  helperAssigneeId: string | null;
  helperAssignee?:  UserRef | null;

  submittedById: string | null;
  submittedBy?:  UserRef | null;
  submittedAt:   string | null;
  solutionNotes: string | null;
  solutionAttachments: HelpAttachment[] | null;

  closedById: string | null;
  closedBy?:  UserRef | null;
  closedAt:   string | null;
  closeReason: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateHelpRequest {
  toDepartmentId: string;
  reason: string;
}

export interface RespondHelpRequest {
  note?: string;
}

export interface AssignHelpRequest {
  helperAssigneeId: string;
  note?: string;
}

export interface SubmitHelpRequest {
  notes: string;
  attachments?: HelpAttachment[];
}

export interface CloseHelpRequest {
  reason?: string;
}

export type HelpRequestQueue =
  | 'sourceApproval'
  | 'incoming'
  | 'needsAssignment'
  | 'inProgress'
  | 'awaitingSourceReview'
  | 'myAssignments'
  | 'history';

export interface HelpComplaintContext {
  id: string;
  referenceCode: string | null;
  title: string;
  description: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: string;
  category: { id: string; name: string; nameAr?: string | null; nameFr?: string | null } | null;
  owningDepartment: { id: string; name: string } | null;
  attachments: {
    id: string;
    url: string;
    filename: string;
    mime: string;
    stage: string;
    createdAt: string;
  }[];
}

export interface HelpTimelineEvent {
  id: string;
  eventKind: string | null;
  notes: string | null;
  createdAt: string;
  changedBy: { id: string; firstName: string; lastName: string } | null;
}

export interface HelpRequestDetail extends HelpRequest {
  complaintContext: HelpComplaintContext | null;
  timeline: HelpTimelineEvent[];
}

export interface HelpRequestQueryParams {
  page?: number;
  limit?: number;
  status?: HelpRequestStatus;
  inbox?: boolean;
  outgoing?: boolean;
  /** Outgoing queue: only help requests awaiting source dept approval */
  sourceApproval?: boolean;
  complaintId?: string;
  queue?: HelpRequestQueue;
}

export interface HelpPendingCounts {
  /** Receiver inbox: awaiting helper-dept decision */
  count: number;
  receiverCount: number;
  /** Source dept: worker requests awaiting Supervisor/HOD approval */
  sourceCount: number;
  needsAssignmentCount: number;
  inProgressCount: number;
  awaitingSourceReviewCount: number;
  myAssignmentsCount: number;
}
