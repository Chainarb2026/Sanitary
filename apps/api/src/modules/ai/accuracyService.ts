import { BookingModel, type IBooking } from "../bookings/model.js";
import { NotFoundError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface RecordWeightParams {
  bookingId: string;
  actualWeightKg: number;
  partnerLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface AccuracyMetricsResult {
  totalEvaluatedSamples: number;
  meanAbsoluteErrorKg: number;
  meanAbsolutePercentageError: number;
  accuracyWithin20PercentRate: number;
  fraudFlagBreakdown: Record<string, number>;
}

export class AiAccuracyService {
  /**
   * Stores actual weight collected by partner, computes estimation error,
   * and runs rule-based fraud detection algorithms (z-score, GPS, cancellation rate).
   */
  public async recordActualWeightAndEvaluateFraud(params: RecordWeightParams): Promise<IBooking> {
    const { bookingId, actualWeightKg, partnerLocation } = params;

    const booking = await BookingModel.findById(bookingId).exec();
    if (!booking) {
      throw new NotFoundError(`Booking not found: '${bookingId}'`);
    }

    // 1. Compute total estimated weight
    const totalEstimatedWeight = booking.items.reduce(
      (sum, it) => sum + (it.estimatedWeightKg ?? 0),
      0,
    );

    // 2. Compute absolute and percentage estimation error
    const estimationErrorKg = Math.abs(actualWeightKg - totalEstimatedWeight);
    const estimationErrorPercent =
      totalEstimatedWeight > 0 ? (estimationErrorKg / totalEstimatedWeight) * 100 : 0;

    // 3. Rule-Based Fraud Detection
    const fraudFlags: string[] = [];

    // Rule A: Weight discrepancy z-score rule (baseline sigma = 3.0 kg or 25% of estimate)
    const sigma = Math.max(3.0, totalEstimatedWeight * 0.25);
    const zScore = estimationErrorKg / sigma;

    if (zScore >= 3.0) {
      fraudFlags.push("WEIGHT_MISMATCH");
      logger.warn(
        { bookingId, actualWeightKg, totalEstimatedWeight, zScore },
        "Fraud flag triggered: WEIGHT_MISMATCH (z-score >= 3.0)",
      );
    }

    // Rule B: GPS coordinate mismatch rule (> 500m from pickup address)
    if (partnerLocation) {
      const [pickupLng, pickupLat] = booking.address.location.coordinates;
      const distanceKm = haversineDistanceKm(
        partnerLocation.latitude,
        partnerLocation.longitude,
        pickupLat,
        pickupLng,
      );

      if (distanceKm > 0.5) {
        fraudFlags.push("GPS_MISMATCH");
        logger.warn(
          { bookingId, distanceKm, thresholdKm: 0.5 },
          "Fraud flag triggered: GPS_MISMATCH (> 500m from pickup address)",
        );
      }
    }

    // Rule C: Cancellation rate rule (> 20% cancellation rate in user history)
    const userBookings = await BookingModel.find({ customerId: booking.customerId })
      .select("status")
      .lean()
      .exec();

    if (userBookings.length >= 5) {
      const cancelledCount = userBookings.filter((b) => b.status === "CANCELLED").length;
      const cancelRate = cancelledCount / userBookings.length;

      if (cancelRate > 0.2) {
        fraudFlags.push("HIGH_CANCELLATION_RISK");
        logger.warn(
          { bookingId, customerId: booking.customerId, cancelRate },
          "Fraud flag triggered: HIGH_CANCELLATION_RISK (> 20% cancellation rate)",
        );
      }
    }

    const fraudScore = fraudFlags.length * 10;

    // 4. Update booking record
    booking.actualWeightKg = actualWeightKg;
    booking.estimationErrorKg = Math.round(estimationErrorKg * 100) / 100;
    booking.estimationErrorPercent = Math.round(estimationErrorPercent * 100) / 100;
    booking.fraudFlags = fraudFlags;
    booking.fraudScore = fraudScore;

    // If booking was ARRIVED or OTP_VERIFIED, advance to COLLECTED
    if (booking.status === "OTP_VERIFIED" || booking.status === "ARRIVED") {
      booking.status = "COLLECTED";
      booking.statusHistory.push({
        from: booking.status,
        to: "COLLECTED",
        timestamp: new Date(),
        reason: `Weight recorded: ${actualWeightKg} kg`,
        updatedBy: booking.partnerId?.toString() ?? "partner",
      });
    }

    await booking.save();
    return booking;
  }

  /**
   * Computes AI accuracy metrics across all evaluated bookings.
   */
  public async getAccuracyMetrics(): Promise<AccuracyMetricsResult> {
    const evaluatedBookings = await BookingModel.find({
      actualWeightKg: { $ne: null },
      estimationErrorKg: { $ne: null },
    })
      .select("actualWeightKg estimationErrorKg estimationErrorPercent fraudFlags")
      .lean()
      .exec();

    if (evaluatedBookings.length === 0) {
      return {
        totalEvaluatedSamples: 0,
        meanAbsoluteErrorKg: 0,
        meanAbsolutePercentageError: 0,
        accuracyWithin20PercentRate: 0,
        fraudFlagBreakdown: {},
      };
    }

    let totalErrorKg = 0;
    let totalErrorPercent = 0;
    let within20PercentCount = 0;
    const fraudBreakdown: Record<string, number> = {};

    for (const b of evaluatedBookings) {
      const errorKg = b.estimationErrorKg ?? 0;
      const errorPercent = b.estimationErrorPercent ?? 0;

      totalErrorKg += errorKg;
      totalErrorPercent += errorPercent;

      if (errorPercent <= 20) {
        within20PercentCount++;
      }

      if (b.fraudFlags) {
        for (const flag of b.fraudFlags) {
          fraudBreakdown[flag] = (fraudBreakdown[flag] ?? 0) + 1;
        }
      }
    }

    const count = evaluatedBookings.length;

    return {
      totalEvaluatedSamples: count,
      meanAbsoluteErrorKg: Math.round((totalErrorKg / count) * 100) / 100,
      meanAbsolutePercentageError: Math.round((totalErrorPercent / count) * 100) / 100,
      accuracyWithin20PercentRate: Math.round((within20PercentCount / count) * 10000) / 100, // percentage e.g. 85.5%
      fraudFlagBreakdown: fraudBreakdown,
    };
  }
}

export const aiAccuracyService = new AiAccuracyService();
