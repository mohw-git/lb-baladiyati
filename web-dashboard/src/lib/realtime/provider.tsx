'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/auth';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Realtime provider — connects to the backend Socket.IO gateway whenever the
 * user is authenticated and translates incoming events into React Query
 * invalidations. Mount once at the dashboard root; nothing is rendered.
 *
 * Server emits events of the form `entity:event` (e.g. "complaint:updated").
 * For each one we invalidate the keys that the relevant pages use to fetch
 * data, so any open page picks up the change instantly without polling.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken || !userId) {
      // Disconnect if we lost auth (logout, refresh failure, etc.)
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(`${API_URL}/realtime`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    // Event → React Query keys to invalidate. Granular enough that we don't
    // refetch unrelated lists; broad enough that we don't have to enumerate
    // every page.
    const invalidations: Record<string, () => void> = {
      'complaint:created': () => {
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
      },
      'complaint:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
      },
      'complaint:deleted': () => {
        queryClient.invalidateQueries({ queryKey: ['complaints'] });
      },
      'task:created': () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
      'task:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
      'transfer:created': () => {
        queryClient.invalidateQueries({ queryKey: ['transfers'] });
        queryClient.invalidateQueries({ queryKey: ['org-chart'] });
      },
      'transfer:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['transfers'] });
        queryClient.invalidateQueries({ queryKey: ['org-chart'] });
      },
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
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      },
      'user:updated': () => {
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['user'] });
        queryClient.invalidateQueries({ queryKey: ['org-chart'] });
      },
      'notification:new': () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
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

  return <>{children}</>;
}
