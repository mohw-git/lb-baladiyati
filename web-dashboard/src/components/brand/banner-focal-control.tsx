'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  bannerObjectPosition,
  normalizeBannerFocal,
  resolveBrandMediaUrl,
} from '@/lib/municipality-branding';

type BannerFocalControlProps = {
  bannerImageUrl: string;
  focalX: number;
  focalY: number;
  onChange: (focalX: number, focalY: number) => void;
  labels: {
    title: string;
    hint: string;
    horizontal: string;
    vertical: string;
    center: string;
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
};

export function BannerFocalControl({
  bannerImageUrl,
  focalX,
  focalY,
  onChange,
  labels,
}: BannerFocalControlProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const src = resolveBrandMediaUrl(bannerImageUrl);
  const x = normalizeBannerFocal(focalX);
  const y = normalizeBannerFocal(focalY);
  const objectPosition = bannerObjectPosition(x, y);

  const pickFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const nx = Math.round(((clientX - rect.left) / rect.width) * 100);
      const ny = Math.round(((clientY - rect.top) / rect.height) * 100);
      onChange(
        Math.min(100, Math.max(0, nx)),
        Math.min(100, Math.max(0, ny)),
      );
    },
    [onChange],
  );

  const presets: { label: string; x: number; y: number }[] = [
    { label: labels.center, x: 50, y: 50 },
    { label: labels.top, x: 50, y: 20 },
    { label: labels.bottom, x: 50, y: 80 },
    { label: labels.left, x: 20, y: 50 },
    { label: labels.right, x: 80, y: 50 },
  ];

  return (
    <div className="space-y-3 rounded border border-gray-200 bg-gray-50/80 p-3">
      <div>
        <p className="text-sm font-medium text-gray-800">{labels.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{labels.hint}</p>
      </div>

      <div
        ref={frameRef}
        role="button"
        tabIndex={0}
        className="relative aspect-[1920/560] w-full cursor-crosshair overflow-hidden rounded border border-gray-300 bg-navy-950"
        onClick={(e) => pickFromEvent(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const rect = frameRef.current?.getBoundingClientRect();
            if (rect) pickFromEvent(rect.left + (rect.width * x) / 100, rect.top + (rect.height * y) / 100);
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition }}
          draggable={false}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy-950/85 via-navy-950/55 to-navy-950/35"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-600 shadow-md"
          style={{ left: `${x}%`, top: `${y}%` }}
          aria-hidden
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {labels.horizontal} ({x}%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={x}
            onChange={(e) => onChange(Number(e.target.value), y)}
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">
            {labels.vertical} ({y}%)
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={y}
            onChange={(e) => onChange(x, Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.x, p.y)}
            className={cn(
              'rounded border px-2 py-1 text-[11px] font-medium transition-colors',
              x === p.x && y === p.y
                ? 'border-brand-600 bg-brand-50 text-brand-800'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
