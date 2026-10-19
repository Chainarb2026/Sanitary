import mongoose from "mongoose";
import { type BookingRecord, type BookingStatus } from "@sanitary/shared";
import { BookingModel } from "../bookings/model.js";
import { bookingRepo } from "../bookings/repo.js";
import { bookingTransitionService } from "../bookings/transitionService.js";
import { bookingEvents, BOOKING_DOMAIN_EVENTS } from "../bookings/events.js";
import { partnerService } from "../partners/service.js";
import { getRedisClient } from "../../infra/redis.js";
import { emitOffer, emitAssigned, emitStatusChange } from "../../infra/socket.js";
import { selectTopKPartners, type CandidatePartnerInput } from "./scorer.js";
import { addOfferTimeoutJob } from "./queue.js";
import { ledgerService } from "../ledger/service.js";
import { config } from "../../infra/config.js";
import { AppError, NotFoundError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export const PROGRESSIVE_RADII_KM = [3, 5, 8] as const;
export const OFFER_TIMEOUT_SECONDS = 15;
export const REDIS_BUSY_KEY_PREFIX = "partner:busy:";

export interface DispatchResult {
  status: "OFFERED" | "NO_PARTNER" | "SKIPPED";
  bookingId: string;
  candidatePartnerIds: string[];
}

/**
 * Service orchestrating progressive geospatial search, weighted partner scoring,
 * top-k heap selection, timed offers, and atomic concurrency acceptance.
 */
export class DispatchService {
  /**
   * Performs progressive radius search across [3, 5, 8] km to find and score candidates.
   * Big-O: O(N log k) where N is eligible partner count.
   */
  public async findProgressiveCandidates(lat: number, lng: number): Promise<string[]> {
    const redis = getRedisClient();

    for (const radiusKm of PROGRESSIVE_RADII_KM) {
      // 1. Query Redis GEO for online live partners
      const nearby = await partnerService.findNearby(lat, lng, radiusKm, 50);
      if (nearby.length === 0) continue;

      // 2. Filter out currently busy partners
      const partnerIds = nearby.map((p) => p.partnerId);

      // Check Redis busy locks
      const busyChecks = await Promise.all(
        partnerIds.map(async (id) => {
          const isBusy = await redis.exists(`${REDIS_BUSY_KEY_PREFIX}${id}`);
          return { id, isBusy: Boolean(isBusy) };
        }),
      );
      const unbusyIds = busyChecks.filter((c) => !c.isBusy).map((c) => c.id);
      if (unbusyIds.length === 0) continue;

      // Check MongoDB active job assignments
      const activeBookings = await BookingModel.find({
        partnerId: {
          $in: unbusyIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        status: {
          $in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "OTP_VERIFIED", "COLLECTED"],
        },
      })
        .select("partnerId")
        .lean()
        .exec();

      const busyDbPartnerIds = new Set(activeBookings.map((b) => b.partnerId?.toString()));
      const eligibleIds = unbusyIds.filter((id) => !busyDbPartnerIds.has(id));
      if (eligibleIds.length === 0) continue;

      // 3. Filter partners by minimum wallet balance
      const minBalance = config.MIN_PARTNER_WALLET_BALANCE_PAISE;
      const walletChecks = await Promise.all(
        eligibleIds.map(async (id) => {
          const balance = await ledgerService.getBalance("partner", id);
          return { id, isEligible: balance >= minBalance, balance };
        }),
      );

      const solventIds = walletChecks
        .filter((w) => {
          if (!w.isEligible) {
            logger.info(
              { partnerId: w.id, balance: w.balance, minBalance },
              "Partner blocked from dispatch offers due to wallet balance below configured minimum",
            );
          }
          return w.isEligible;
        })
        .map((w) => w.id);

      if (solventIds.length === 0) continue;

      // 4. Load partner profiles for weighted scoring attributes
      const partnerProfiles = await partnerService.findByIds(solventIds);
      const profileMap = new Map(partnerProfiles.map((p) => [p._id, p]));
      const distanceMap = new Map(nearby.map((n) => [n.partnerId, n.distanceKm]));

      const candidateInputs: CandidatePartnerInput[] = solventIds.map((id) => {
        const profile = profileMap.get(id);
        const distanceKm = distanceMap.get(id) ?? radiusKm;
        return {
          partnerId: id,
          distanceKm,
          rating: profile?.rating ?? 5.0,
          acceptanceRate: profile?.acceptanceRate ?? 1.0,
          recentLoad: profile?.recentLoad ?? 0,
        };
      });

      // 4. Rank using Min-Heap of size k
      const topK = selectTopKPartners(candidateInputs, 5, radiusKm);
      if (topK.length > 0) {
        logger.info(
          { radiusKm, candidateCount: topK.length },
          "Discovered candidate partners at progressive search radius",
        );
        return topK.map((c) => c.partnerId);
      }
    }

    return [];
  }

  /**
   * Initiates dispatch workflow for a newly created booking.
   */
  public async startDispatch(bookingId: string): Promise<DispatchResult> {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) {
      throw new NotFoundError(`Booking not found: '${bookingId}'`);
    }

    // Advance to SEARCHING if still in CREATED
    if (booking.status === "CREATED") {
      await bookingTransitionService.transition({
        bookingId,
        targetStatus: "SEARCHING",
        reason: "Dispatch engine initiated partner search",
        updatedBy: "system",
      });
    } else if (booking.status !== "SEARCHING") {
      logger.info(
        { bookingId, status: booking.status },
        "Booking not eligible for dispatch. Skipping.",
      );
      return { status: "SKIPPED", bookingId, candidatePartnerIds: [] };
    }

    const [lng, lat] = booking.address.location.coordinates;
    const candidatePartnerIds = await this.findProgressiveCandidates(lat, lng);

    if (candidatePartnerIds.length === 0) {
      logger.warn({ bookingId }, "No partners available within 8km. Marking NO_PARTNER.");
      await bookingTransitionService.transition({
        bookingId,
        targetStatus: "NO_PARTNER",
        reason: "No available partners within 8km radius",
        updatedBy: "system",
      });

      emitStatusChange([booking.customerId], {
        bookingId,
        status: "NO_PARTNER" as BookingStatus,
        message: "No pickup partner is currently available in your area. Please try again shortly.",
      });

      return { status: "NO_PARTNER", bookingId, candidatePartnerIds: [] };
    }

    // Offer to the top candidate
    await this.offerToCandidate(booking, candidatePartnerIds, 0);

    return { status: "OFFERED", bookingId, candidatePartnerIds };
  }

  /**
   * Offers the booking to a specific candidate partner and schedules the 15s timeout delayed job.
   */
  public async offerToCandidate(
    booking: BookingRecord,
    candidatePartnerIds: string[],
    index: number,
  ): Promise<void> {
    const partnerId = candidatePartnerIds[index];
    if (!partnerId) return;

    logger.info(
      { bookingId: booking._id, partnerId, index },
      "Offering booking to candidate partner",
    );

    const expiresAt = new Date(Date.now() + OFFER_TIMEOUT_SECONDS * 1000).toISOString();

    // Emit offer to partner's private Socket.IO room
    emitOffer(partnerId, {
      bookingId: booking._id,
      customerId: booking.customerId,
      address: booking.address,
      quote: booking.quote,
      slot: booking.slot,
      expiresAt,
      timeoutSeconds: OFFER_TIMEOUT_SECONDS,
    });

    // Schedule 15s timeout delayed job
    try {
      await addOfferTimeoutJob(
        booking._id,
        candidatePartnerIds,
        index,
        OFFER_TIMEOUT_SECONDS * 1000,
      );
    } catch (err) {
      logger.warn({ err, bookingId: booking._id }, "Failed to enqueue BullMQ offer timeout job");
    }
  }

  /**
   * Processes offer expiration: falls through to the next candidate or marks NO_PARTNER.
   */
  public async handleOfferTimeout(
    bookingId: string,
    candidatePartnerIds: string[],
    currentIndex: number,
  ): Promise<void> {
    const booking = await bookingRepo.findById(bookingId);
    if (!booking) return;

    // If booking was already accepted or resolved, ignore timeout
    if (booking.status !== "SEARCHING") {
      logger.debug(
        { bookingId, status: booking.status },
        "Offer timeout triggered but booking is no longer SEARCHING. Ignoring.",
      );
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < candidatePartnerIds.length) {
      logger.info(
        { bookingId, currentIndex, nextIndex },
        "Offer timed out. Falling through to next candidate partner.",
      );
      await this.offerToCandidate(booking, candidatePartnerIds, nextIndex);
    } else {
      logger.warn({ bookingId }, "All candidate partners timed out. Marking NO_PARTNER.");
      await bookingTransitionService.transition({
        bookingId,
        targetStatus: "NO_PARTNER",
        reason: "All candidate partners timed out or declined",
        updatedBy: "system",
      });

      emitStatusChange([booking.customerId], {
        bookingId,
        status: "NO_PARTNER" as BookingStatus,
        message: "No partners accepted your pickup request. Please try again shortly.",
      });
    }
  }

  /**
   * Partner accepts booking using atomic findOneAndUpdate precondition ({ _id, status: SEARCHING }).
   * Guarantees exactly one winning partner under heavy concurrent acceptance attempts.
   * Big-O: O(1) indexed atomic write.
   */
  public async acceptBooking(bookingId: string, partnerId: string): Promise<BookingRecord> {
    const redis = getRedisClient();

    const updated = await BookingModel.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(bookingId),
        status: "SEARCHING",
      },
      {
        $set: {
          status: "ASSIGNED",
          partnerId: new mongoose.Types.ObjectId(partnerId),
        },
        $push: {
          statusHistory: {
            from: "SEARCHING",
            to: "ASSIGNED",
            timestamp: new Date(),
            reason: `Booking accepted by partner '${partnerId}'`,
            updatedBy: partnerId,
          },
        },
      },
      { new: true },
    )
      .lean()
      .exec();

    if (!updated) {
      throw new AppError(
        409,
        "BOOKING_ALREADY_ASSIGNED",
        "Booking has already been accepted by another partner or is no longer available",
      );
    }

    // Set partner busy key in Redis (2 hours TTL)
    await redis.set(`${REDIS_BUSY_KEY_PREFIX}${partnerId}`, bookingId, "EX", 7200);

    const bookingRecord: BookingRecord = {
      _id: updated._id.toString(),
      customerId: updated.customerId.toString(),
      partnerId: updated.partnerId?.toString(),
      items: updated.items.map((it) => ({
        wasteTypeId: it.wasteTypeId.toString(),
        name: it.name,
        category: it.category,
        quantity: it.quantity,
        estimatedWeightKg: it.estimatedWeightKg,
        actualWeightKg: it.actualWeightKg,
        pricePaise: it.pricePaise,
      })),
      address: {
        addressId: updated.address.addressId?.toString(),
        addressLine1: updated.address.addressLine1,
        addressLine2: updated.address.addressLine2,
        city: updated.address.city,
        state: updated.address.state,
        pincode: updated.address.pincode,
        location: updated.address.location,
        buildingId: updated.address.buildingId?.toString(),
      },
      slot: updated.slot,
      quote: updated.quote,
      status: updated.status,
      statusHistory: updated.statusHistory.map((sh) => ({
        from: sh.from,
        to: sh.to,
        timestamp: new Date(sh.timestamp).toISOString(),
        reason: sh.reason,
        updatedBy: sh.updatedBy,
      })),
      pickupOtpHashed: updated.pickupOtpHashed,
      idempotencyKey: updated.idempotencyKey,
      cancelReason: updated.cancelReason,
      cancelledBy: updated.cancelledBy,
      cancellationFeePaise: updated.cancellationFeePaise,
      customerNotes: updated.customerNotes,
      createdAt: new Date(updated.createdAt).toISOString(),
      updatedAt: new Date(updated.updatedAt).toISOString(),
    };

    // Emit Socket.IO assigned event to both customer and partner
    emitAssigned(bookingRecord.customerId, partnerId, {
      bookingId: bookingRecord._id,
      partnerId,
      status: "ASSIGNED",
    });

    // Emit domain event
    bookingEvents.emitEvent(BOOKING_DOMAIN_EVENTS.STATUS_CHANGED, {
      bookingId: bookingRecord._id,
      from: "SEARCHING",
      to: "ASSIGNED",
      reason: `Booking accepted by partner ${partnerId}`,
      updatedBy: partnerId,
      timestamp: new Date().toISOString(),
    });

    return bookingRecord;
  }
}

export const dispatchService = new DispatchService();
