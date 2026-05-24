'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Loader2, Crown, AlertTriangle, Building2, Users as UsersIcon, Inbox } from 'lucide-react';
import {
  departmentsApi,
  municipalitiesApi,
  transfersApi,
  usersApi,
} from '@/lib/api';
import { useAuth } from '@/lib/auth/hooks';
import { useTranslate, useLocale, pickName, systemRoleLabelKey, type MessageKey } from '@/lib/i18n';

const NODE_COLORS = {
  muniWithAdmin: '#0ea5e9', // blue
  muniVacant: '#f59e0b',    // amber
  deptWithHead: '#10b981',  // green
  deptVacant: '#ef4444',    // red
  staffCount: '#6b7280',    // gray
};

export default function OrgChartPage() {
  const { user } = useAuth();

  const { data: muniData } = useQuery({
    queryKey: ['org-chart', 'municipality', user?.municipalityId],
    queryFn: () => municipalitiesApi.getCurrent(),
    enabled: !!user?.municipalityId,
  });

  const { data: deptData, isLoading: deptsLoading } = useQuery({
    queryKey: ['org-chart', 'departments'],
    queryFn: () => departmentsApi.list(),
  });
  const departments: any[] = Array.isArray(deptData)
    ? deptData
    : (deptData as any)?.data ?? [];

  const { data: usersData } = useQuery({
    queryKey: ['org-chart', 'users'],
    queryFn: () => usersApi.list({ excludeCitizens: true, limit: 500 }),
  });
  const allUsers: any[] = usersData?.items ?? [];

  // Discord-style hierarchy filter: each user can see themselves and everyone
  // strictly below their effective rank. Super Admin / Admin sees everyone.
  // ── Rank fallback: AuthGuard refreshes /profile on mount, but the persisted
  // store may not yet have `effectiveRank` (e.g. user logged in before this
  // feature shipped). Fall back to the role-name list so Admin/HOD/etc. don't
  // get treated as rank=0 and lock themselves out of their own org chart.
  const myRank: number = useMemo(() => {
    if (!user) return 0;
    if (user.isSuperAdmin) return Number.MAX_SAFE_INTEGER;
    if (typeof (user as any).effectiveRank === 'number') {
      return (user as any).effectiveRank;
    }
    const ROLE_FALLBACK: Record<string, number> = {
      Admin: 100,
      'Head of Department': 80,
      Supervisor: 60,
      Verifier: 50,
      Assigner: 50,
      'Field Worker': 30,
      Citizen: 0,
    };
    const ranks = (user.roles ?? []).map((r) => ROLE_FALLBACK[r] ?? 0);
    return ranks.length ? Math.max(...ranks) : 0;
  }, [user]);

  const visibleUsers = useMemo(() => {
    if (!user) return allUsers;
    return allUsers.filter((u: any) => {
      if (u.id === user.id) return true; // always show self
      const theirRank = u.effectiveRank ?? 0;
      return theirRank < myRank;
    });
  }, [allUsers, user, myRank]);

  // Pending transfer counts per department (for the badge)
  const { data: transferData } = useQuery({
    queryKey: ['org-chart', 'transfers'],
    queryFn: () => transfersApi.list({ status: 'PENDING', limit: 200 }),
  });
  const pendingByDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transferData?.items ?? []) {
      map.set(t.toDepartmentId, (map.get(t.toDepartmentId) ?? 0) + 1);
    }
    return map;
  }, [transferData]);

  // Admin / Super-Admin see every department even if currently empty. Lower
  // ranks see only departments that contain a visible user (so Field Workers
  // don't see vacant departments they can't reach).
  const visibleDepartments = useMemo(() => {
    if (!user) return departments;
    const seesAll = user.isSuperAdmin || myRank >= 100;
    if (seesAll) return departments;
    const visibleUserIds = new Set(visibleUsers.map((u: any) => u.id));
    return departments.filter((d: any) => {
      if (d.headUserId && visibleUserIds.has(d.headUserId)) return true;
      return visibleUsers.some((u: any) => u.department?.id === d.id);
    });
  }, [departments, visibleUsers, user, myRank]);

  const t = useTranslate();
  const locale = useLocale();

  const { nodes, edges } = useMemo(
    () => buildLayout(muniData, visibleDepartments, visibleUsers, pendingByDept, t, locale),
    [muniData, visibleDepartments, visibleUsers, pendingByDept, t, locale],
  );

  if (deptsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('orgChart.title')}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('orgChart.subtitle')}</p>
        {user && !user.isSuperAdmin && myRank < 100 && (
          <p className="mt-2 text-xs text-gray-400">
            {t('orgChart.rankNote')}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <Legend color={NODE_COLORS.muniWithAdmin} label={t('orgChart.legend.muniWithAdmin')} icon={<Crown className="h-3.5 w-3.5" />} />
        <Legend color={NODE_COLORS.deptWithHead} label={t('orgChart.legend.deptWithHead')} icon={<Building2 className="h-3.5 w-3.5" />} />
        <Legend color={NODE_COLORS.deptVacant} label={t('orgChart.legend.deptVacant')} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <Legend color={NODE_COLORS.staffCount} label={t('orgChart.legend.staff')} icon={<UsersIcon className="h-3.5 w-3.5" />} />
      </div>

      <div
        className="gov-card"
        style={{ height: '70vh' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  icon,
}: {
  color: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 ring-1 ring-gray-200">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full"
        style={{ background: color, color: '#fff' }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

function buildLayout(
  muni: any,
  departments: any[],
  users: any[],
  pendingByDept: Map<string, number>,
  t: (k: MessageKey) => string,
  locale: any,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const muniHasAdmin = !!muni?.adminUserId;
  const NODE_W = 240;

  // Top-level: municipality
  nodes.push({
    id: 'muni',
    position: { x: 0, y: 0 },
    data: {
      label: (
        <div className="flex flex-col items-center gap-1 text-center text-white">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider opacity-90">
            <Crown className="h-3 w-3" /> {t('orgChart.muniLabel')}
          </div>
          <div className="text-sm font-bold">{pickName(muni as any, locale) || '—'}</div>
          {muniHasAdmin ? (
            <div className="text-xs opacity-95">
              {t('roles.system.admin')}: {muni?.admin?.firstName} {muni?.admin?.lastName}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs">
              <AlertTriangle className="h-3 w-3" /> {t('orgChart.noAdmin')}
            </div>
          )}
        </div>
      ),
    },
    style: {
      background: muniHasAdmin
        ? NODE_COLORS.muniWithAdmin
        : NODE_COLORS.muniVacant,
      color: '#fff',
      border: '2px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 12,
      width: NODE_W,
    },
    sourcePosition: 'bottom' as any,
  });

  // Layout: spread departments horizontally below the muni
  const totalWidth = Math.max(departments.length, 1) * (NODE_W + 40);
  const startX = -totalWidth / 2 + (NODE_W + 40) / 2;

  departments.forEach((d, i) => {
    const x = startX + i * (NODE_W + 40);
    const y = 220;
    const hasHead = !!d.headUserId;
    const pending = pendingByDept.get(d.id) ?? 0;

    nodes.push({
      id: `dept-${d.id}`,
      position: { x, y },
      data: {
        label: (
          <div className="flex flex-col items-start gap-1 text-left text-white">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider opacity-90">
                <Building2 className="h-3 w-3" /> {t('common.department')}
              </div>
              {pending > 0 && (
                <span className="inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-gray-900">
                  <Inbox className="h-2.5 w-2.5" /> {pending}
                </span>
              )}
            </div>
            <div className="text-sm font-bold">{pickName(d as any, locale)}</div>
            {hasHead ? (
              <div className="text-xs opacity-95">
                {t('departments.hod.label')}: {d.head?.firstName} {d.head?.lastName}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" /> {t('orgChart.vacant')}
              </div>
            )}
            <div className="mt-0.5 text-[11px] opacity-80">
              {t('orgChart.staffCount').replace('{n}', String(d._count?.users ?? 0))}
            </div>
          </div>
        ),
      },
      style: {
        background: hasHead ? NODE_COLORS.deptWithHead : NODE_COLORS.deptVacant,
        color: '#fff',
        border: '2px solid rgba(255,255,255,0.2)',
        borderRadius: 10,
        padding: 10,
        width: NODE_W,
      },
      targetPosition: 'top' as any,
      sourcePosition: 'bottom' as any,
    });

    edges.push({
      id: `e-muni-${d.id}`,
      source: 'muni',
      target: `dept-${d.id}`,
      type: 'smoothstep',
      animated: !hasHead, // animate edge when slot is vacant — visual nudge
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: hasHead ? '#94a3b8' : '#ef4444' },
    });

    // Third tier: members of this department, sorted by their effective rank
    // (highest first) and broken into role groups so the layout matches the
    // chain of authority. The municipality admin and the department head are
    // excluded — they already have their own slots above.
    const deptMembers = users
      .filter(
        (u: any) =>
          u.department?.id === d.id &&
          u.id !== d.headUserId &&
          u.id !== muni?.adminUserId,
      )
      .slice()
      .sort(
        (a: any, b: any) => (b.effectiveRank ?? 0) - (a.effectiveRank ?? 0),
      );

    if (deptMembers.length > 0) {
      const groups = groupByTopRole(deptMembers);
      let groupY = y + 200;
      groups.forEach((group, gi) => {
        const memberNodeId = `dept-${d.id}-grp-${gi}`;
        const SHOW = 6;
        const visible = group.members.slice(0, SHOW);
        const overflow = group.members.length - visible.length;
        nodes.push({
          id: memberNodeId,
          position: { x, y: groupY },
          data: {
            label: (
              <div className="flex flex-col items-center gap-1 text-center text-white">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider opacity-90">
                  <UsersIcon className="h-3 w-3" /> {group.label}
                </div>
                <div className="text-lg font-bold leading-none">
                  {group.members.length}
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] leading-tight opacity-95">
                  {visible.map((u: any) => (
                    <li key={u.id} className="truncate">
                      {u.firstName} {u.lastName}
                    </li>
                  ))}
                  {overflow > 0 && <li className="opacity-75">+{overflow} more…</li>}
                </ul>
              </div>
            ),
          },
          style: {
            background: rankColor(group.priority),
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: 8,
            width: NODE_W,
            minHeight: 90,
          },
          targetPosition: 'top' as any,
          sourcePosition: 'bottom' as any,
        });
        // Edge: top group hangs off the dept; lower groups hang off the previous
        // group, so the visual ordering reflects the role rank.
        const parent = gi === 0 ? `dept-${d.id}` : `dept-${d.id}-grp-${gi - 1}`;
        edges.push({
          id: `e-${d.id}-grp-${gi}`,
          source: parent,
          target: memberNodeId,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#cbd5e1' },
        });
        groupY += 160;
      });
    }
  });

  // ── Direct-to-municipality staff cluster ──
  // Users whose primary role isn't tied to any department (e.g. Verifier,
  // Assigner) are linked directly to the municipality node, grouped by role.
  const directStaff = users.filter(
    (u: any) =>
      !u.department?.id &&
      u.id !== muni?.adminUserId &&
      // skip pure-citizen accounts (already excluded by API but defend in depth)
      !(u.roles?.length === 1 && u.roles[0]?.name === 'Citizen'),
  );
  if (directStaff.length > 0) {
    const directGroups = groupByTopRole(directStaff);
    // Place direct staff to the LEFT of the department row so they're clearly
    // a sibling of the departments, both reporting to the muni node.
    const directX = startX - (NODE_W + 80);
    let directY = 220;
    directGroups.forEach((group, gi) => {
      const id = `direct-${gi}`;
      const SHOW = 6;
      const visible = group.members.slice(0, SHOW);
      const overflow = group.members.length - visible.length;
      nodes.push({
        id,
        position: { x: directX, y: directY },
        data: {
          label: (
            <div className="flex flex-col items-center gap-1 text-center text-white">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider opacity-90">
                <UsersIcon className="h-3 w-3" /> {group.label}
              </div>
              <div className="text-[10px] opacity-80">Reports to municipality</div>
              <div className="text-lg font-bold leading-none">
                {group.members.length}
              </div>
              <ul className="mt-1 space-y-0.5 text-[11px] leading-tight opacity-95">
                {visible.map((u: any) => (
                  <li key={u.id} className="truncate">
                    {u.firstName} {u.lastName}
                  </li>
                ))}
                {overflow > 0 && <li className="opacity-75">+{overflow} more…</li>}
              </ul>
            </div>
          ),
        },
        style: {
          background: rankColor(group.priority),
          color: '#fff',
          border: '2px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          padding: 8,
          width: NODE_W,
          minHeight: 90,
        },
        targetPosition: 'top' as any,
      });
      edges.push({
        id: `e-direct-${gi}`,
        source: 'muni',
        target: id,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: '#94a3b8' },
      });
      directY += 160;
    });
  }

  return { nodes, edges };
}

// Group users by their highest-rank role name (so Supervisors stack above
// Field Workers, Verifiers stack above Assigners, etc.). Sorted by priority
// descending so the topmost group is the strongest.
function groupByTopRole(
  members: any[],
): Array<{ label: string; priority: number; members: any[] }> {
  const groups = new Map<string, { label: string; priority: number; members: any[] }>();
  for (const u of members) {
    // Pick the user's highest-priority role to bucket them under.
    const roles = (u.roles ?? []) as Array<{ name: string; priority?: number }>;
    let topRole = roles[0];
    for (const r of roles) {
      if ((r.priority ?? 0) > (topRole?.priority ?? 0)) topRole = r;
    }
    const label = topRole?.name ?? 'Staff';
    const priority = topRole?.priority ?? 0;
    const bucket = groups.get(label) ?? { label, priority, members: [] };
    bucket.members.push(u);
    groups.set(label, bucket);
  }
  return Array.from(groups.values()).sort((a, b) => b.priority - a.priority);
}

function rankColor(priority: number): string {
  if (priority >= 80) return '#0f766e'; // teal-700 — leadership
  if (priority >= 60) return '#0d9488'; // teal-600 — supervisor
  if (priority >= 40) return '#1d4ed8'; // blue-700 — verifier-ish
  if (priority > 0) return '#475569';   // slate-600 — workers
  return NODE_COLORS.staffCount;
}
