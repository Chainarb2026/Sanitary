import type { Request, Response } from "express";
import mongoose from "mongoose";
import {
  createBookingSchema,
  cancelBookingSchema,
  bookingStatusTransitionSchema,
  verifyPickupOtpSchema,
  customerBookingQuerySchema,
  partnerBookingQuerySchema,
  adminBookingQuerySchema,
} from "@sanitary/shared";
import { BookingModel } from "./model.js";
import { PartnerModel } from "../partners/model.js";
import { emitAssigned, emitStatusChange } from "../../infra/socket.js";
import { bookingService } from "./service.js";
import { bookingTransitionService } from "./transitionService.js";
import { dispatchService } from "../dispatch/service.js";
import { config } from "../../infra/config.js";

export class BookingController {
  public async create(req: Request, res: Response): Promise<void> {
    const validated = createBookingSchema.parse(req.body);
    const idempotencyKey =
      (req.headers["idempotency-key"] as string | undefined) ??
      (req.headers["x-idempotency-key"] as string | undefined);

    const { booking, isReplay } = await bookingService.createBooking({
      customerId: req.user!.userId,
      addressId: validated.addressId,
      items: validated.items,
      slot: validated.slot,
      idempotencyKey,
      customerNotes: validated.customerNotes,
    });

    if (isReplay) {
      res.setHeader("X-Idempotent-Replay", "true");
      res.status(200).json(booking);
      return;
    }

    res.status(201).json(booking);
  }

  public async getById(req: Request, res: Response): Promise<void> {
    const booking = await bookingService.getBookingById(
      req.params.id as string,
      req.user!.userId,
      req.user!.role,
    );
    res.status(200).json(booking);
  }

  public async cancel(req: Request, res: Response): Promise<void> {
    const validated = cancelBookingSchema.parse(req.body);
    const updated = await bookingService.cancelByCustomer(
      req.params.id as string,
      req.user!.userId,
      validated.reason,
    );
    res.status(200).json(updated);
  }

  public async verifyOtp(req: Request, res: Response): Promise<void> {
    const validated = verifyPickupOtpSchema.parse(req.body);
    const updated = await bookingService.verifyOtp(
      req.params.id as string,
      req.user!.userId,
      validated.otp,
    );
    res.status(200).json(updated);
  }

  public async accept(req: Request, res: Response): Promise<void> {
    const updated = await dispatchService.acceptBooking(req.params.id as string, req.user!.userId);
    res.status(200).json(updated);
  }

  public async transition(req: Request, res: Response): Promise<void> {
    const validated = bookingStatusTransitionSchema.parse(req.body);
    const updated = await bookingTransitionService.transition({
      bookingId: req.params.id as string,
      targetStatus: validated.status,
      reason: validated.reason,
      updatedBy: req.user!.userId,
    });
    res.status(200).json(updated);
  }

  public async getCustomerBookings(req: Request, res: Response): Promise<void> {
    const query = customerBookingQuerySchema.parse(req.query);
    const result = await bookingService.getCustomerBookings(
      req.user!.userId,
      query.cursor,
      query.limit,
    );
    res.status(200).json(result);
  }

  public async getPartnerBookings(req: Request, res: Response): Promise<void> {
    const query = partnerBookingQuerySchema.parse(req.query);
    const result = await bookingService.getPartnerBookings(
      req.user!.userId,
      query.status,
      query.cursor,
      query.limit,
    );
    res.status(200).json(result);
  }

  public async getAdminBookings(req: Request, res: Response): Promise<void> {
    const query = adminBookingQuerySchema.parse(req.query);
    const result = await bookingService.getAdminBookings(
      {
        status: query.status,
        customerId: query.customerId,
        partnerId: query.partnerId,
      },
      query.cursor,
      query.limit,
    );
    res.status(200).json(result);
  }

  public async demoMatchPartner(req: Request, res: Response): Promise<void> {
    if (config.NODE_ENV === "production") {
      res.status(403).json({ error: "Demo partner matching is disabled in production environments" });
      return;
    }

    const bookingId = req.params.id as string;
    const booking = await BookingModel.findById(bookingId).exec();
    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    // Find any active approved partner, or upsert demo partner Ramesh Kumar
    let partner = await PartnerModel.findOne({ isActive: true }).exec();
    if (!partner) {
      partner = await PartnerModel.findOneAndUpdate(
        { phone: "+919845012345" },
        {
          $setOnInsert: {
            userId: new mongoose.Types.ObjectId(),
            phone: "+919845012345",
            name: "Ramesh Kumar",
            vehicleType: "tata_ace_ev",
            serviceRadiusKm: 10,
            isOnline: true,
            isActive: true,
            rating: 4.9,
            acceptanceRate: 0.98,
            kyc: {
              documentType: "AADHAAR",
              documentNumber: "123456789012",
              documentUrl: "https://sanitary.eco/kyc.jpg",
              status: "APPROVED",
              submittedAt: new Date(),
            },
          },
        },
        { upsert: true, new: true },
      ).exec();
    }

    if (!partner) {
      res.status(500).json({ error: "Failed to initialize partner" });
      return;
    }

    // Assign partner to booking
    booking.partnerId = partner._id;
    booking.status = "ASSIGNED";
    booking.statusHistory.push({
      from: "SEARCHING",
      to: "ASSIGNED",
      timestamp: new Date(),
      reason: "Verified partner Ramesh Kumar matched nearby in sector",
      updatedBy: partner._id.toString(),
    });
    await booking.save();

    // Emit Socket.IO assignment event
    emitAssigned(booking.customerId.toString(), partner._id.toString(), {
      bookingId: booking._id.toString(),
      partnerId: partner._id.toString(),
      partnerName: partner.name || "Ramesh Kumar",
      partnerPhone: partner.phone,
      vehicleModel: "Tata Ace EV (100% Electric)",
      vehicleNumber: "KA-01-EA-4821",
      rating: partner.rating || 4.9,
    });

    emitStatusChange([booking.customerId.toString(), partner._id.toString()], {
      bookingId: booking._id.toString(),
      status: "ASSIGNED",
      message: `Partner ${partner.name || "Ramesh Kumar"} assigned to your doorstep pickup.`,
    });

    res.status(200).json({
      success: true,
      bookingId: booking._id.toString(),
      partner: {
        id: partner._id.toString(),
        name: partner.name || "Ramesh Kumar",
        phone: partner.phone,
        vehicleModel: "Tata Ace EV (100% Electric)",
        vehicleNumber: "KA-01-EA-4821",
        rating: 4.9,
        etaMinutes: 6,
        distanceKm: 1.4,
      },
    });
  }
}

export const bookingController = new BookingController();
