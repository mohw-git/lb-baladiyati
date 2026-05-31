'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Loader2, Send } from 'lucide-react';
import { platformBroadcastsApi } from '@/lib/api/endpoints/platform-broadcasts';
import { platformApi } from '@/lib/api/endpoints/platform';
import type {
  PlatformBroadcastAudience,
  PlatformBroadcastChannel,
  PlatformBroadcastStatus,
} from '@shared/types/platform-broadcast';
import { PLATFORM_BROADCAST_ALL_USERS_CONFIRM_PHRASE } from '@shared/constants/platform-broadcast';
import { useTranslate, type MessageKey } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const AUDIENCES: PlatformBroadcastAudience[] = [
  'ALL_USERS',
  'CITIZENS',
  'STAFF',
  'MUNICIPALITIES',
  'ROLES',
  'USERS',
];

const CHANNELS: PlatformBroadcastChannel[] = ['IN_APP', 'PUSH', 'BOTH'];

function audienceLabelKey(audience: PlatformBroadcastAudience): MessageKey {
  const map: Record<PlatformBroadcastAudience, MessageKey> = {
    ALL_USERS: 'platform.broadcasts.audience.all_users',
    CITIZENS: 'platform.broadcasts.audience.citizens',
    STAFF: 'platform.broadcasts.audience.staff',
    MUNICIPALITIES: 'platform.broadcasts.audience.municipalities',
    ROLES: 'platform.broadcasts.audience.roles',
    USERS: 'platform.broadcasts.audience.users',
  };
  return map[audience];
}

function channelLabelKey(channel: PlatformBroadcastChannel): MessageKey {
  const map: Record<PlatformBroadcastChannel, MessageKey> = {
    IN_APP: 'platform.broadcasts.channels.in_app',
    PUSH: 'platform.broadcasts.channels.push',
    BOTH: 'platform.broadcasts.channels.both',
  };
  return map[channel];
}

function statusLabelKey(status: PlatformBroadcastStatus): MessageKey {
  const map: Record<PlatformBroadcastStatus, MessageKey> = {
    SCHEDULED: 'platform.broadcasts.status.scheduled',
    SENDING: 'platform.broadcasts.status.sending',
    SENT: 'platform.broadcasts.status.sent',
    FAILED: 'platform.broadcasts.status.failed',
  };
  return map[status];
}

