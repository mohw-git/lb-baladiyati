import { Injectable, BadRequestException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';

/**
 * Government Workflow Status Transitions:
 * 
 * 1. SUBMITTED - Citizen submits complaint
 *    → UNDER_REVIEW (HOD/Supervisor reviews)
 *    → REJECTED (Invalid complaint)
 * 
 * 2. UNDER_REVIEW - Being reviewed by department
 *    → ASSIGNED (Assigned to field worker)
 *    → REJECTED (After review, not actionable)
 * 
 * 3. ASSIGNED - Worker notified of new task
 *    → IN_PROGRESS (Worker starts work)
 * 
 * 4. IN_PROGRESS - Work being done
 *    → PENDING_APPROVAL (Worker submits completion with proof)
 * 
 * 5. PENDING_APPROVAL - Waiting supervisor/HOD approval
 *    → COMPLETED (Approved by supervisor/HOD)
 *    → IN_PROGRESS (Rejected - needs more work)
 * 
 * 6. COMPLETED - Work approved
 *    → CLOSED (Finalized)
 * 
 * 7. REJECTED - Complaint rejected
 *    → CLOSED (Finalized)
 */
const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  SUBMITTED: [ComplaintStatus.UNDER_REVIEW, ComplaintStatus.REJECTED],
  UNDER_REVIEW: [ComplaintStatus.ASSIGNED, ComplaintStatus.REJECTED],
  ASSIGNED: [ComplaintStatus.IN_PROGRESS],
  IN_PROGRESS: [ComplaintStatus.PENDING_APPROVAL],
  PENDING_APPROVAL: [ComplaintStatus.COMPLETED, ComplaintStatus.IN_PROGRESS],
  COMPLETED: [ComplaintStatus.CLOSED],
  REJECTED: [ComplaintStatus.CLOSED],
  CLOSED: [],
};

// Transitions that field workers can make
const WORKER_TRANSITIONS: ComplaintStatus[] = [
  ComplaintStatus.IN_PROGRESS,
  ComplaintStatus.PENDING_APPROVAL,
];

// Transitions that require supervisor/HOD role
const SUPERVISOR_TRANSITIONS: ComplaintStatus[] = [
  ComplaintStatus.UNDER_REVIEW,
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.REJECTED,
];

// Transitions that require HOD approval authority
const APPROVAL_TRANSITIONS: ComplaintStatus[] = [
  ComplaintStatus.COMPLETED,
];

@Injectable()
export class StatusService {
  validateTransition(fromStatus: ComplaintStatus, toStatus: ComplaintStatus): void {
    const allowed = ALLOWED_TRANSITIONS[fromStatus];

    if (!allowed || !allowed.includes(toStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }
  }

  isWorkerTransition(toStatus: ComplaintStatus): boolean {
    return WORKER_TRANSITIONS.includes(toStatus);
  }

  isSupervisorTransition(toStatus: ComplaintStatus): boolean {
    return SUPERVISOR_TRANSITIONS.includes(toStatus);
  }

  isApprovalTransition(toStatus: ComplaintStatus): boolean {
    return APPROVAL_TRANSITIONS.includes(toStatus);
  }

  requiresProofAttachment(toStatus: ComplaintStatus): boolean {
    return toStatus === ComplaintStatus.PENDING_APPROVAL;
  }

  getAllowedTransitions(fromStatus: ComplaintStatus): ComplaintStatus[] {
    return ALLOWED_TRANSITIONS[fromStatus] || [];
  }

  /**
   * Get allowed transitions for a specific role
   */
  getAllowedTransitionsForRole(
    fromStatus: ComplaintStatus,
    canApprove: boolean,
    canVerify: boolean,
    isAssigned: boolean,
  ): ComplaintStatus[] {
    const allAllowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    
    return allAllowed.filter((status) => {
      // Workers can only make worker transitions if assigned
      if (WORKER_TRANSITIONS.includes(status)) {
        return isAssigned;
      }
      // Approval transitions require approval permission
      if (APPROVAL_TRANSITIONS.includes(status)) {
        return canApprove;
      }
      // Supervisor transitions require verify permission
      if (SUPERVISOR_TRANSITIONS.includes(status)) {
        return canVerify;
      }
      return true;
    });
  }
}
