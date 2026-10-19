import {
  type BookingRecord,
  type BookingSlot,
  type BookingItem,
  type BookingAddressSnapshot,
  type BookingStatus,
  type PaginatedResponse,
  type Paise,
} from "@sanitary/shared";
import { bookingRepo } from "./repo.js";
import { bookingTransitionService } from "./transitionService.js";
import { bookingEvents, BOOKING_DOMAIN_EVENTS } from "./events.js";
import { generatePickupOtp, verifyPickupOtp } from "./otp.js";
import { addressService } from "../addresses/service.js";
import { wasteTypeService } from "../wasteTypes/service.js";
import { getRedisClient } from "../../infra/redis.js";
import { AppError, NotFoundError, ForbiddenError } from "../../errors/appError.js";

const REDIS_OTP_PREFIX = "booking:otp:";
const REDIS_OTP_TTL_SECONDS = 86400; // 24 hours — OTP expires same day as pickup

export interface CreateBookingInput {
  customerId: string;
  addressId: string;
  items: Array<{
    wasteTypeId: string;
    quantity: number;
    estimatedWeightKg?: number;
  }>;
  slot: BookingSlot;
  idempotencyKey?: string;
  customerNotes?: string;
}

export class BookingService {
  /**
   * Creates a new booking with price calculation, address snapshot, and pickup OTP.
   * If an idempotencyKey is supplied and already processed, returns original booking.
   * Big-O: O(N) where N is items count.
   */
  public async createBooking(
    input: CreateBookingInput,
  ): Promise<{ booking: BookingRecord; isReplay: boolean }> {
    const redis = getRedisClient();

    // 1. Idempotency Check: return original booking if key exists for this customer
    if (input.idempotencyKey) {
      const existing = await bookingRepo.findByIdempotencyKey(
        input.customerId,
        input.idempotencyKey,
      );
      if (existing) {
        const rawOtp = await redis.get(`${REDIS_OTP_PREFIX}${existing._id}`);
        return {
          booking: { ...existing, pickupOtp: rawOtp ?? undefined },
          isReplay: true,
        };
      }
    }

    // 2. Fetch customer address and snapshot it
    const address = await addressService.getById(input.addressId, input.customerId);
    const addressSnapshot: BookingAddressSnapshot = {
      addressId: address._id,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      location: address.location,
      buildingId: address.buildingId,
    };

    // 3. Compute quote from waste types catalog
    const quoteReqItems = input.items.map((it) => ({
      wasteTypeId: it.wasteTypeId,
      quantity: it.quantity,
      weightKg: it.estimatedWeightKg ?? 0,
    }));

    const quoteRes = await wasteTypeService.calculateQuote({ items: quoteReqItems });
    const bookingItems: BookingItem[] = quoteRes.items.map((it) => ({
      wasteTypeId: it.wasteTypeId,
      name: it.name,
      category: "standard",
      quantity: it.quantity ?? 1,
      estimatedWeightKg: it.weightKg ?? 0,
      pricePaise: it.basePricePaise * (it.quantity ?? 1),
    }));

    // 4. Generate cryptographically secure pickup OTP
    const { rawOtp, hashedOtp } = generatePickupOtp();

    // 5. Build initial status history entry
    const nowIso = new Date().toISOString();
    const initialHistory = [
      {
        from: "CREATED" as BookingStatus,
        to: "CREATED" as BookingStatus,
        timestamp: nowIso,
        reason: "Booking created by customer",
        updatedBy: input.customerId,
      },
    ];

    try {
      const created = await bookingRepo.create({
        customerId: input.customerId,
        items: bookingItems,
        address: addressSnapshot,
        slot: input.slot,
        quote: quoteRes.breakdown,
        status: "CREATED",
        statusHistory: initialHistory,
        pickupOtpHashed: hashedOtp,
        idempotencyKey: input.idempotencyKey,
        customerNotes: input.customerNotes,
      });

      // Persist plaintext OTP in Redis for customer retrieval
      await redis.set(`${REDIS_OTP_PREFIX}${created._id}`, rawOtp, "EX", REDIS_OTP_TTL_SECONDS);

      // Emit domain event
      bookingEvents.emitEvent(BOOKING_DOMAIN_EVENTS.CREATED, {
        bookingId: created._id,
        customerId: created.customerId,
        address: created.address,
        quote: created.quote,
        slot: created.slot,
        createdAt: created.createdAt,
      });

      return {
        booking: { ...created, pickupOtp: rawOtp },
        isReplay: false,
      };
    } catch (err: unknown) {
      // Handle concurrent duplicate idempotency key race
      const mongoError = err as { code?: number };
      if (mongoError.code === 11000 && input.idempotencyKey) {
        const existing = await bookingRepo.findByIdempotencyKey(
          input.customerId,
          input.idempotencyKey,
        );
        if (existing) {
          const rawOtp = await redis.get(`${REDIS_OTP_PREFIX}${existing._id}`);
          return {
            booking: { ...existing, pickupOtp: rawOtp ?? undefined },
            isReplay: true,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Retrieves single booking by ID with role-based redaction of pickup OTP.
   */
  public async getBookingById(
    bookingId: string,
    userId: string,
    role: string,
  ): Promise<BookingRecord> {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking not found with ID '${bookingId}'`);
    }

    // Role-based access validation
    if (role === "customer" && booking.customerId !== userId) {
      throw new ForbiddenError("You are not authorized to view this booking");
    }
    if (role === "partner" && booking.partnerId !== userId) {
      throw new ForbiddenError("You are not authorized to view this booking");
    }

    // Customer and Admin can view the plaintext pickup OTP
    if (role === "customer" || role === "admin") {
      const redis = getRedisClient();
      const rawOtp = await redis.get(`${REDIS_OTP_PREFIX}${bookingId}`);
      if (rawOtp) {
        booking.pickupOtp = rawOtp;
      }
    } else {
      delete booking.pickupOtp;
    }

    return booking;
  }

  /**
   * Customer cancellation workflow enforcing cancellation policy rules.
   */
  public async cancelByCustomer(
    bookingId: string,
    customerId: string,
    reason: string,
  ): Promise<BookingRecord> {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking not found with ID '${bookingId}'`);
    }

    if (booking.customerId !== customerId) {
      throw new ForbiddenError("You are not authorized to cancel this booking");
    }

    // Disallow cancelling in terminal states or post-OTP verification
    if (booking.status === "CANCELLED") {
      throw new AppError(400, "ALREADY_CANCELLED", "Booking is already cancelled");
    }
    if (
      booking.status === "OTP_VERIFIED" ||
      booking.status === "COLLECTED" ||
      booking.status === "PAID" ||
      booking.status === "COMPLETED"
    ) {
      throw new AppError(
        400,
        "CANNOT_CANCEL_IN_CURRENT_STATUS",
        `Cannot cancel booking once pickup execution has started (status: '${booking.status}')`,
      );
    }

    // Cancellation fee rule:
    // Before partner dispatch (CREATED, SEARCHING, NO_PARTNER) -> 0 paise
    // After partner dispatch (ASSIGNED, EN_ROUTE, ARRIVED) -> 5000 paise (₹50 convenience compensation)
    let cancellationFeePaise: Paise = 0;
    if (["ASSIGNED", "EN_ROUTE", "ARRIVED"].includes(booking.status)) {
      cancellationFeePaise = 5000;
    }

    return bookingTransitionService.transition({
      bookingId,
      targetStatus: "CANCELLED",
      reason,
      updatedBy: customerId,
      cancelledBy: "customer",
      cancellationFeePaise,
    });
  }

  /**
   * Partner verifies physical pickup OTP upon arrival.
   */
  public async verifyOtp(
    bookingId: string,
    partnerId: string,
    otp: string,
  ): Promise<BookingRecord> {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking not found with ID '${bookingId}'`);
    }

    if (booking.partnerId !== partnerId) {
      throw new ForbiddenError("You are not assigned to this booking");
    }

    if (booking.status !== "ARRIVED") {
      throw new AppError(
        400,
        "INVALID_STATUS_FOR_OTP",
        `Pickup OTP can only be verified when status is 'ARRIVED' (current: '${booking.status}')`,
      );
    }

    const isValid = verifyPickupOtp(otp, booking.pickupOtpHashed);
    if (!isValid) {
      throw new AppError(400, "INVALID_PICKUP_OTP", "Invalid pickup OTP provided");
    }

    return bookingTransitionService.transition({
      bookingId,
      targetStatus: "OTP_VERIFIED",
      reason: "Pickup OTP physically verified by partner",
      updatedBy: partnerId,
    });
  }

  /**
   * Keyset paginated customer bookings.
   */
  public async getCustomerBookings(
    customerId: string,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<BookingRecord>> {
    return bookingRepo.findCustomerBookings(customerId, cursor, limit);
  }

  /**
   * Keyset paginated partner bookings.
   */
  public async getPartnerBookings(
    partnerId: string,
    status?: BookingStatus,
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<BookingRecord>> {
    return bookingRepo.findPartnerBookings(partnerId, status, cursor, limit);
  }

  /**
   * Keyset paginated admin bookings.
   */
  public async getAdminBookings(
    filters: {
      status?: BookingStatus;
      customerId?: string;
      partnerId?: string;
    },
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponse<BookingRecord>> {
    return bookingRepo.findAdminBookings(filters, cursor, limit);
  }
}

export const bookingService = new BookingService();
