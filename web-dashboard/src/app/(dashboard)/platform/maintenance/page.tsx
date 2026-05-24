'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wrench, AlertTriangle, Loader2, ShieldCheck, MailCheck } from 'lucide-react';
import { ApiError, authApi, platformApi } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useTranslate } from '@/lib/i18n';

export default function MaintenancePage() {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'maintenance'],
    queryFn: () => platformApi.getMaintenance(),
  });

  const { data: twoFaData, isLoading: twoFaLoading } = useQuery({
    queryKey: ['platform', 'require-2fa'],
    queryFn: () => platformApi.getRequire2fa(),
  });

  const { data: emailVerData, isLoading: emailVerLoading } = useQuery({
    queryKey: ['platform', 'require-email-verification'],
    queryFn: () => platformApi.getRequireEmailVerification(),
  });

  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [require2fa, setRequire2fa] = useState(false);
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);

  useEffect(() => {
    if (data) {
      setEnabled(data.enabled);
      setMessage(data.message ?? '');
    }
  }, [data]);

  useEffect(() => {
    if (twoFaData) setRequire2fa(twoFaData.enabled);
  }, [twoFaData]);

  useEffect(() => {
    if (emailVerData) setRequireEmailVerification(emailVerData.enabled);
  }, [emailVerData]);

  const mutation = useMutation({
    mutationFn: () =>
      platformApi.setMaintenance({ enabled, message: message || undefined }),
    onSuccess: (res) => {
      toast.success(
        res.enabled ? t('platform.toast.maintenanceOn') : t('platform.toast.maintenanceOff'),
      );
      queryClient.invalidateQueries({ queryKey: ['platform', 'maintenance'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const setUser = useAuthStore((s) => s.setUser);
  const require2faMutation = useMutation({
    mutationFn: (next: boolean) => platformApi.setRequire2fa(next),
    onSuccess: async () => {
      toast.success(t('common.save'));
      queryClient.invalidateQueries({ queryKey: ['platform', 'require-2fa'] });
      try {
        const fresh = await authApi.getProfile();
        setUser(fresh);
      } catch {
        // best-effort
      }
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const requireEmailVerificationMutation = useMutation({
    mutationFn: (next: boolean) => platformApi.setRequireEmailVerification(next),
    onSuccess: () => {
      toast.success(t('common.save'));
      queryClient.invalidateQueries({
        queryKey: ['platform', 'require-email-verification'],
      });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Wrench className="h-5 w-5" /> {t('platform.maintenance.title')}
        </h1>
      </div>

      {data?.enabled && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">{t('platform.maintenance.active')}</p>
          </div>
        </div>
      )}

      <div className="gov-card space-y-3 p-4">
        <div className="gov-section-header">{t('platform.maintenance.section.toggle')}</div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-gray-900">
            {enabled ? t('platform.maintenance.disable') : t('platform.maintenance.enable')}
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t('platform.maintenance.message')}
          </label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('platform.maintenance.message.placeholder')}
            className="input-gov mt-1"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="btn-gov-primary"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save')}
          </button>
        </div>
      </div>

      <div className="gov-card p-4">
        <div className="gov-section-header">
          <ShieldCheck className="h-4 w-4" /> {t('platform.maintenance.section.twoFactor')}
        </div>
        <div className="mt-3">
          {twoFaLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={require2fa}
                onChange={(e) => {
                  const next = e.target.checked;
                  setRequire2fa(next);
                  require2faMutation.mutate(next);
                }}
                disabled={require2faMutation.isPending}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm">
                <span className="block font-medium text-gray-900">
                  {t('profile.section.security')}
                </span>
              </span>
            </label>
          )}
        </div>
      </div>

      <div className="gov-card p-4">
        <div className="gov-section-header">
          <MailCheck className="h-4 w-4" />{' '}
          {t('platform.maintenance.section.emailVerification')}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {t('platform.maintenance.emailVerification.description')}
        </p>
        <div className="mt-3">
          {emailVerLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          ) : (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={requireEmailVerification}
                onChange={(e) => {
                  const next = e.target.checked;
                  setRequireEmailVerification(next);
                  requireEmailVerificationMutation.mutate(next);
                }}
                disabled={requireEmailVerificationMutation.isPending}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm">
                <span className="block font-medium text-gray-900">
                  {t('platform.maintenance.emailVerification.label')}
                </span>
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
