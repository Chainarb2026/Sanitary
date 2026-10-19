import mongoose from "mongoose";
import { config } from "./config.js";
import { logger } from "./logger.js";

let memoryServerInstance: import("mongodb-memory-server").MongoMemoryServer | null = null;

/**
 * Connects to MongoDB via Mongoose.
 * If host MongoDB is offline in development, automatically boots in-memory MongoDB.
 * Big-O: O(1) connection initialization.
 */
export async function connectDB(uri: string = config.MONGO_URI): Promise<typeof mongoose> {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: config.NODE_ENV === "production" ? 5000 : 1500,
      connectTimeoutMS: config.NODE_ENV === "production" ? 5000 : 1500,
    });
    logger.info({ uri: uri.replace(/\/\/.*@/, "//***@") }, "MongoDB connected successfully");
    return mongoose;
  } catch (error) {
    if (config.NODE_ENV !== "production") {
      logger.warn(
        "Host MongoDB (127.0.0.1:27017) offline. Spawning high-speed in-memory MongoDB instance...",
      );
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        memoryServerInstance = await MongoMemoryServer.create();
        const memUri = memoryServerInstance.getUri();
        await mongoose.connect(memUri);
        logger.info({ uri: memUri }, "[DEV] In-memory MongoDB connected successfully!");
        return mongoose;
      } catch (memErr) {
        logger.error({ err: memErr }, "Failed to spawn in-memory MongoDB");
      }
    }
    logger.error({ err: error }, "Failed to connect to MongoDB");
    throw error;
  }
}

/**
 * Disconnects from MongoDB.
 */
export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  }
}

/**
 * Checks if the MongoDB connection is active and healthy.
 * 1 = connected.
 */
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
