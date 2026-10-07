import { classificationConflictsWithAssignment } from './complaints-classification.util';

describe('classificationConflictsWithAssignment', () => {
  it('allows when assignee has no department', () => {
    expect(classificationConflictsWithAssignment('dept-a', null)).toBe(false);
    expect(classificationConflictsWithAssignment(null, null)).toBe(false);
  });

  it('blocks reclassifying to unrouted when assignee has a department', () => {
    expect(classificationConflictsWithAssignment(null, 'dept-a')).toBe(true);
  });

  it('blocks when departments differ', () => {
    expect(classificationConflictsWithAssignment('dept-a', 'dept-b')).toBe(true);
  });

  it('allows when departments match', () => {
    expect(classificationConflictsWithAssignment('dept-a', 'dept-a')).toBe(false);
  });
});
