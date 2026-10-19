import { EventEmitter } from "node:events";
import type {
  BookingCreatedEvent,
  BookingStatusChangedEvent,
  BookingCancelledEvent,
} from "@sanitary/shared";
import { logger } from "../../infra/logger.js";

/**
 * Domain Event Names for Bookings Lifecycle
 */
export const BOOKING_DOMAIN_EVENTS = {
  CREATED: "booking.created",
  STATUS_CHANGED: "booking.status_changed",
  CANCELLED: "booking.cancelled",
} as const;

export type BookingDomainEventName =
  (typeof BOOKING_DOMAIN_EVENTS)[keyof typeof BOOKING_DOMAIN_EVENTS];

export interface BookingEventMap {
  "booking.created": BookingCreatedEvent;
  "booking.status_changed": BookingStatusChangedEvent;
  "booking.cancelled": BookingCancelledEvent;
}

class BookingEventEmitter extends EventEmitter {
  public emitEvent<K extends keyof BookingEventMap>(
    event: K,
    payload: BookingEventMap[K],
  ): boolean {
    logger.debug({ event, payload }, "Domain event emitted");
    return this.emit(event, payload);
  }

  public onEvent<K extends keyof BookingEventMap>(
    event: K,
    listener: (payload: BookingEventMap[K]) => void,
  ): this {
    return this.on(event, listener);
  }
}

export const bookingEvents = new BookingEventEmitter();
