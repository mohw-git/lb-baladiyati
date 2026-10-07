import { PERMISSIONS } from '../../core/rbac/permissions.constants';

/** Citizens with only VIEW_OWN — not staff complaint viewers. */
export function isCitizenOnlyViewer(permissions: string[]): boolean {
  return (
    permissions.includes(PERMISSIONS.COMPLAINT_VIEW_OWN) &&
    !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) &&
    !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
    !permissions.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED)
  );
}
