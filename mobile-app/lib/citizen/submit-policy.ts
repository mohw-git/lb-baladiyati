import { PERMISSIONS } from '@shared/constants/permissions';

export type SubmitPolicyUser = {
  permissions?: string[];
  verificationStatus?: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  emailVerified?: boolean;
  allowUnverifiedCitizenComplaints?: boolean;
};

/**
 * Mirrors web `complaints/new` verification gating for citizens.
 * Staff creators (view_all / view_department / view_assigned) bypass KYC/email checks.
 */
export function getCitizenSubmitPolicy(user: SubmitPolicyUser | null | undefined) {
  const perms = user?.permissions ?? [];
  const isStaffCreator =
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);

  const allowUnverified = user?.allowUnverifiedCitizenComplaints === true;
  const emailUnverified = user?.emailVerified === false;
  const kycUnverified =
    !!user?.verificationStatus && user.verificationStatus !== 'VERIFIED';

  const isUnverifiedCitizen =
    !isStaffCreator && (emailUnverified || kycUnverified);
  const blockedByVerification = isUnverifiedCitizen && !allowUnverified;

  return {
    isStaffCreator,
    allowUnverified,
    emailUnverified,
    kycUnverified,
    isUnverifiedCitizen,
    blockedByVerification,
    canSubmit: isStaffCreator || !blockedByVerification,
    showUnverifiedWarning: isUnverifiedCitizen && allowUnverified,
  };
}
