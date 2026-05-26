import type { QueryClient } from '@tanstack/react-query';

/** Single place to refresh complaint-related caches after worker/citizen actions. */
export function invalidateComplaintQueries(
  queryClient: QueryClient,
  complaintId?: string,
) {
  if (complaintId) {
    queryClient.invalidateQueries({ queryKey: ['complaint', complaintId] });
  }
  queryClient.invalidateQueries({ queryKey: ['complaint'] });
  queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
  queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
  queryClient.invalidateQueries({ queryKey: ['complaints'] });
  queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
}
