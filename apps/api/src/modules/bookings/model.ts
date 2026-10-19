import mongoose, { Schema, Document } from "mongoose";
import { BOOKING_STATUSES, type BookingStatus, type Paise } from "@sanitary/shared";

export interface IBookingItem {
  wasteTypeId: mongoose.Types.ObjectId;
  name: string;
  category: string;
  quantity: number;
  estimatedWeightKg?: number;
  actualWeightKg?: number;
  pricePaise: Paise;
}

export interface IBookingAddress {
  addressId?: mongoose.Types.ObjectId;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  buildingId?: mongoose.Types.ObjectId;
}

export interface IBookingSlot {
  date: string;
  startTime: string;
  endTime: string;
  type: "asap" | "scheduled";
}

export interface IBookingQuote {
  base: Paise;
  perKg: Paise;
  convenienceFee: Paise;
  surgeMultiplier: number;
  total: Paise;
  partnerEarning: Paise;
  platformCommission: Paise;
}

export interface IBookingStatusHistory {
  from: BookingStatus;
  to: BookingStatus;
  timestamp: Date;
  reason?: string;
  updatedBy: string;
}

export interface IBooking extends Document {
  customerId: mongoose.Types.ObjectId;
  partnerId?: mongoose.Types.ObjectId;
  items: IBookingItem[];
  address: IBookingAddress;
  slot: IBookingSlot;
  quote: IBookingQuote;
  status: BookingStatus;
  statusHistory: IBookingStatusHistory[];
  pickupOtpHashed: string;
  idempotencyKey?: string;
  cancelReason?: string;
  cancelledBy?: "customer" | "partner" | "admin" | "system";
  cancellationFeePaise?: Paise;
  customerNotes?: string;
  actualWeightKg?: number;
  estimationErrorKg?: number;
  estimationErrorPercent?: number;
  fraudFlags?: string[];
  fraudScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookingItemSchema = new Schema<IBookingItem>(
  {
    wasteTypeId: { type: Schema.Types.ObjectId, ref: "WasteType", required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    estimatedWeightKg: { type: Number, default: 0 },
    actualWeightKg: { type: Number },
    pricePaise: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingAddressSchema = new Schema<IBookingAddress>(
  {
    addressId: { type: Schema.Types.ObjectId, ref: "Address" },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    buildingId: { type: Schema.Types.ObjectId, ref: "Building" },
  },
  { _id: false },
);

const bookingSlotSchema = new Schema<IBookingSlot>(
  {
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    type: { type: String, enum: ["asap", "scheduled"], default: "scheduled", required: true },
  },
  { _id: false },
);

const bookingQuoteSchema = new Schema<IBookingQuote>(
  {
    base: { type: Number, required: true, min: 0 },
    perKg: { type: Number, required: true, min: 0 },
    convenienceFee: { type: Number, required: true, min: 0 },
    surgeMultiplier: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 0 },
    partnerEarning: { type: Number, required: true, min: 0 },
    platformCommission: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingStatusHistorySchema = new Schema<IBookingStatusHistory>(
  {
    from: { type: String, enum: BOOKING_STATUSES, required: true },
    to: { type: String, enum: BOOKING_STATUSES, required: true },
    timestamp: { type: Date, default: Date.now, required: true },
    reason: { type: String },
    updatedBy: { type: String, required: true },
  },
  { _id: false },
);

const bookingSchema = new Schema<IBooking>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      default: undefined,
    },
    items: {
      type: [bookingItemSchema],
      required: true,
      validate: [(val: unknown[]) => val.length > 0, "Booking must have at least one item"],
    },
    address: {
      type: bookingAddressSchema,
      required: true,
    },
    slot: {
      type: bookingSlotSchema,
      required: true,
    },
    quote: {
      type: bookingQuoteSchema,
      required: true,
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "CREATED",
      required: true,
    },
    statusHistory: {
      type: [bookingStatusHistorySchema],
      default: [],
      required: true,
    },
    pickupOtpHashed: {
      type: String,
      required: true,
    },
    idempotencyKey: {
      type: String,
    },
    cancelReason: {
      type: String,
    },
    cancelledBy: {
      type: String,
      enum: ["customer", "partner", "admin", "system"],
    },
    cancellationFeePaise: {
      type: Number,
      default: 0,
    },
    customerNotes: {
      type: String,
    },
    actualWeightKg: {
      type: Number,
    },
    estimationErrorKg: {
      type: Number,
    },
    estimationErrorPercent: {
      type: Number,
    },
    fraudFlags: {
      type: [String],
      default: [],
    },
    fraudScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Index 1: Customer list queries sorted chronologically by creation timestamp
bookingSchema.index({ customerId: 1, createdAt: -1 });

// Index 2: Partner active and historical job queries filtered by status and sorted by date
bookingSchema.index({ partnerId: 1, status: 1, createdAt: -1 });

// Index 3: Unique compound index preventing duplicate booking creation per customer with identical idempotency keys
bookingSchema.index(
  { customerId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);

// Index 4: Partial 2dsphere spatial index on active bookings only, keeping index compact in RAM
bookingSchema.index(
  { "address.location": "2dsphere" },
  {
    partialFilterExpression: {
      status: { $in: ["CREATED", "SEARCHING", "ASSIGNED", "EN_ROUTE", "ARRIVED"] },
    },
  },
);

// Index 5: Keyset cursor sorting index across all collections for administrative retrieval
bookingSchema.index({ createdAt: -1, _id: -1 });

export const BookingModel = mongoose.model<IBooking>("Booking", bookingSchema);
