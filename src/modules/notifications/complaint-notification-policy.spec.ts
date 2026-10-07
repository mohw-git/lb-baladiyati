import { ComplaintStatus } from '@prisma/client';
import { shouldNotifyCitizenOfStatusChange } from './complaint-notification-policy';

describe('shouldNotifyCitizenOfStatusChange', () => {
  it('returns false for SUBMITTED (creation uses separate notification)', () => {
    expect(shouldNotifyCitizenOfStatusChange(ComplaintStatus.SUBMITTED)).toBe(
      false,
    );
  });

  it.each([
    ComplaintStatus.UNDER_REVIEW,
    ComplaintStatus.ASSIGNED,
    ComplaintStatus.IN_PROGRESS,
    ComplaintStatus.PENDING_APPROVAL,
    ComplaintStatus.COMPLETED,
    ComplaintStatus.REJECTED,
    ComplaintStatus.CLOSED,
  ])('returns true for user-facing status %s', (status) => {
    expect(shouldNotifyCitizenOfStatusChange(status)).toBe(true);
  });
});
