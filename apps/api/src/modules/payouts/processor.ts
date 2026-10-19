import type { Job } from "bullmq";
import { payoutService } from "./service.js";
import type { SettlementJobData } from "./queue.js";
import { logger } from "../../infra/logger.js";

/**
 * BullMQ job processor for settlement:process jobs.
 */
export async function settlementProcessor(job: Job<SettlementJobData>): Promise<void> {
  const { payoutId } = job.data;
  logger.info({ jobId: job.id, payoutId }, "BullMQ Worker executing settlement:process job");
  await payoutService.processSettlement(payoutId);
}
