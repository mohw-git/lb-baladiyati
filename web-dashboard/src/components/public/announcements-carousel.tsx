'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlatformAnnouncement } from '@shared/types/platform-announcement';
import { getLocalizedValue, type Locale } from '@shared/types/locale';
import { resolveBrandMediaUrl } from '@/lib/municipality-branding';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

type AnnouncementsCarouselProps = {
  items: PlatformAnnouncement[];
  locale: Locale;
  readMoreLabel: string;
  className?: string;
};

export function AnnouncementsCarousel({
  items,
  locale,
  readMoreLabel,
  className,
}: AnnouncementsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = items.length;

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (count <= 1 || paused) return;
    const t = window.setInterval(() => go(1), 7000);
    return () => window.clearInterval(t);
  }, [count, paused, go]);

  if (count === 0) return null;

  const item = items[index];
  const title = getLocalizedValue(item, 'title', locale, '');
  const summary = getLocalizedValue(item, 'summary', locale, '');
  const imageSrc = resolveBrandMediaUrl(item.imageUrl);
  const dateStr = item.publishAt || item.createdAt;

  return (
    <div
      className={cn('relative overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label={title}
    >
      <div className="grid md:grid-cols-[1.15fr,1fr]">
        <div className="relative min-h-[180px] bg-navy-950 sm:min-h-[220px] md:min-h-[240px]">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-950/20 to-transparent md:bg-gradient-to-r md:from-navy-950/60 md:via-transparent" />
        </div>

        <div className="flex flex-col justify-center p-5 sm:p-6 md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            {formatDate(dateStr)}
          </p>
          <h3 className="mt-2 text-lg font-bold leading-snug text-navy-950 sm:text-xl">{title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{summary}</p>
          <Link
            href={`/announcements/${item.id}`}
            className="mt-4 inline-flex w-fit items-center gap-1 rounded border border-brand-700 bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
          >
            {readMoreLabel}
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      {count > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute start-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/30 bg-navy-950/50 p-2 text-white backdrop-blur hover:bg-navy-950/70 md:flex"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute end-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-white/30 bg-navy-950/50 p-2 text-white backdrop-blur hover:bg-navy-950/70 md:flex"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={items[i].id}
                type="button"
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i === index ? 'bg-emerald-500' : 'bg-white/50',
                )}
                aria-label={`Slide ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      ) : null}

      {/* Touch swipe */}
      <div
        className="absolute inset-0 md:hidden"
        aria-hidden
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
          if (Math.abs(dx) > 48) go(dx > 0 ? -1 : 1);
          touchStartX.current = null;
        }}
      />
    </div>
  );
}
