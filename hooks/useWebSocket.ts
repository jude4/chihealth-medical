import { useEffect, useRef } from 'react';
import * as api from '../services/apiService.ts';

export const useWebSocket = (userId: string | undefined, onRefetch: () => void) => {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!userId) {
      // If no user, ensure any existing connection is closed
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      return;
    }

    const token = api.getAuthToken();
    if (!token) return;

    // Determine protocol based on window location protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    
    let reconnectTimeout: number | undefined;

    function connect() {
      // Avoid creating multiple connections
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        return;
      }
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        clearTimeout(reconnectTimeout);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'refetch') {
            console.log('Received refetch notification');
            onRefetch();
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected. Attempting to reconnect...');
        // Simple exponential backoff could be added here
        reconnectTimeout = window.setTimeout(connect, 3000); // Reconnect after 3 seconds
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.current?.close(); // This will trigger the onclose handler for reconnection
      };
    }

    connect();

    // Cleanup function
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws.current) {
        // Remove the onclose listener before closing to prevent reconnection attempts on unmount
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [userId, onRefetch]); // Re-run effect if userId changes (login/logout)
};