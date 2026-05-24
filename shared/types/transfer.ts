export type TransferTargetType = 'COMPLAINT' | 'TASK';
export type TransferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'AUTO_CANCELLED';

interface UserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface TransferRequest {
  id: string;
  municipalityId: string;
  targetType: TransferTargetType;
  targetId: string;
  fromDepartmentId: string;
  toDepartmentId: string;
  fromDepartment?: { id: string; name: string };
  toDepartment?: { id: string; name: string };
  requestedById: string;
  requestedBy?: UserRef;
  reason: string;
  status: TransferStatus;
  respondedById: string | null;
  respondedBy?: UserRef | null;
  respondedAt: string | null;
  responseReason: string | null;
  newAssigneeId: string | null;
  newAssignee?: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransferRequest {
  targetType: TransferTargetType;
  targetId: string;
  toDepartmentId: string;
  reason: string;
}

export interface AcceptTransferRequest {
  newAssigneeId: string;
  note?: string;
}

export interface RejectTransferRequest {
  reason: string;
}

export interface TransferQueryParams {
  page?: number;
  limit?: number;
  status?: TransferStatus;
  inbox?: boolean;
  outgoing?: boolean;
  targetType?: TransferTargetType;
}
