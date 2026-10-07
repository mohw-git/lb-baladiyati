import { ComplaintStatus } from '@shared/types/complaint';

/** Pin / cluster accent colors aligned with complaint lifecycle. */
export function complaintStatusColor(status: ComplaintStatus): string {
  switch (status) {
    case ComplaintStatus.SUBMITTED:
    case ComplaintStatus.UNDER_REVIEW:
      return '#d97706';
    case ComplaintStatus.ASSIGNED:
    case ComplaintStatus.IN_PROGRESS:
    case ComplaintStatus.PENDING_APPROVAL:
      return '#2563eb';
    case ComplaintStatus.COMPLETED:
    case ComplaintStatus.CLOSED:
      return '#16a34a';
    case ComplaintStatus.REJECTED:
      return '#dc2626';
    default:
      return '#64748b';
  }
}
