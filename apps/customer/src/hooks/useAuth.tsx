import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  type UserProfile,
  getMe,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
  logout as apiLogout,
} from "../api/auth.js";
import { getStoredAccessToken } from "../api/client.js";

// Module-level singleton: prevents parallel /auth/me calls when multiple components mount simultaneously
let profilePromise: Promise<{ user: UserProfile }> | null = null;

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sendOtpCode: (phone: string) => Promise<{ success: boolean; devOtp?: string }>;
  verifyOtpCode: (phone: string, otp: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const defaultAuthValue: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  sendOtpCode: async () => ({ success: false }),
  verifyOtpCode: async () => {},
  logoutUser: async () => {},
  refreshProfile: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthValue);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshProfile = useCallback(async () => {
    const token = getStoredAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      profilePromise = null;
      return;
    }

    // Reuse any in-flight request to avoid N parallel calls from N simultaneous mounts
    if (!profilePromise) {
      profilePromise = getMe();
    }

    try {
      const res = await profilePromise;
      setUser(res.user);
    } catch {
      setUser(null);
      profilePromise = null; // Reset so next call tries fresh
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const sendOtpCode = useCallback(async (phone: string): Promise<{ success: boolean; devOtp?: string }> => {
    const res = await apiSendOtp(phone);
    return { success: res.success, devOtp: res.devOtp };
  }, []);

  const verifyOtpCode = useCallback(async (phone: string, otp: string): Promise<void> => {
    const res = await apiVerifyOtp(phone, otp);
    setUser(res.user);
  }, []);

  const logoutUser = useCallback(async (): Promise<void> => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        sendOtpCode,
        verifyOtpCode,
        logoutUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  return context || defaultAuthValue;
}
