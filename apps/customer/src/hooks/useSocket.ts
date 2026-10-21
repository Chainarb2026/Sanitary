import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { getStoredAccessToken } from "../api/client.js";

export interface PartnerLocationUpdate {
  partnerId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface BookingStatusChangeUpdate {
  bookingId: string;
  status: string;
  timestamp: string;
  partnerId?: string;
}

export function useSocket(userId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastPartnerLocation, setLastPartnerLocation] = useState<PartnerLocationUpdate | null>(
    null,
  );
  const [lastStatusChange, setLastStatusChange] = useState<BookingStatusChangeUpdate | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL?.trim();
    const socket = wsUrl
      ? io(wsUrl, {
          auth: { token },
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })
      : io({
          auth: { token },
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      if (userId) {
        socket.emit("join", { userId });
      }
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("partner_location", (data: PartnerLocationUpdate) => {
      setLastPartnerLocation(data);
    });

    socket.on("status_change", (data: BookingStatusChangeUpdate) => {
      setLastStatusChange(data);
    });

    socket.on("booking:status_change", (data: BookingStatusChangeUpdate) => {
      setLastStatusChange(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [userId]);

  const emitEvent = useCallback((event: string, data: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    lastPartnerLocation,
    lastStatusChange,
    emitEvent,
  };
}
