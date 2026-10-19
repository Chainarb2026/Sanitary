import { Queue, type Job } from "bullmq";
import { getRedisClient } from "../../infra/redis.js";
import { logger } from "../../infra/logger.js";

export const DISPATCH_QUEUE_NAME = "dispatch";

export interface DispatchStartJobData {
  bookingId: string;
}

export interface DispatchTimeoutJobData {
  bookingId: string;
  candidatePartnerIds: string[];
  currentIndex: number;
}

export type DispatchJobData = DispatchStartJobData | DispatchTimeoutJobData;

let dispatchQueueInstance: Queue | null = null;

/**
 * Returns or initializes the BullMQ dispatch queue.
 */
export function getDispatchQueue(): Queue {
  if (!dispatchQueueInstance) {
    const redis = getRedisClient();
    dispatchQueueInstance = new Queue(DISPATCH_QUEUE_NAME, {
      connection: redis.duplicate(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return dispatchQueueInstance;
}

/**
 * Sets queue instance for unit/mock testing.
 */
export function setDispatchQueue(queue: Queue | null): void {
  dispatchQueueInstance = queue;
}

/**
 * Adds an initial dispatch start job.
 */
export async function addDispatchStartJob(bookingId: string): Promise<Job<DispatchStartJobData>> {
  const queue = getDispatchQueue();
  logger.info({ bookingId }, "Enqueuing dispatch:start job");
  return queue.add("dispatch:start", { bookingId }, { jobId: `start:${bookingId}` });
}

/**
 * Adds a 15-second delayed offer timeout job.
 */
export async function addOfferTimeoutJob(
  bookingId: string,
  candidatePartnerIds: string[],
  currentIndex: number,
  delayMs = 15000,
): Promise<Job<DispatchTimeoutJobData>> {
  const queue = getDispatchQueue();
  logger.info({ bookingId, currentIndex, delayMs }, "Enqueuing dispatch:timeout delayed job");
  return queue.add(
    "dispatch:timeout",
    { bookingId, candidatePartnerIds, currentIndex },
    { delay: delayMs, jobId: `timeout:${bookingId}:${currentIndex}` },
  );
}
