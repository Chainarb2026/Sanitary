import { apiClient } from "./client.js";

export interface PartnerProfile {
  _id: string;
  userId: string;
  phone: string;
  name: string;
  vehicleType: string;
  serviceRadiusKm: number;
  isOnline: boolean;
  isActive: boolean;
  rating?: number;
  acceptanceRate?: number;
  kyc: {
    status: "PENDING" | "APPROVED" | "REJECTED";
    documentType: string;
    documentNumber: string;
    documentUrl?: string;
    rejectionReason?: string;
  };
}

export interface PartnerOnboardInput {
  name: string;
  vehicleType: "two_wheeler" | "three_wheeler" | "light_truck" | "electric_van";
  serviceRadiusKm: number;
  documentType: "aadhaar" | "pan" | "driving_license" | "voter_id";
  documentNumber: string;
  documentUrl: string;
}

export interface PartnerLocationPing {
  latitude: number;
  longitude: number;
}

export interface WalletBalanceResponse {
  balancePaise: number;
  balanceRupees: number;
  currency: string;
}

export async function getPartnerProfile(): Promise<PartnerProfile> {
  return apiClient<PartnerProfile>("/partners/profile");
}

export async function onboardPartner(data: PartnerOnboardInput): Promise<PartnerProfile> {
  return apiClient<PartnerProfile>("/partners/onboard", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function togglePartnerStatus(
  isOnline: boolean,
): Promise<{ success: boolean; isOnline: boolean }> {
  return apiClient<{ success: boolean; isOnline: boolean }>("/partners/status", {
    method: "POST",
    body: JSON.stringify({ isOnline }),
  });
}

export async function pingPartnerLocation(
  coords: PartnerLocationPing,
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>("/partners/location", {
    method: "POST",
    body: JSON.stringify(coords),
  });
}

export async function getPartnerWalletBalance(): Promise<WalletBalanceResponse> {
  return apiClient<WalletBalanceResponse>("/wallet/balance");
}

export async function acceptBookingOffer(bookingId: string): Promise<any> {
  return apiClient(`/bookings/${bookingId}/accept`, {
    method: "POST",
  });
}

export async function transitionBookingStatus(
  bookingId: string,
  status: string,
  reason?: string,
): Promise<any> {
  return apiClient(`/bookings/${bookingId}/transition`, {
    method: "POST",
    body: JSON.stringify({ status, reason: reason || `Partner status update to ${status}` }),
  });
}

export async function verifyPickupOtp(bookingId: string, otp: string): Promise<any> {
  return apiClient(`/bookings/${bookingId}/verify-otp`, {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export async function getActivePartnerBookings(): Promise<{ items: any[] }> {
  try {
    return await apiClient<{ items: any[] }>("/bookings/partner");
  } catch {
    return { items: [] };
  }
}
