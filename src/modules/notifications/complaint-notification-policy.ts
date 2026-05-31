import { ComplaintStatus } from '@prisma/client';

/**
 * Citizen push/in-app status updates — exclude SUBMITTED (creation has its own
 * flow) and other internal-only transitions.
 */
const CITIZEN_STATUS_NOTIFICATION_STATUSES = new Set<ComplaintStatus>([
  ComplaintStatus.UNDER_REVIEW,
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.PENDING_APPROVAL,
  ComplaintStatus.COMPLETED,
  ComplaintStatus.REJECTED,
  ComplaintStatus.CLOSED,
]);

export function shouldNotifyCitizenOfStatusChange(status: ComplaintStatus): boolean {
  return CITIZEN_STATUS_NOTIFICATION_STATUSES.has(status);
}
