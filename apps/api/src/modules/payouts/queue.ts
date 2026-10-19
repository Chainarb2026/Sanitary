import { Queue, type Job } from "bullmq";
import { getRedisClient } from "../../infra/redis.js";
import { logger } from "../../infra/logger.js";

export const SETTLEMENT_QUEUE_NAME = "settlement";

export interface SettlementJobData {
  payoutId: string;
}

let settlementQueueInstance: Queue | null = null;

/**
 * Returns or initializes the BullMQ settlement queue.
 */
export function getSettlementQueue(): Queue {
  if (!settlementQueueInstance) {
    const redis = getRedisClient();
    settlementQueueInstance = new Queue(SETTLEMENT_QUEUE_NAME, {
      connection: redis.duplicate(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return settlementQueueInstance;
}

/**
 * Sets queue instance for unit/mock testing.
 */
export function setSettlementQueue(queue: Queue | null): void {
  settlementQueueInstance = queue;
}

/**
 * Enqueues a settlement payout processing job.
 */
export async function addSettlementJob(payoutId: string): Promise<Job<SettlementJobData>> {
  const queue = getSettlementQueue();
  logger.info({ payoutId }, "Enqueuing settlement:process job");
  return queue.add("settlement:process", { payoutId }, { jobId: `settle:${payoutId}` });
}
