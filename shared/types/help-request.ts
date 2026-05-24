export type HelpRequestStatus =
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

export interface HelpRequestQueryParams {
  page?: number;
  limit?: number;
  status?: HelpRequestStatus;
  inbox?: boolean;
  outgoing?: boolean;
  complaintId?: string;
}
