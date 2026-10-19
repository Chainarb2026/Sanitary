import { apiClient } from "./client.js";
import type { PricingBreakdown } from "./wasteTypes.js";

export type BookingStatus =
  | "CREATED"
  | "SEARCHING"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "OTP_VERIFIED"
  | "COLLECTED"
  | "PAID"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_PARTNER";

export interface BookingItem {
  wasteTypeId: string;
  quantity: number;
  estimatedWeightKg?: number;
}

export interface BookingSlot {
  date: string;
  startTime: string;
  endTime: string;
  type: "asap" | "scheduled";
}

export interface Booking {
  _id: string;
  id?: string;
  customerId: string;
  partnerId?: string;
  items: BookingItem[];
  address: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    location: {
      type: "Point";
      coordinates: [number, number]; // [lng, lat]
    };
  };
  slot: BookingSlot;
  quote: PricingBreakdown;
  status: BookingStatus;
  statusHistory: Array<{
    status: BookingStatus;
    timestamp: string;
    reason?: string;
    updatedBy?: string;
  }>;
  pickupOtp?: string;
  actualWeightKg?: number;
  estimationErrorKg?: number;
  cancellationFeePaise?: number;
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingInput {
  addressId: string;
  items: BookingItem[];
  slot: BookingSlot;
  customerNotes?: string;
}

export interface PaginatedBookings {
  items: Booking[];
  nextCursor?: string;
  hasMore: boolean;
}

export async function createBooking(
  data: CreateBookingInput,
  idempotencyKey?: string,
): Promise<Booking> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }
  return apiClient<Booking>("/bookings", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
}

export async function getBookings(cursor?: string, limit = 10): Promise<PaginatedBookings> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  params.set("limit", limit.toString());

  return apiClient<PaginatedBookings>(`/bookings?${params.toString()}`);
}

export async function getBookingById(id: string): Promise<Booking> {
  return apiClient<Booking>(`/bookings/${id}`);
}

export async function cancelBooking(id: string, reason = "Customer request"): Promise<Booking> {
  return apiClient<Booking>(`/bookings/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export interface MatchedPartnerProfile {
  id: string;
  name: string;
  phone: string;
  vehicleModel: string;
  vehicleNumber: string;
  rating: number;
  etaMinutes: number;
  distanceKm: number;
}

export async function matchDemoPartner(
  id: string,
): Promise<{ success: boolean; partner: MatchedPartnerProfile }> {
  return apiClient<{ success: boolean; partner: MatchedPartnerProfile }>(
    `/bookings/${id}/demo-match`,
    {
      method: "POST",
    },
  );
}
