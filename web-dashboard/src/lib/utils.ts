import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format ISO date string to readable format */
export function formatDate(date: string | Date, fmt: string = 'MMM d, yyyy') {
  return format(new Date(date), fmt);
}

/** Format ISO date string to relative time (e.g. "2 hours ago") */
export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/** Get user initials from first and last name */
export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallback = '?',
) {
  const initials = `${firstName?.charAt(0) ?? ''}${lastName?.charAt(0) ?? ''}`.toUpperCase();
  return initials || fallback;
}

/** Get full name — safe when user / name fields are null (e.g. deleted staff, system actions) */
export function getFullName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
  fallback = '—',
): string {
  if (!user) return fallback;
  const parts = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' ') : fallback;
}

/** Build query string from params object, omitting undefined/null values */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        searchParams.set(key, value.join(','));
      } else {
        searchParams.set(key, String(value));
      }
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}
