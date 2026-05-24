'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, MailWarning, RefreshCw } from 'lucide-react';
import { ApiError, authApi } from '@/lib/api';
import { useCooldown } from '@/lib/hooks/use-cooldown';
import { useTranslate } from '@/lib/i18n';

interface UnverifiedEmailBannerProps {
  /** Email to resend the verification link to (always rendered visible to the user). */
  email: string;
  /**
   * Visual variant:
   *  - `inline` (default) renders inside a card/page (e.g. login screen).
   *  - `page` adds extra horizontal padding for use as a full-width strip
   *    above dashboard content.
   */
  variant?: 'inline' | 'page';
  /**
   * Optional callback so callers can render a "wrong email?" link that
   * resets the parent form to the email-input step instead of the banner.
   */
  onChangeEmail?: () => void;
  /**
   * Optional dismiss handler. Used by the dashboard banner so the user
   * can hide the strip for the current page-load. Verification status is
   * still re-evaluated on every navigation.
   */
  onDismiss?: () => void;
}

/**
 * Government-style amber alert banner that tells the user their email
 * address is not verified and offers a rate-limited Resend button.
 *
 * Cooldown is 60s on success (matches the per-route backend throttle).
 * 429 responses surface a localized "try again later" toast and lock the
 * button for the same duration so the user can't spam the endpoint.
 */
export function UnverifiedEmailBanner({
  email,
  variant = 'inline',
  onChangeEmail,
  onDismiss,
}: UnverifiedEmailBannerProps) {
  const t = useTranslate();
  const cooldown = useCooldown(60);
  const [resending, setResending] = useState(false);

  const handleResend = useCallback(async () => {
    if (cooldown.isCoolingDown || resending || !email) return;
    setResending(true);
    try {
      await authApi.resendVerification(email);
      toast.success(t('auth.unverified.resendSent'));
      cooldown.start();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          // Honour the backend rate limit visually too — keep button
          // disabled for the same 60s rather than letting the user retry
          // immediately.
          cooldown.start();
          toast.error(t('auth.unverified.tooManyRequests'));
        } else {
          // Never surface raw error messages — we already vet known
          // codes; everything else gets a generic localized fallback.
          toast.error(t('auth.unverified.resendFailed'));
        }
      } else {
        toast.error(t('auth.unverified.resendFailed'));
      }
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending, t]);

  const padding = variant === 'page' ? 'p-4 sm:p-5' : 'p-3 sm:p-4';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded border border-amber-300 bg-amber-50 ${padding} sm:flex-row sm:items-start`}
    >
      <MailWarning
        className="h-5 w-5 flex-shrink-0 text-amber-700"
        aria-hidden="true"
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-amber-900">
          {t('auth.unverified.title')}
        </p>
        <p className="text-xs text-amber-800">
          {t('auth.unverified.body', { email })}
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown.isCoolingDown || !email}
          className="inline-flex items-center justify-center gap-1.5 rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {cooldown.isCoolingDown
            ? t('auth.unverified.resendIn', { seconds: cooldown.remaining })
            : resending
              ? t('auth.unverified.resending')
              : t('auth.unverified.resend')}
        </button>
        {onChangeEmail && (
          <button
            type="button"
            onClick={onChangeEmail}
            className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium text-amber-900 hover:underline"
          >
            {t('auth.unverified.changeEmail')}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded px-2 py-1 text-xs font-medium text-amber-900/70 hover:text-amber-900 hover:underline"
          >
            {t('common.dismiss')}
          </button>
        )}
      </div>
    </div>
  );
}
