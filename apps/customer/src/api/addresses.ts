import { apiClient } from "./client.js";

export interface Address {
  _id: string;
  userId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  label: "home" | "work" | "other";
  isDefault: boolean;
  createdAt: string;
}

export interface CreateAddressInput {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  buildingId?: string;
  label?: "home" | "work" | "other";
  isDefault?: boolean;
}

export async function getAddresses(): Promise<{ addresses: Address[] }> {
  return apiClient<{ addresses: Address[] }>("/addresses");
}

export async function createAddress(data: CreateAddressInput): Promise<Address> {
  return apiClient<Address>("/addresses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteAddress(id: string): Promise<void> {
  return apiClient<void>(`/addresses/${id}`, {
    method: "DELETE",
  });
}
