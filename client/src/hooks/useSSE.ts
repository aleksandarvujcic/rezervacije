import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '../api/client';

export function useSSE() {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTokenRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const token = getAccessToken();
    if (!token) return;

    lastTokenRef.current = token;
    const url = `/api/events?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('reservation:change', () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    });

    eventSource.addEventListener('table:change', () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    });

    eventSource.addEventListener('zone:change', () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] });
      queryClient.invalidateQueries({ queryKey: ['floor-plan'] });
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;

      // Auto reconnect after 3 seconds (will pick up new token if refreshed)
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [queryClient]);

  useEffect(() => {
    connect();

    // S1: Poll for token changes to reconnect with fresh token
    const tokenCheckInterval = setInterval(() => {
      const currentToken = getAccessToken();
      if (currentToken && currentToken !== lastTokenRef.current) {
        connect();
      }
    }, 5000);

    return () => {
      clearInterval(tokenCheckInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect]);
}
