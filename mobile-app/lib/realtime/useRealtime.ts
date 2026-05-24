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

    const invalidations: Record<string, () => void> = {
      'complaint:created': () => queryClient.invalidateQueries({ queryKey: ['complaints'] }),
      'complaint:updated': () => queryClient.invalidateQueries({ queryKey: ['complaints'] }),
      'complaint:deleted': () => queryClient.invalidateQueries({ queryKey: ['complaints'] }),
      'task:created': () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      'task:updated': () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      'transfer:created': () => queryClient.invalidateQueries({ queryKey: ['transfers'] }),
      'transfer:updated': () => queryClient.invalidateQueries({ queryKey: ['transfers'] }),
      'help-request:created': () => {
        queryClient.invalidateQueries({ queryKey: ['help-requests'] });
        queryClient.invalidateQueries({ queryKey: ['complaint'] });
      },
      'help-request:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['help-requests'] });
        queryClient.invalidateQueries({ queryKey: ['complaint'] });
      },
      'kyc:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['kyc'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
      },
      'user:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      },
      'notification:new': () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
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
