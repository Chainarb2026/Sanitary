import type { Job } from "bullmq";
import { dispatchService } from "./service.js";
import { logger } from "../../infra/logger.js";
import type { DispatchStartJobData, DispatchTimeoutJobData } from "./queue.js";

/**
 * BullMQ job processor for automated dispatch and offer timeouts.
 */
export async function dispatchProcessor(job: Job): Promise<void> {
  logger.info({ jobId: job.id, name: job.name }, "Processing dispatch BullMQ job");

  switch (job.name) {
    case "dispatch:start": {
      const data = job.data as DispatchStartJobData;
      await dispatchService.startDispatch(data.bookingId);
      break;
    }

    case "dispatch:timeout": {
      const data = job.data as DispatchTimeoutJobData;
      await dispatchService.handleOfferTimeout(
        data.bookingId,
        data.candidatePartnerIds,
        data.currentIndex,
      );
      break;
    }

    default:
      logger.warn({ jobName: job.name }, "Unknown dispatch job received");
  }
}
