import { isCitizenOnlyViewer } from './complaints-access.util';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';

describe('isCitizenOnlyViewer', () => {
  it('returns true for citizen-only permissions', () => {
    expect(
      isCitizenOnlyViewer([
        PERMISSIONS.COMPLAINT_VIEW_OWN,
        PERMISSIONS.COMPLAINT_CREATE,
      ]),
    ).toBe(true);
  });

  it('returns false for staff viewers', () => {
    expect(
      isCitizenOnlyViewer([
        PERMISSIONS.COMPLAINT_VIEW_OWN,
        PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
      ]),
    ).toBe(false);
  });
});
