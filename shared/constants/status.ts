import { ComplaintStatus, ComplaintPriority, RejectionReason } from '../types/complaint';

/**
 * Human-readable labels for complaint statuses. DB enum stays COMPLETED, but
 * the user-facing label is "Resolved" to match the operational meaning
 * (HOD approved the worker's submission). CLOSED is reserved for the
 * future manual-archive flow.
 */
export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  [ComplaintStatus.SUBMITTED]: 'Submitted',
  [ComplaintStatus.UNDER_REVIEW]: 'Under Review',
  [ComplaintStatus.ASSIGNED]: 'Assigned',
  [ComplaintStatus.IN_PROGRESS]: 'In Progress',
  [ComplaintStatus.PENDING_APPROVAL]: 'Pending Approval',
  [ComplaintStatus.COMPLETED]: 'Resolved',
  [ComplaintStatus.REJECTED]: 'Rejected',
  [ComplaintStatus.CLOSED]: 'Closed',
};

/** Tailwind-compatible color classes for status badges */
export const STATUS_COLORS: Record<ComplaintStatus, { bg: string; text: string }> = {
  [ComplaintStatus.SUBMITTED]: { bg: 'bg-blue-100', text: 'text-blue-700' },
  [ComplaintStatus.UNDER_REVIEW]: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  [ComplaintStatus.ASSIGNED]: { bg: 'bg-purple-100', text: 'text-purple-700' },
  [ComplaintStatus.IN_PROGRESS]: { bg: 'bg-orange-100', text: 'text-orange-700' },
  [ComplaintStatus.PENDING_APPROVAL]: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  [ComplaintStatus.COMPLETED]: { bg: 'bg-green-100', text: 'text-green-700' },
  [ComplaintStatus.REJECTED]: { bg: 'bg-red-100', text: 'text-red-700' },
  [ComplaintStatus.CLOSED]: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

/** All statuses in workflow order */
export const STATUS_ORDER: ComplaintStatus[] = [
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.UNDER_REVIEW,
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.PENDING_APPROVAL,
  ComplaintStatus.COMPLETED,
  ComplaintStatus.CLOSED,
  ComplaintStatus.REJECTED,
];

// ============================================================
// Priority labels and colors
// ============================================================

export const PRIORITY_LABELS: Record<ComplaintPriority, string> = {
  [ComplaintPriority.LOW]: 'Low',
  [ComplaintPriority.MEDIUM]: 'Medium',
  [ComplaintPriority.HIGH]: 'High',
  [ComplaintPriority.URGENT]: 'Urgent',
};

export const PRIORITY_COLORS: Record<ComplaintPriority, { bg: string; text: string }> = {
  [ComplaintPriority.LOW]: { bg: 'bg-gray-100', text: 'text-gray-600' },
  [ComplaintPriority.MEDIUM]: { bg: 'bg-blue-100', text: 'text-blue-700' },
  [ComplaintPriority.HIGH]: { bg: 'bg-orange-100', text: 'text-orange-700' },
  [ComplaintPriority.URGENT]: { bg: 'bg-red-100', text: 'text-red-700' },
};

/** Default SLA hours by priority */
export const PRIORITY_SLA_HOURS: Record<ComplaintPriority, number> = {
  [ComplaintPriority.LOW]: 168,     // 7 days
  [ComplaintPriority.MEDIUM]: 72,   // 3 days
  [ComplaintPriority.HIGH]: 24,     // 1 day
  [ComplaintPriority.URGENT]: 4,    // 4 hours
};

// ============================================================
// Rejection reasons
// ============================================================

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  [RejectionReason.DUPLICATE]: 'Duplicate Complaint',
  [RejectionReason.INVALID_CATEGORY]: 'Invalid Category',
  [RejectionReason.INSUFFICIENT_INFO]: 'Insufficient Information',
  [RejectionReason.OUT_OF_JURISDICTION]: 'Outside Municipality Jurisdiction',
  [RejectionReason.NOT_MUNICIPAL_ISSUE]: 'Not a Municipal Issue',
  [RejectionReason.ALREADY_RESOLVED]: 'Already Resolved',
  [RejectionReason.OTHER]: 'Other',
};
