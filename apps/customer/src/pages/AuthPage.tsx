import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, ArrowRight, RefreshCw, CheckCircle, Leaf, Zap, Copy, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";

const LAST_DEV_OTP_KEY = "sanitary_dev_otp_hint";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isDevMode = (import.meta as any).env?.DEV === true;
const DEFAULT_DEMO_PHONE = isDevMode ? "6374044317" : "";

export const AuthPage: React.FC = () => {
  const { user, isAuthenticated, sendOtpCode, verifyOtpCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [rawPhone, setRawPhone] = useState<string>(DEFAULT_DEMO_PHONE);
  const [otp, setOtp] = useState<string>("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(() => {
    return sessionStorage.getItem(LAST_DEV_OTP_KEY) || null;
  });
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [countdown, setCountdown] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedOtp, setCopiedOtp] = useState<boolean>(false);

  // Return to intended page after auth
  const returnUrl = (location.state as { from?: string })?.from || "/";

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, user, navigate, returnUrl]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const cleaned = rawPhone.replace(/\D/g, "");
    if (cleaned.length !== 10 || !/^[6-9]/.test(cleaned)) {
      setErrorMsg("Please enter a valid 10-digit Indian mobile number starting with 6-9");
      return;
    }

    const formatted = `+91${cleaned}`;
    setIsLoading(true);
    try {
      const res = await sendOtpCode(formatted);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
        sessionStorage.setItem(LAST_DEV_OTP_KEY, res.devOtp);
      } else {
        setDevOtpHint(null);
        sessionStorage.removeItem(LAST_DEV_OTP_KEY);
      }
      setStep("otp");
      setCountdown(30);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to send OTP";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent, overrideCode?: string) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const codeToVerify = overrideCode || otp;
    if (codeToVerify.length !== 6) {
      setErrorMsg("Please enter the 6-digit OTP sent to your phone");
      return;
    }

    const formatted = `+91${rawPhone.replace(/\D/g, "")}`;
    setIsLoading(true);
    try {
      await verifyOtpCode(formatted, codeToVerify);
      navigate(returnUrl, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : isDevMode
            ? "Invalid or expired OTP. You can generate a fresh OTP below or use demo code 123456."
            : "Invalid or expired OTP. Please re-enter the 6-digit code sent to your mobile.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click Auto-Fill & Authorize
  const handleAutoAuthorize = async (code: string) => {
    setOtp(code);
    await handleVerifyOtp(undefined, code);
  };

  // Generate a fresh OTP on demand from OTP screen
  const handleGenerateFreshOtp = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const formatted = `+91${rawPhone.replace(/\D/g, "")}`;
      const res = await sendOtpCode(formatted);
      const code = res.devOtp || "123456";
      setDevOtpHint(code);
      sessionStorage.setItem(LAST_DEV_OTP_KEY, code);
      setCountdown(30);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed to regenerate OTP";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // 1-Click complete demo flow from phone screen
  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const formatted = `+91${rawPhone.replace(/\D/g, "")}`;
      const res = await sendOtpCode(formatted);
      const code = res.devOtp || "123456";
      setDevOtpHint(code);
      sessionStorage.setItem(LAST_DEV_OTP_KEY, code);
      setOtp(code);
      setStep("otp");
      await verifyOtpCode(formatted, code);
      navigate(returnUrl, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "Failed demo login";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyOtp = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };


  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        paddingTop: "24px",
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 14px",
            boxShadow: "0 8px 24px rgba(5, 150, 105, 0.3)",
          }}
        >
          <Leaf size={32} color="#ffffff" />
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: 800, margin: "0 0 6px 0", color: "#0f172a" }}>
          {step === "phone" ? "Enter Mobile Number" : "Verify Phone OTP"}
        </h1>
        <p style={{ fontSize: "14px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
          {step === "phone"
            ? "Log in or sign up to schedule doorstep pickups and track partners in real-time."
            : `Enter the 6-digit code sent to +91 ${rawPhone}`}
        </p>
      </div>

      <div
        className="glass-card"
        style={{
          padding: "24px",
          borderRadius: "20px",
          border: "1px solid rgba(5, 150, 105, 0.22)",
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 253, 250, 0.94) 100%), url('/uber-doorstep-pickup.jpg') center/cover no-repeat",
          boxShadow: "0 16px 40px -4px rgba(15, 23, 42, 0.08)",
        }}
      >
        {errorMsg && (
          <div
            style={{
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: "12px",
              padding: "12px 14px",
              fontSize: "13px",
              color: "#be123c",
              marginBottom: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{ background: "none", border: "none", color: "#be123c", cursor: "pointer", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {step === "phone" ? (
          <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 800, color: "#0f172a" }}>
                Mobile Number
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontWeight: 800,
                    fontSize: "15px",
                    color: "#059669",
                  }}
                >
                  +91
                </span>
                <input
                  type="tel"
                  required
                  autoFocus
                  maxLength={10}
                  className="input-field"
                  placeholder="9876543210"
                  style={{
                    paddingLeft: "52px",
                    fontSize: "16px",
                    fontWeight: 700,
                    background: "#ffffff",
                    borderColor: "#cbd5e1",
                    color: "#0f172a",
                  }}
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || rawPhone.length < 10}
              className="btn btn-primary btn-block"
              style={{
                padding: "14px",
                fontSize: "15px",
                fontWeight: 800,
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
              }}
            >
              {isLoading ? "Generating OTP..." : "Continue"} <ArrowRight size={16} />
            </button>

            {/* Instant 1-Click Demo Login Helper (only shown in development) */}
            {isDevMode && (
              <div
                style={{
                  marginTop: "4px",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "14px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px", fontWeight: 700, textTransform: "uppercase" }}>
                  ⚡ Fast Demo Access (Dev Mode)
                </div>
                <button
                  type="button"
                  onClick={handleQuickDemoLogin}
                  disabled={isLoading}
                  className="btn btn-secondary btn-block"
                  style={{
                    padding: "10px",
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "#047857",
                    borderColor: "#a7f3d0",
                    background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.1)",
                  }}
                >
                  <Zap size={14} color="#059669" /> 1-Click Demo Login (+91 {rawPhone})
                </button>
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={(e) => handleVerifyOtp(e)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Luminous Demo OTP Banner - Only visible when devOtpHint is present (Dev/Staging mode) */}
            {devOtpHint ? (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)",
                  border: "1.5px solid #a7f3d0",
                  boxShadow: "0 4px 16px rgba(5, 150, 105, 0.12)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Zap size={16} color="#059669" />
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Demo Mode OTP Ready
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#059669",
                      background: "#ffffff",
                      border: "1px solid #a7f3d0",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                    }}
                  >
                    Dev Environment
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#ffffff",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Active Test Code:</div>
                    <div style={{ fontSize: "24px", fontWeight: 900, color: "#064e3b", letterSpacing: "4px", fontFamily: "monospace" }}>
                      {devOtpHint}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleCopyOtp(devOtpHint)}
                      title="Copy OTP"
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        color: "#475569",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {copiedOtp ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                      <span>{copiedOtp ? "Copied" : "Copy"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAutoAuthorize(devOtpHint)}
                      disabled={isLoading}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                      }}
                    >
                      <Zap size={14} /> Auto-Fill & Sign In
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "#065f46" }}>
                  <span>💡 Dev test code generated from API</span>
                  <button
                    type="button"
                    onClick={handleGenerateFreshOtp}
                    disabled={isLoading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#059669",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontSize: "11px",
                    }}
                  >
                    Regenerate OTP
                  </button>
                </div>
              </div>
            ) : (
              /* Production Real SMS Delivery Status Card */
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)",
                  border: "1px solid rgba(5, 150, 105, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(5, 150, 105, 0.25)",
                  }}
                >
                  <Shield size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#064e3b" }}>
                    SMS Verification Code Dispatched
                  </div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px", lineHeight: 1.4 }}>
                    We sent a secure 6-digit code to <strong>+91 {rawPhone}</strong> via SMS. It is valid for 5 minutes.
                  </div>
                </div>
              </div>
            )}

            {/* OTP Input Field */}
            <div className="input-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className="input-label" style={{ fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  6-Digit Verification Code
                </label>
                <span style={{ fontSize: "11px", color: otp.length === 6 ? "#059669" : "#64748b", fontWeight: 700 }}>
                  {otp.length}/6 digits entered
                </span>
              </div>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                className="input-field"
                placeholder="• • • • • •"
                style={{
                  fontSize: "26px",
                  letterSpacing: "12px",
                  textAlign: "center",
                  fontWeight: 900,
                  fontFamily: "monospace",
                  background: "#ffffff",
                  borderColor: otp.length === 6 ? "#059669" : "#cbd5e1",
                  color: "#0f172a",
                  boxShadow: otp.length === 6 ? "0 0 0 3px rgba(5, 150, 105, 0.2)" : "none",
                }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </div>

            {/* Verification Button */}
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="btn btn-primary btn-block"
              style={{
                padding: "14px",
                fontSize: "15px",
                fontWeight: 800,
                background:
                  otp.length === 6
                    ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                    : "#94a3b8",
                boxShadow: otp.length === 6 ? "0 4px 16px rgba(5, 150, 105, 0.35)" : "none",
                cursor: otp.length === 6 ? "pointer" : "not-allowed",
              }}
            >
              {isLoading ? "Verifying & Authorizing..." : "Verify & Sign In"}{" "}
              <CheckCircle size={16} />
            </button>

            {/* Sub-actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px",
                paddingTop: "6px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ← Change Number
              </button>

              {countdown > 0 ? (
                <span style={{ color: "#64748b", fontSize: "12px" }}>Resend in {countdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateFreshOtp}
                  disabled={isLoading}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#059669",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontWeight: 700,
                  }}
                >
                  <RefreshCw size={13} /> Resend OTP
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        <Shield size={14} color="#059669" />
        <span>End-to-end encrypted phone authentication. Zero passwords.</span>
      </div>
    </div>
  );
};
