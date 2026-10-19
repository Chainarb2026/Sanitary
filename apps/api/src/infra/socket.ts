import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient } from "./redis.js";
import { logger } from "./logger.js";
import { config } from "./config.js";
import { geoService } from "../modules/partners/geoService.js";
import { verifyAccessToken } from "../utils/jwt.js";

let io: SocketIOServer | null = null;

/**
 * Initializes Socket.IO with the Redis adapter for multi-instance scaling.
 */
export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = config.CORS_ORIGINS.split(",").map((s) => s.trim());
  const redis = getRedisClient();
  const hasPsubscribe =
    typeof (redis as unknown as { psubscribe?: unknown }).psubscribe === "function";

  let adapterOption: ReturnType<typeof createAdapter> | undefined = undefined;

  if (hasPsubscribe && typeof redis.duplicate === "function") {
    try {
      const pubClient = redis;
      const subClient = pubClient.duplicate();
      subClient.on("error", () => {});
      adapterOption = createAdapter(pubClient, subClient);
    } catch {
      // Fallback to default built-in in-memory adapter
    }
  }

  const serverOptions: Partial<import("socket.io").ServerOptions> = {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    ...(adapterOption ? { adapter: adapterOption } : {}),
  };

  io = new SocketIOServer(httpServer, serverOptions);

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "WebSocket client connected");

    // Authenticate and join user room if JWT token is passed in handshake auth
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.query?.token as string | undefined);

    if (token) {
      try {
        const payload = verifyAccessToken(token);
        const userRoom = `user:${payload.sub}`;
        void socket.join(userRoom);
        logger.debug({ socketId: socket.id, userRoom }, "Socket joined private user room");
      } catch (err) {
        logger.debug(
          { err, socketId: socket.id },
          "Socket token verification failed during handshake",
        );
      }
    }

    // Allow explicit join event for testing and reconnects
    socket.on("join", (data: { userId: string }) => {
      if (data?.userId) {
        const userRoom = `user:${data.userId}`;
        void socket.join(userRoom);
        logger.debug({ socketId: socket.id, userRoom }, "Socket explicitly joined user room");
      }
    });

    // Real-time location ping event for partners
    socket.on(
      "location:ping",
      async (data: {
        partnerId: string;
        latitude: number;
        longitude: number;
        customerId?: string;
      }) => {
        try {
          if (!data?.partnerId || data.latitude == null || data.longitude == null) {
            return;
          }

          const result = await geoService.recordLocationPing(
            data.partnerId,
            data.latitude,
            data.longitude,
          );

          socket.emit("location:ack", {
            success: true,
            throttled: result.throttled,
            timestamp: new Date().toISOString(),
          });

          // Forward live partner location to customer tracking room if provided
          if (data.customerId) {
            emitPartnerLocation(data.customerId, {
              partnerId: data.partnerId,
              latitude: data.latitude,
              longitude: data.longitude,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          logger.warn({ err, socketId: socket.id }, "Error processing location:ping socket event");
        }
      },
    );

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "WebSocket client disconnected");
    });
  });

  logger.info("Socket.IO initialized with Redis adapter");
  return io;
}

/**
 * Returns the initialized Socket.IO server or null if uninitialized.
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Sets mock Socket.IO instance for unit testing.
 */
export function setSocketServer(mockIo: SocketIOServer | null): void {
  io = mockIo;
}

/**
 * Emits real-time event to a specific user's private room.
 * Big-O: O(1) Redis pub/sub publish.
 */
export function emitToUser(userId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emits dispatch offer to candidate partner.
 */
export function emitOffer(partnerId: string, offerData: unknown): void {
  emitToUser(partnerId, "offer", offerData);
}

/**
 * Emits assignment confirmation to customer and partner.
 */
export function emitAssigned(customerId: string, partnerId: string, assignmentData: unknown): void {
  emitToUser(customerId, "assigned", assignmentData);
  emitToUser(partnerId, "assigned", assignmentData);
}

/**
 * Emits status change event to customer and partner.
 */
export function emitStatusChange(userIds: string[], statusData: unknown): void {
  for (const userId of userIds) {
    emitToUser(userId, "status_change", statusData);
  }
}

/**
 * Emits partner live coordinates to tracking customer.
 */
export function emitPartnerLocation(customerId: string, locationData: unknown): void {
  emitToUser(customerId, "partner_location", locationData);
}
