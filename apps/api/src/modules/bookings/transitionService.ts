import {
  assertValidTransition,
  type BookingStatus,
  type BookingRecord,
  type BookingStatusHistoryEntry,
  type Paise,
} from "@sanitary/shared";
import { bookingRepo } from "./repo.js";
import { bookingEvents, BOOKING_DOMAIN_EVENTS } from "./events.js";
import { AppError, NotFoundError } from "../../errors/appError.js";

export interface StatusTransitionParams {
  bookingId: string;
  targetStatus: BookingStatus;
  reason?: string;
  updatedBy: string;
  expectedCurrentStatus?: BookingStatus;
  cancelledBy?: "customer" | "partner" | "admin" | "system";
  cancellationFeePaise?: Paise;
}

/**
 * Service managing deterministic booking state transitions.
 * Transitions are executed ONLY using the shared state machine.
 */
export class BookingTransitionService {
  /**
   * Executes atomic status transition, appends to statusHistory, and emits domain events.
   * Big-O: O(1) state-machine evaluation and O(1) indexed write.
   */
  public async transition(params: StatusTransitionParams): Promise<BookingRecord> {
    const booking = await bookingRepo.findById(params.bookingId);
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    if (params.expectedCurrentStatus && booking.status !== params.expectedCurrentStatus) {
      throw new AppError(
        409,
        "STATUS_PRECONDITION_FAILED",
        `Precondition failed: Expected status '${params.expectedCurrentStatus}', but booking is '${booking.status}'`,
      );
    }

    // Enforce shared state machine transition invariant
    assertValidTransition(booking.status, params.targetStatus);

    const historyEntry: BookingStatusHistoryEntry = {
      from: booking.status,
      to: params.targetStatus,
      timestamp: new Date().toISOString(),
      reason: params.reason,
      updatedBy: params.updatedBy,
    };

    const updated = await bookingRepo.atomicStatusUpdate({
      bookingId: params.bookingId,
      fromStatus: booking.status,
      toStatus: params.targetStatus,
      historyEntry,
      cancelReason: params.targetStatus === "CANCELLED" ? params.reason : undefined,
      cancelledBy: params.cancelledBy,
      cancellationFeePaise: params.cancellationFeePaise,
    });

    if (!updated) {
      throw new AppError(
        409,
        "CONCURRENT_MODIFICATION",
        "Concurrent booking modification detected. Please reload.",
      );
    }

    // Emit domain events
    bookingEvents.emitEvent(BOOKING_DOMAIN_EVENTS.STATUS_CHANGED, {
      bookingId: updated._id,
      from: booking.status,
      to: params.targetStatus,
      reason: params.reason,
      updatedBy: params.updatedBy,
      timestamp: historyEntry.timestamp,
    });

    if (params.targetStatus === "CANCELLED") {
      bookingEvents.emitEvent(BOOKING_DOMAIN_EVENTS.CANCELLED, {
        bookingId: updated._id,
        customerId: updated.customerId,
        reason: params.reason ?? "Booking cancelled",
        cancelledBy: params.cancelledBy ?? "system",
        cancellationFeePaise: params.cancellationFeePaise ?? 0,
        timestamp: historyEntry.timestamp,
      });
    }

    return updated;
  }
}

export const bookingTransitionService = new BookingTransitionService();
