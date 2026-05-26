import { useEffect, useRef } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../auth/store';
import { API_URL } from '../../constants/config';

/**
 * Mobile realtime hook. Mirrors the web RealtimeProvider:
 *   - opens a single Socket.IO connection while authenticated
 *   - listens for the typed event envelopes the backend emits
 *   - invalidates the matching React Query keys so screens refetch instantly
 *
 * Mount it once in the root layout (after the QueryClientProvider).
 */
export function useRealtime(queryClient: QueryClient) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken || !userId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(`${API_URL}/realtime`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    /**
     * Invalidate every query key used by complaint-list screens. Keep this
     * function as the single source of truth — adding a new screen means
     * adding its query key here. Missing keys = stale UI after web/HOD
     * actions, which is the exact bug the audit flagged.
     */
    const invalidateComplaintLists = () => {
      // Tabs screens
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      queryClient.invalidateQueries({ queryKey: ['my-complaints', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks', 'recent'] });
      // Legacy / shared key (kept for forward compatibility)
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      // Per-complaint detail query keys are ['complaint', id] — invalidate
      // the prefix so all open complaint detail screens refetch.
      queryClient.invalidateQueries({ queryKey: ['complaint'] });
      // Home screen stats badge
      queryClient.invalidateQueries({ queryKey: ['complaint-stats'] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    };

    const invalidateHelpAndTransferInboxes = () => {
      // Two key shapes are in use: 'help-requests' (detail panel) and
      // 'helpRequests' (inbox screen). Hit both, plus their badge-count
      // sub-keys so the inbox tab dot updates immediately.
      queryClient.invalidateQueries({ queryKey: ['help-requests'] });
      queryClient.invalidateQueries({ queryKey: ['help-request'] });
      queryClient.invalidateQueries({ queryKey: ['helpRequests'] });
      queryClient.invalidateQueries({ queryKey: ['helpRequests', 'pendingCount'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers', 'pendingCount'] });
    };

    const invalidations: Record<string, () => void> = {
      'complaint:created': () => invalidateComplaintLists(),
      'complaint:updated': () => {
        invalidateComplaintLists();
        // Inboxes may show a count of "complaints needing my attention".
        invalidateHelpAndTransferInboxes();
      },
      'complaint:deleted': () => invalidateComplaintLists(),
      'task:created': () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      'task:updated': () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      'transfer:created': () => invalidateHelpAndTransferInboxes(),
      'transfer:updated': () => {
        invalidateHelpAndTransferInboxes();
        // Transfer accept moves the complaint between departments — its
        // status and assignee change for both sides, so we must refresh
        // every complaint list on the device, not just the inbox.
        invalidateComplaintLists();
      },
      'help-request:created': () => {
        invalidateHelpAndTransferInboxes();
        // Complaint detail shows the help panel inline.
        queryClient.invalidateQueries({ queryKey: ['complaint'] });
      },
      'help-request:updated': () => {
        invalidateHelpAndTransferInboxes();
        // Help approval/rejection doesn't auto-complete the complaint, but
        // active-help indicators on the detail/list panels do change.
        queryClient.invalidateQueries({ queryKey: ['complaint'] });
        invalidateComplaintLists();
      },
      'kyc:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['kyc'] });
        queryClient.invalidateQueries({ queryKey: ['kycStatus'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
      },
      'user:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      },
      'notification:new': () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      },
    };

    for (const [event, handler] of Object.entries(invalidations)) {
      socket.on(event, handler);
    }

    return () => {
      for (const event of Object.keys(invalidations)) socket.off(event);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, userId, queryClient]);
}
