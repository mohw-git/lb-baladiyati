import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

/**
 * Domain-facing API for emitting realtime events. Services inject this and
 * call methods like `complaintUpdated(...)` instead of poking the gateway
 * directly. Keeps the event surface small and discoverable.
 *
 * Event envelope: { type: string, payload: any }. Clients listen for
 * `entity:event` (e.g. `complaint:updated`) and treat the payload as a hint
 * (usually `{ id }`) to invalidate the matching React Query keys.
 */
export type RealtimeEventType =
  | 'complaint:created'
  | 'complaint:updated'
  | 'complaint:deleted'
  | 'task:created'
  | 'task:updated'
  | 'transfer:created'
  | 'transfer:updated'
  | 'help-request:created'
  | 'help-request:updated'
  | 'kyc:updated'
  | 'user:updated'
  | 'notification:new';

interface BaseTarget {
  /** Event will be visible to the entire municipality (default for staff broadcasts). */
  municipalityId?: string | null;
  /** Restrict to a single department (e.g. complaint scoped to dept). */
  departmentId?: string | null;
  /** Direct-to-user delivery (e.g. "your task was reassigned"). */
  userIds?: string[];
  /** Always include super admins (defaults to true so platform metrics stay live). */
  notifySuperAdmins?: boolean;
}

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  /** Emit a typed event to the right rooms based on the target. */
  emit(type: RealtimeEventType, payload: any, target: BaseTarget = {}): void {
    const { server } = this.gateway;
    if (!server) return; // gateway not yet initialised (e.g. unit tests)

    const rooms = new Set<string>();
    if (target.municipalityId) rooms.add(`muni:${target.municipalityId}`);
    if (target.departmentId) rooms.add(`dept:${target.departmentId}`);
    for (const uid of target.userIds ?? []) rooms.add(`user:${uid}`);
    if (target.notifySuperAdmins !== false) rooms.add('super-admin');

    if (rooms.size === 0) return;

    const envelope = { type, payload, ts: Date.now() };
    server.to(Array.from(rooms)).emit(type, envelope);
  }

  // ── Convenience helpers used by the domain modules ─────────────────────────

  complaintCreated(c: { id: string; municipalityId: string; departmentId?: string | null; createdById?: string | null }) {
    this.emit('complaint:created', { id: c.id }, {
      municipalityId: c.municipalityId,
      departmentId: c.departmentId,
      userIds: c.createdById ? [c.createdById] : [],
    });
  }

  complaintUpdated(c: {
    id: string;
    municipalityId: string;
    departmentId?: string | null;
    createdById?: string | null;
    assignedUserIds?: string[];
  }) {
    this.emit('complaint:updated', { id: c.id }, {
      municipalityId: c.municipalityId,
      departmentId: c.departmentId,
      userIds: [
        ...(c.createdById ? [c.createdById] : []),
        ...(c.assignedUserIds ?? []),
      ],
    });
  }

  complaintDeleted(c: {
    id: string;
    municipalityId: string;
    departmentId?: string | null;
    createdById?: string | null;
    assignedUserIds?: string[];
  }) {
    this.emit('complaint:deleted', { id: c.id }, {
      municipalityId: c.municipalityId,
      departmentId: c.departmentId,
      userIds: [
        ...(c.createdById ? [c.createdById] : []),
        ...(c.assignedUserIds ?? []),
      ],
    });
  }

  taskUpdated(t: {
    id: string;
    municipalityId: string;
    departmentId?: string | null;
    assigneeId?: string | null;
  }) {
    this.emit('task:updated', { id: t.id }, {
      municipalityId: t.municipalityId,
      departmentId: t.departmentId,
      userIds: t.assigneeId ? [t.assigneeId] : [],
    });
  }

  transferUpdated(tr: {
    id: string;
    municipalityId: string;
    fromDepartmentId?: string | null;
    toDepartmentId?: string | null;
  }) {
    this.emit('transfer:updated', { id: tr.id }, {
      municipalityId: tr.municipalityId,
      // emit to both departments so HODs of either side react
      departmentId: tr.fromDepartmentId ?? tr.toDepartmentId ?? null,
    });
  }

  /**
   * Help requests touch two departments + interested staff (requester,
   * helper assignee, original HOD, helper HOD). We fire one muni-wide event
   * with the two department rooms attached so both sides invalidate their
   * lists. Direct user IDs are included for personal panels.
   */
  helpRequestEvent(
    type: 'help-request:created' | 'help-request:updated',
    hr: {
      id: string;
      complaintId: string;
      municipalityId: string;
      fromDepartmentId?: string | null;
      toDepartmentId?: string | null;
      userIds?: string[];
    },
  ) {
    const { server } = this.gateway;
    if (!server) return;

    const rooms = new Set<string>();
    rooms.add(`muni:${hr.municipalityId}`);
    if (hr.fromDepartmentId) rooms.add(`dept:${hr.fromDepartmentId}`);
    if (hr.toDepartmentId)   rooms.add(`dept:${hr.toDepartmentId}`);
    for (const uid of hr.userIds ?? []) rooms.add(`user:${uid}`);
    rooms.add('super-admin');

    const envelope = {
      type,
      payload: { id: hr.id, complaintId: hr.complaintId },
      ts: Date.now(),
    };
    server.to(Array.from(rooms)).emit(type, envelope);
  }

  kycUpdated(k: {
    userId: string;
    municipalityId?: string | null;
    status: string;
  }) {
    this.emit(
      'kyc:updated',
      { userId: k.userId, status: k.status },
      {
        municipalityId: k.municipalityId,
        userIds: [k.userId],
      },
    );
  }

  userUpdated(u: { id: string; municipalityId?: string | null }) {
    this.emit('user:updated', { id: u.id }, {
      municipalityId: u.municipalityId,
      userIds: [u.id],
    });
  }

  notificationNew(payload: { id: string; userId: string }) {
    this.emit('notification:new', { id: payload.id }, {
      userIds: [payload.userId],
    });
  }
}
