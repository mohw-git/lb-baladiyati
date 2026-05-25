'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AuthCardProps = {
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** White rounded card for citizen auth forms. */
export function AuthCard({
  icon,
  title,
  subtitle,
  children,
  footer,
  className,
  bodyClassName,
}: AuthCardProps) {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-white/20 bg-white shadow-xl shadow-navy-950/20',
        className,
      )}
    >
      <div className={cn('p-6 sm:p-7', bodyClassName)}>
        {icon ? (
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-navy-900">
              {icon}
            </div>
          </div>
        ) : null}
        {title ? (
          <h2 className="text-center text-base font-bold text-navy-950 sm:text-lg">{title}</h2>
        ) : null}
        {subtitle ? (
          <p className="mt-1 text-center text-xs leading-relaxed text-gray-600 sm:text-sm">
            {subtitle}
          </p>
        ) : null}
        <div className={title || subtitle ? 'mt-5' : undefined}>{children}</div>
      </div>
      {footer ? (
        <div className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-500 sm:px-7">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
