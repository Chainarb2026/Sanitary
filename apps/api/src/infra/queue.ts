import { Queue, Worker, type Processor, type QueueOptions, type WorkerOptions } from "bullmq";
import { getRedisClient } from "./redis.js";

/**
 * Creates a standard BullMQ queue connected to the shared Redis client.
 */
export function createQueue<T = unknown>(name: string, opts?: Partial<QueueOptions>): Queue<T> {
  const redis = getRedisClient();
  return new Queue<T>(name, {
    connection: redis.duplicate(),
    ...opts,
  });
}

/**
 * Creates a BullMQ worker connected to the shared Redis client.
 */
export function createWorker<T = unknown, R = unknown>(
  name: string,
  processor: Processor<T, R>,
  opts?: Partial<WorkerOptions>,
): Worker<T, R> {
  const redis = getRedisClient();
  return new Worker<T, R>(name, processor, {
    connection: redis.duplicate(),
    ...opts,
  });
}
