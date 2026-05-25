import { ComplaintStatus, Prisma } from '@prisma/client';
import { ComplaintQueryDto } from './dto/complaint-query.dto';

/** Terminal workflow statuses — keep in sync with ComplaintsService. */
export const TERMINAL_COMPLAINT_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.COMPLETED,
  ComplaintStatus.REJECTED,
  ComplaintStatus.CLOSED,
];

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

export function isTerminalStatus(status: ComplaintStatus): boolean {
  return TERMINAL_COMPLAINT_STATUSES.includes(status);
}

/** Active = not soft-deleted and not terminal. */
export function activeStatusWhere(): Prisma.EnumComplaintStatusFilter {
  return { notIn: TERMINAL_COMPLAINT_STATUSES };
}

/**
 * Merge `bucket` query param into explicit flags so list + counts share one
 * definition. Explicit query flags still win when both are set.
 */
export function resolveQueryFromBucket(
  query: ComplaintQueryDto,
): ComplaintQueryDto {
  if (!query.bucket) return query;

  const merged = Object.assign(
    Object.create(Object.getPrototypeOf(query)),
    query,
  ) as ComplaintQueryDto;

  switch (query.bucket) {
    case 'needsAttention':
      merged.unassigned = merged.unassigned ?? true;
      merged.openOnly = merged.openOnly ?? true;
      break;
    case 'assignedToMe':
      merged.myAssignments = merged.myAssignments ?? true;
      merged.openOnly = merged.openOnly ?? true;
      break;
    case 'myDepartment':
      merged.openOnly = merged.openOnly ?? true;
      break;
    case 'all':
      merged.openOnly = merged.openOnly ?? true;
      break;
    case 'overdue':
      merged.overdue = merged.overdue ?? true;
      merged.openOnly = merged.openOnly ?? true;
      break;
    case 'myReports':
      break;
    case 'completed':
      merged.status = merged.status ?? [ComplaintStatus.COMPLETED];
      merged.includeAssignmentHistory = merged.includeAssignmentHistory ?? true;
      merged.terminalOnly = merged.terminalOnly ?? false;
      break;
    case 'rejected':
      merged.status = merged.status ?? [ComplaintStatus.REJECTED];
      merged.includeAssignmentHistory = merged.includeAssignmentHistory ?? true;
      break;
    case 'closed':
      merged.status = merged.status ?? [ComplaintStatus.CLOSED];
      merged.includeAssignmentHistory = merged.includeAssignmentHistory ?? true;
      break;
    case 'history':
      merged.terminalOnly = merged.terminalOnly ?? true;
      merged.includeAssignmentHistory = merged.includeAssignmentHistory ?? true;
      break;
    default:
      break;
  }

  return merged;
}

/** Active operational buckets — status dropdown must not surface terminal rows. */
export function isActiveOperationalBucket(bucket?: ComplaintBucketId): boolean {
  if (!bucket) return false;
  return [
    'needsAttention',
    'assignedToMe',
    'myDepartment',
    'all',
    'overdue',
  ].includes(bucket);
}

export function buildOverdueWhere(now = new Date()): Prisma.ComplaintWhereInput {
  return {
    dueDate: { lt: now },
    status: activeStatusWhere(),
  };
}

export function buildNeedsAttentionWhere(
  base: Prisma.ComplaintWhereInput,
): Prisma.ComplaintWhereInput {
  return {
    AND: [
      base,
      { assignments: { none: { isActive: true } } },
      { status: activeStatusWhere() },
    ],
  };
}

export function buildMyDepartmentActiveWhere(
  departmentId: string,
  municipalityId: string,
): Prisma.ComplaintWhereInput {
  return {
    municipalityId,
    deletedAt: null,
    departmentId,
    status: activeStatusWhere(),
  };
}

export function buildAllActiveWhere(
  municipalityId: string,
): Prisma.ComplaintWhereInput {
  return {
    municipalityId,
    deletedAt: null,
    status: activeStatusWhere(),
  };
}
