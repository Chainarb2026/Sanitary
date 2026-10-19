import type { BOOKING_STATUSES, USER_ROLES, ERROR_CODES } from "./constants.js";
import type { KYC_STATUSES, VEHICLE_TYPES, ADDRESS_LABELS } from "./geoConstants.js";

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type UserRole = (typeof USER_ROLES)[number];

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | string;

export type KycStatus = (typeof KYC_STATUSES)[number];

export type VehicleType = (typeof VEHICLE_TYPES)[number];

export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export interface ApiErrorDetail {
  field?: string;
  message: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[] | Record<string, unknown> | unknown[];
  };
}

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type Paise = number;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  name?: string;
  isActive: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  phone: string;
  exp: number;
  iat: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  familyId: string;
  exp: number;
  iat: number;
}

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface NearbyPartner {
  partnerId: string;
  distanceKm: number;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface PartnerKycDoc {
  documentType: string;
  documentNumber: string;
  documentUrl: string;
  status: KycStatus;
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface BookingItem {
  wasteTypeId: string;
  name: string;
  category: string;
  quantity: number;
  estimatedWeightKg?: number;
  actualWeightKg?: number;
  pricePaise: Paise;
}

export interface BookingAddressSnapshot {
  addressId?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  location: GeoPoint;
  buildingId?: string;
}

export interface BookingSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: "asap" | "scheduled";
}

export interface BookingQuoteBreakdown {
  base: Paise;
  perKg: Paise;
  convenienceFee: Paise;
  surgeMultiplier: number;
  total: Paise;
  partnerEarning: Paise;
  platformCommission: Paise;
}

export interface BookingStatusHistoryEntry {
  from: BookingStatus;
  to: BookingStatus;
  timestamp: string;
  reason?: string;
  updatedBy: string;
}

export interface BookingRecord {
  _id: string;
  customerId: string;
  partnerId?: string;
  items: BookingItem[];
  address: BookingAddressSnapshot;
  slot: BookingSlot;
  quote: BookingQuoteBreakdown;
  status: BookingStatus;
  statusHistory: BookingStatusHistoryEntry[];
  pickupOtp?: string; // Only present in customer creation / view
  pickupOtpHashed: string;
  idempotencyKey?: string;
  cancelReason?: string;
  cancelledBy?: "customer" | "partner" | "admin" | "system";
  cancellationFeePaise?: Paise;
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingCreatedEvent {
  bookingId: string;
  customerId: string;
  address: BookingAddressSnapshot;
  quote: BookingQuoteBreakdown;
  slot: BookingSlot;
  createdAt: string;
}

export interface BookingStatusChangedEvent {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  reason?: string;
  updatedBy: string;
  timestamp: string;
}

export interface BookingCancelledEvent {
  bookingId: string;
  customerId: string;
  reason: string;
  cancelledBy: "customer" | "partner" | "admin" | "system";
  cancellationFeePaise: Paise;
  timestamp: string;
}
