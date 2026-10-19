import { z } from "zod";
import { BOOKING_STATUSES, USER_ROLES, PAGINATION } from "./constants.js";
import { KYC_STATUSES, VEHICLE_TYPES, ADDRESS_LABELS, GEO_CONFIG } from "./geoConstants.js";

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export const userRoleSchema = z.enum(USER_ROLES);

export const kycStatusSchema = z.enum(KYC_STATUSES);

export const vehicleTypeSchema = z.enum(VEHICLE_TYPES);

export const addressLabelSchema = z.enum(ADDRESS_LABELS);

export const paiseSchema = z
  .number({
    required_error: "Amount in paise is required",
    invalid_type_error: "Amount must be an integer paise number",
  })
  .int("Amount must be an integer number of paise")
  .min(0, "Amount in paise cannot be negative");

export const signedPaiseSchema = z.number().int("Amount must be an integer number of paise");

export const mongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a valid 24-character hexadecimal ObjectId");

export const indianPhoneSchema = z
  .string()
  .regex(
    /^\+91[6-9]\d{9}$/,
    "Must be a valid Indian phone number (+91 followed by 10 digits starting with 6-9)",
  );

export const geoCoordinatesSchema = z.tuple([
  z.number().min(-180).max(180), // Longitude
  z.number().min(-90).max(90), // Latitude
]);

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.union([z.array(z.record(z.unknown())), z.record(z.unknown())]).optional(),
  }),
});

export const sendOtpSchema = z.object({
  phone: indianPhoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: indianPhoneSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit number string"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const createWasteTypeSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens"),
  name: z.string().min(2).max(100),
  description: z.string().min(5).max(500),
  basePrice: paiseSchema,
  ratePerKg: paiseSchema,
  commissionRate: z.number().min(0).max(0.5, "Commission rate must be between 0% and 50%"),
  unit: z.string().min(1).default("item"),
  isActive: z.boolean().default(true),
});

export const updateWasteTypeSchema = createWasteTypeSchema.partial();

export const calculateQuoteSchema = z.object({
  items: z
    .array(
      z.object({
        wasteTypeId: z.string().min(1),
        quantity: z.number().int().min(1).default(1),
        weightKg: z.number().min(0).default(0),
      }),
    )
    .min(1, "At least one item is required to compute price"),
  distanceKm: z.number().min(0).default(0),
  enableSurge: z.boolean().optional(),
  surgeMultiplier: z.number().min(1.0).max(2.0).optional(),
});

export const partnerOnboardSchema = z.object({
  name: z.string().min(2).max(100),
  vehicleType: vehicleTypeSchema.default("two_wheeler"),
  serviceRadiusKm: z.number().min(1).max(25).default(10),
  documentType: z.enum(["aadhaar", "pan", "driving_license", "voter_id"]),
  documentNumber: z.string().min(4).max(50),
  documentUrl: z.string().url("Must be a valid secure object storage URL"),
});

export const partnerKycReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(300).optional(),
});

export const partnerStatusToggleSchema = z.object({
  isOnline: z.boolean(),
});

export const partnerLocationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const findNearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce
    .number()
    .min(0.5)
    .max(GEO_CONFIG.MAX_SEARCH_RADIUS_KM)
    .default(GEO_CONFIG.DEFAULT_SEARCH_RADIUS_KM),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(GEO_CONFIG.MAX_SEARCH_LIMIT)
    .default(GEO_CONFIG.DEFAULT_SEARCH_LIMIT),
});

export const createAddressSchema = z.object({
  addressLine1: z.string().min(3).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "Must be a 6-digit Indian PIN code"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  buildingId: mongoIdSchema.optional(),
  label: addressLabelSchema.default("home"),
  isDefault: z.boolean().default(false),
});

export const bookingSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a YYYY-MM-DD date string"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm format"),
  type: z.enum(["asap", "scheduled"]).default("scheduled"),
});

export const createBookingItemSchema = z.object({
  wasteTypeId: z.string().min(1, "wasteTypeId is required"),
  quantity: z.number().int().min(1).default(1),
  estimatedWeightKg: z.number().min(0).default(0),
});

export const createBookingSchema = z.object({
  addressId: mongoIdSchema,
  items: z.array(createBookingItemSchema).min(1, "At least one item is required"),
  slot: bookingSlotSchema,
  customerNotes: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(3).max(300, "Reason must be between 3 and 300 characters"),
});

export const bookingStatusTransitionSchema = z.object({
  status: bookingStatusSchema,
  reason: z.string().max(300).optional(),
});

export const verifyPickupOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "Pickup OTP must be a 6-digit numeric string"),
});

export const customerBookingQuerySchema = cursorPaginationSchema;

export const partnerBookingQuerySchema = cursorPaginationSchema.extend({
  status: bookingStatusSchema.optional(),
});

export const adminBookingQuerySchema = cursorPaginationSchema.extend({
  status: bookingStatusSchema.optional(),
  customerId: mongoIdSchema.optional(),
  partnerId: mongoIdSchema.optional(),
});

export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const searchLocationsQuerySchema = z.object({
  q: z.string().min(1).max(200),
  city: z.string().max(50).optional(),
});

