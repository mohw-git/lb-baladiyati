'use client';

import { useState, useEffect } from 'react';
import { getFileUrl } from '@/lib/api/client';
import { getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AvatarProps {
  /** Avatar URL — relative `/uploads/...` or absolute https URL. */
  src?: string | null;
  /** First name used to render initials when no image is set. */
  firstName?: string | null;
  /** Last name used to render initials when no image is set. */
  lastName?: string | null;
  /** Size token in px; defaults to 28. */
  size?: number;
  /** Optional cache-busting key — bump after upload to force re-render. */
  cacheKey?: string | number;
  /** Override classes for outer wrapper. */
  className?: string;
  /** When true, renders a square (e.g. building/logo) avatar instead of circle. */
  square?: boolean;
}

/**
 * Single source of truth for user / entity avatars across the dashboard.
 * Renders the uploaded image when available; falls back to initials.
 *
 * Cache-busting: the `cacheKey` is appended as a query param so that
 * re-uploads (which keep the URL but change the file) bypass the browser
 * cache. By default we use the URL itself, which is sufficient because the
 * backend writes a fresh UUID filename on each upload.
 */
export function Avatar({
  src,
  firstName,
  lastName,
  size = 28,
  cacheKey,
  className,
  square,
}: AvatarProps) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [src, cacheKey]);

  const initials = getInitials(firstName ?? '', lastName ?? '');
  const resolvedSrc = src && !errored ? getFileUrl(src) : null;
  const finalSrc =
    resolvedSrc && cacheKey != null
      ? `${resolvedSrc}${resolvedSrc.includes('?') ? '&' : '?'}v=${cacheKey}`
      : resolvedSrc;

  const wrapperShape = square ? 'rounded' : 'rounded-full';
  const dimension = { width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.4)) };

  if (finalSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={finalSrc}
        alt={`${firstName ?? ''} ${lastName ?? ''}`.trim() || 'avatar'}
        onError={() => setErrored(true)}
        className={cn('shrink-0 object-cover', wrapperShape, className)}
        style={dimension}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-brand-700 font-bold text-white',
        wrapperShape,
        className,
      )}
      style={dimension}
      aria-label={initials}
    >
      <span style={{ fontSize: dimension.fontSize }}>{initials || '?'}</span>
    </div>
  );
}
