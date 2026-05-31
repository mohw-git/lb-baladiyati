/**
 * Returns true when reclassifying would conflict with an active assignment.
 * Mirrors cross-department assignment rules: block when the assignee belongs to
 * a specific department and the complaint's new department does not match.
 */
export function classificationConflictsWithAssignment(
  newComplaintDepartmentId: string | null,
  assigneeDepartmentId: string | null,
): boolean {
  if (!assigneeDepartmentId) {
    return false;
  }
  if (newComplaintDepartmentId == null) {
    return true;
  }
  return newComplaintDepartmentId !== assigneeDepartmentId;
}
