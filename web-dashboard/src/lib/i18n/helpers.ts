/**
 * Centralized translation helpers that map system-controlled values
 * (permission keys, system role names, enum values) to message keys
 * in the i18n catalog.
 *
 * These helpers ensure that ANY UI surface displaying a permission /
 * role / status / priority renders consistently translated text in EN/AR/FR.
 *
 * The keys here intentionally mirror the canonical English forms in
 * `permissions.constants.ts` and the Prisma enums.
 */

import type { MessageKey } from './messages';

// ─── Permissions ──────────────────────────────────────────────────────────
//
// Every permission key from the backend `PERMISSION_SEED_DATA` maps to:
//   - `permissions.<key>` for the short label
//   - optionally `permissions.<key>.desc` for a longer description
//
// If a key is missing in the catalog, fall back to the human-readable name
// (server-supplied) and finally to the key.

export function permissionLabelKey(permissionKey: string): MessageKey {
  // Convert "complaint.create" -> "permissions.complaint.create"
  return `permissions.${permissionKey}` as MessageKey;
}

export function permissionDescKey(permissionKey: string): MessageKey {
  return `permissions.${permissionKey}.desc` as MessageKey;
}

// ─── System Roles ─────────────────────────────────────────────────────────
//
// Roles flagged as `isSystem: true` in DB have stable English names. We
// translate by mapping the canonical name to a `roles.system.*` key.

const SYSTEM_ROLE_KEY_MAP: Record<string, string> = {
  Citizen: 'roles.system.citizen',
  'Field Worker': 'roles.system.fieldWorker',
  Supervisor: 'roles.system.supervisor',
  'Head of Department': 'roles.system.hod',
  Verifier: 'roles.system.verifier',
  Assigner: 'roles.system.assigner',
  Admin: 'roles.system.admin',
};

const SYSTEM_ROLE_DESC_MAP: Record<string, string> = {
  Citizen: 'roles.system.citizen.desc',
  'Field Worker': 'roles.system.fieldWorker.desc',
  Supervisor: 'roles.system.supervisor.desc',
  'Head of Department': 'roles.system.hod.desc',
  Verifier: 'roles.system.verifier.desc',
  Assigner: 'roles.system.assigner.desc',
  Admin: 'roles.system.admin.desc',
};

export function systemRoleLabelKey(roleName: string | null | undefined): MessageKey | null {
  if (!roleName) return null;
  const k = SYSTEM_ROLE_KEY_MAP[roleName];
  return (k as MessageKey) || null;
}

export function systemRoleDescKey(roleName: string | null | undefined): MessageKey | null {
  if (!roleName) return null;
  const k = SYSTEM_ROLE_DESC_MAP[roleName];
  return (k as MessageKey) || null;
}

// ─── Enums ────────────────────────────────────────────────────────────────

export function complaintStatusKey(status: string): MessageKey {
  return `status.${status}` as MessageKey;
}

export function complaintPriorityKey(priority: string): MessageKey {
  return `priority.${priority}` as MessageKey;
}

export function taskStatusKey(status: string): MessageKey {
  return `tasks.status.${status}` as MessageKey;
}

export function transferStatusKey(status: string): MessageKey {
  return `transfers.status.${status}` as MessageKey;
}

export function helpRequestStatusKey(status: string): MessageKey {
  return `helpRequests.status.${status}` as MessageKey;
}

export function kycStatusKey(status: string): MessageKey {
  return `kyc.status.${status}` as MessageKey;
}

export function notificationTypeKey(type: string): MessageKey {
  return `notifications.type.${type}` as MessageKey;
}

export function rejectionReasonKey(reason: string): MessageKey {
  return `rejection.${reason}` as MessageKey;
}

// ─── Audit Action Categories ──────────────────────────────────────────────

export function auditActionCategoryKey(category: string): MessageKey {
  return `audit.action.${category}` as MessageKey;
}

// ─── Audit Action Labels (per-action localized text) ──────────────────────
//
// Every backend audit action string (e.g. "auth.email.verification_requested")
// has a corresponding `audit.action.label.<action>` key in the i18n catalog.
// The audit log UI uses this helper to render a localized, human-readable
// description while still surfacing the raw key in a `<code>` for forensics.
export function auditActionLabelKey(action: string): MessageKey {
  return `audit.action.label.${action}` as MessageKey;
}
