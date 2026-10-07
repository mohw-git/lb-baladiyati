import { ApiError } from './client';

/** Human-readable API error for boundary validate/save (includes field details). */
export function formatBoundaryApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'INVALID_BOUNDARY_GEOJSON') {
      return err.message || fallback;
    }
    if (err.details?.length) {
      return err.details.map((d) => d.message).join(' ');
    }
    return err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
