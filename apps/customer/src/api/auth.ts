import { apiClient, setStoredTokens, clearStoredTokens } from "./client.js";

export interface UserProfile {
  id: string;
  phone: string;
  role: "customer" | "partner" | "admin";
  name?: string;
  email?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

export async function sendOtp(phone: string): Promise<{ success: boolean; message: string; devOtp?: string }> {
  return apiClient<{ success: boolean; message: string; devOtp?: string }>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, otp: string): Promise<AuthResponse> {
  const result = await apiClient<any>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp }),
  });
  const accessToken = result.accessToken || result.tokens?.accessToken;
  const refreshToken = result.refreshToken || result.tokens?.refreshToken;
  setStoredTokens(accessToken, refreshToken);
  return {
    user: result.user,
    accessToken,
    refreshToken,
    tokens: result.tokens,
  };
}

export async function getMe(): Promise<{ user: UserProfile }> {
  return apiClient<{ user: UserProfile }>("/auth/me");
}

export async function logout(): Promise<void> {
  try {
    await apiClient("/auth/logout", { method: "POST" });
  } finally {
    clearStoredTokens();
  }
}
