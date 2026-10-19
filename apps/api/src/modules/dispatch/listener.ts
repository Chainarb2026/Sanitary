import { bookingEvents, BOOKING_DOMAIN_EVENTS } from "../bookings/events.js";
import { dispatchService } from "./service.js";
import { logger } from "../../infra/logger.js";

/**
 * Initializes listeners for booking domain events to trigger automated dispatch.
 */
export function initDispatchListeners(): void {
  bookingEvents.on(BOOKING_DOMAIN_EVENTS.CREATED, (event) => {
    logger.info(
      { bookingId: event.bookingId },
      "booking.created domain event received. Starting dispatch.",
    );
    void dispatchService.startDispatch(event.bookingId).catch((err) => {
      logger.error({ err, bookingId: event.bookingId }, "Dispatch pipeline error for booking");
    });
  });
}