function StatusBadge({ status }: { status: PlatformBroadcastStatus }) {
  const t = useTranslate();
  const styles: Record<PlatformBroadcastStatus, string> = {
    SCHEDULED: 'bg-blue-50 text-blue-800',
    SENDING: 'bg-amber-50 text-amber-900',
    SENT: 'bg-emerald-50 text-emerald-800',
    FAILED: 'bg-red-50 text-red-800',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[status]}`}>
      {t(statusLabelKey(status))}
    </span>
  );
}

export default function PlatformBroadcastsPage() {
  const t = useTranslate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('');
  const [audience, setAudience] = useState<PlatformBroadcastAudience>('CITIZENS');
  const [channels, setChannels] = useState<PlatformBroadcastChannel>('BOTH');
  const [sendMode, setSendMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [selectedMunicipalityIds, setSelectedMunicipalityIds] = useState<string[]>([]);
  const [roleIdsText, setRoleIdsText] = useState('');
  const [userIdsText, setUserIdsText] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const { data: municipalities } = useQuery({
    queryKey: ['platform-municipalities-list'],
    queryFn: () => platformApi.listMunicipalities(false),
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ['platform-broadcasts', page],
    queryFn: () => platformBroadcastsApi.list({ page, limit: 15 }),
  });

  const audienceConfig = useMemo(() => {
    if (audience === 'MUNICIPALITIES') {
      return { municipalityIds: selectedMunicipalityIds };
    }
    if (audience === 'ROLES') {
      return {
        roleIds: roleIdsText
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
    if (audience === 'USERS') {
      return {
        userIds: userIdsText
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
    return undefined;
  }, [audience, selectedMunicipalityIds, roleIdsText, userIdsText]);

  const previewMut = useMutation({
    mutationFn: () =>
      platformBroadcastsApi.preview({
        title,
        body,
        audience,
        audienceConfig,
        channels,
      }),
    onSuccess: (res) => {
      setPreviewCount(res.recipientCount);
      toast.success(t('platform.broadcasts.toast.preview', { count: res.recipientCount }));
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: () => {
      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `broadcast-${Date.now()}`;
      return platformBroadcastsApi.send({
        title,
        body,
        deepLink: deepLink.trim() || undefined,
        audience,
        audienceConfig,
        channels,
        scheduledAt: sendMode === 'later' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        idempotencyKey,
        confirmPhrase: audience === 'ALL_USERS' ? confirmPhrase : undefined,
      });
    },
    onSuccess: () => {
      toast.success(t('platform.broadcasts.toast.sent'));
      setTitle('');
      setBody('');
      setDeepLink('');
      setConfirmPhrase('');
      setPreviewCount(null);
      qc.invalidateQueries({ queryKey: ['platform-broadcasts'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const toggleMunicipality = (id: string) => {
    setSelectedMunicipalityIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Bell className="h-5 w-5" />
          {t('platform.broadcasts.title')}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('platform.broadcasts.subtitle')}</p>
      </div>

      <section className="gov-card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('platform.broadcasts.compose')}</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.title')}</span>
            <input
              className="input-gov mt-1 w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.deepLink')}</span>
            <input
              className="input-gov mt-1 w-full"
              placeholder="/platform/announcements"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-gray-700">{t('platform.broadcasts.field.body')}</span>
          <textarea
            className="input-gov mt-1 min-h-[100px] w-full"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={4000}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.audience')}</span>
            <select
              className="input-gov mt-1 w-full"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as PlatformBroadcastAudience);
                setPreviewCount(null);
              }}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {t(audienceLabelKey(a))}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.channels')}</span>
            <select
              className="input-gov mt-1 w-full"
              value={channels}
              onChange={(e) => setChannels(e.target.value as PlatformBroadcastChannel)}
            >
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {t(channelLabelKey(c))}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.timing')}</span>
            <select
              className="input-gov mt-1 w-full"
              value={sendMode}
              onChange={(e) => setSendMode(e.target.value as 'now' | 'later')}
            >
              <option value="now">{t('platform.broadcasts.timing.now')}</option>
              <option value="later">{t('platform.broadcasts.timing.later')}</option>
            </select>
          </label>
        </div>

        {sendMode === 'later' && (
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.scheduledAt')}</span>
            <input
              type="datetime-local"
              className="input-gov mt-1 w-full max-w-xs"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
        )}

        {audience === 'MUNICIPALITIES' && (
          <div className="text-sm">
            <p className="font-medium text-gray-700">{t('platform.broadcasts.field.municipalities')}</p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded border border-gray-200 p-2">
              {(municipalities ?? []).map((m) => (
                <label key={m.id} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedMunicipalityIds.includes(m.id)}
                    onChange={() => toggleMunicipality(m.id)}
                  />
                  <span>{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {audience === 'ROLES' && (
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.roleIds')}</span>
            <textarea
              className="input-gov mt-1 w-full font-mono text-xs"
              placeholder="uuid-1, uuid-2"
              value={roleIdsText}
              onChange={(e) => setRoleIdsText(e.target.value)}
            />
          </label>
        )}

        {audience === 'USERS' && (
          <label className="block text-sm">
            <span className="font-medium text-gray-700">{t('platform.broadcasts.field.userIds')}</span>
            <textarea
              className="input-gov mt-1 w-full font-mono text-xs"
              placeholder="uuid-1, uuid-2"
              value={userIdsText}
              onChange={(e) => setUserIdsText(e.target.value)}
            />
          </label>
        )}

        {audience === 'ALL_USERS' && (
          <label className="block text-sm">
            <span className="font-medium text-red-700">{t('platform.broadcasts.field.confirmPhrase')}</span>
            <p className="text-xs text-gray-500">
              {t('platform.broadcasts.confirmHint', { phrase: PLATFORM_BROADCAST_ALL_USERS_CONFIRM_PHRASE })}
            </p>
            <input
              className="input-gov mt-1 w-full max-w-md font-mono"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
            />
          </label>
        )}

        {previewCount !== null && (
          <p className="text-sm font-medium text-gray-800">
            {t('platform.broadcasts.previewCount', { count: previewCount })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-gov-secondary"
            disabled={!title.trim() || !body.trim() || previewMut.isPending}
            onClick={() => previewMut.mutate()}
          >
            {previewMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('platform.broadcasts.preview')}
          </button>
          <button
            type="button"
            className="btn-gov-primary"
            disabled={!title.trim() || !body.trim() || sendMut.isPending}
            onClick={() => sendMut.mutate()}
          >
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sendMode === 'later' ? t('platform.broadcasts.schedule') : t('platform.broadcasts.send')}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">{t('platform.broadcasts.history')}</h2>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.title')}</th>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.audience')}</th>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.channels')}</th>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.recipients')}</th>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.status')}</th>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.sentAt')}</th>
                  <th className="px-3 py-2">{t('platform.broadcasts.col.sender')}</th>
                </tr>
              </thead>
              <tbody>
                {(history?.items ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{row.title}</td>
                    <td className="px-3 py-2">{t(audienceLabelKey(row.audience))}</td>
                    <td className="px-3 py-2">{t(channelLabelKey(row.channels))}</td>
                    <td className="px-3 py-2">{row.recipientCount ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {row.sentAt ? formatDate(row.sentAt) : row.scheduledAt ? formatDate(row.scheduledAt) : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {row.createdBy
                        ? `${row.createdBy.firstName} ${row.createdBy.lastName}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!history?.items?.length && (
              <p className="p-4 text-sm text-gray-500">{t('platform.broadcasts.empty')}</p>
            )}
          </div>
        )}
        {history?.meta && history.meta.totalPages > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-gov-secondary text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              className="btn-gov-secondary text-xs"
              disabled={page >= history.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
