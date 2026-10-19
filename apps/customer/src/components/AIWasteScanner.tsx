import React, { useState, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Layers,
} from "lucide-react";
import { useImageCompression } from "../hooks/useImageCompression.js";
import {
  presignUpload,
  uploadBinary,
  estimateWaste,
  type AiWasteEstimate,
  type AiEstimateResponse,
} from "../api/ai.js";
import { type WasteType, type PricingBreakdown } from "../api/wasteTypes.js";

interface AIWasteScannerProps {
  wasteTypes: WasteType[];
  onEstimateSuccess: (data: {
    items: Array<{ wasteTypeId: string; quantity: number; estimatedWeightKg: number }>;
    quote?: PricingBreakdown;
    estimate?: AiWasteEstimate;
    imageUrl?: string;
  }) => void;
}

export const AIWasteScanner: React.FC<AIWasteScannerProps> = ({
  wasteTypes,
  onEstimateSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { compressImage } = useImageCompression();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>("");
  const [estimateResult, setEstimateResult] = useState<AiEstimateResponse | null>(null);

  // Manual fallback selection state
  const [manualWasteTypeId, setManualWasteTypeId] = useState<string>(wasteTypes[0]?._id || "");
  const [manualQuantity, setManualQuantity] = useState<number>(1);
  const [manualWeightKg, setManualWeightKg] = useState<number>(5);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setScanStatus("Compressing photo on device...");
        const compressed = await compressImage(file, 1280, 0.75);
        setPreviewUrl(compressed.previewUrl);
        setIsScanning(true);

        // Step 1: Request direct presigned URL from backend
        setScanStatus("Acquiring secure upload token...");
        const presigned = await presignUpload(file.name, compressed.blob.type);

        // Step 2: Direct binary upload to object storage endpoint
        setScanStatus("Uploading compressed image directly...");
        await uploadBinary(presigned.uploadUrl, compressed.blob);
        setUploadedImageUrl(presigned.downloadUrl);

        // Step 3: Run AI vision waste estimation with instant quote computation
        setScanStatus("Gemini Vision AI analyzing waste volume & class...");
        const res = await estimateWaste(presigned.downloadUrl);
        setEstimateResult(res);
        setIsScanning(false);

        if (!res.fallback && res.estimate) {
          // Map AI items to known waste types
          const matchedTypeId =
            wasteTypes.find(
              (w) =>
                w.slug.toLowerCase().includes(res.estimate?.wasteType.toLowerCase() || "") ||
                w.name.toLowerCase().includes(res.estimate?.wasteType.toLowerCase() || ""),
            )?._id ||
            wasteTypes[0]?._id ||
            "";

          onEstimateSuccess({
            items: [
              {
                wasteTypeId: matchedTypeId,
                quantity: Math.max(1, res.estimate.items.length),
                estimatedWeightKg: res.estimate.estimatedWeightKg,
              },
            ],
            quote: res.quote,
            estimate: res.estimate,
            imageUrl: presigned.downloadUrl,
          });
        }
      } catch {
        setIsScanning(false);
        setEstimateResult({ fallback: true });
        setScanStatus("Estimation fallback triggered");
      }
    },
    [compressImage, wasteTypes, onEstimateSuccess],
  );

  const handleManualConfirm = () => {
    onEstimateSuccess({
      items: [
        {
          wasteTypeId: manualWasteTypeId || wasteTypes[0]?._id || "",
          quantity: manualQuantity,
          estimatedWeightKg: manualWeightKg,
        },
      ],
      imageUrl: uploadedImageUrl || undefined,
    });
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    setEstimateResult(null);
    setScanStatus("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="glass-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => void handleFileChange(e)}
      />

      {/* Initial Capture Trigger View */}
      {!previewUrl && (
        <div style={{ textAlign: "center", padding: "16px 8px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              background: "rgba(20, 184, 166, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              color: "var(--color-teal)",
              boxShadow: "0 0 24px rgba(20, 184, 166, 0.2)",
            }}
          >
            <Camera size={30} />
          </div>

          <h3 style={{ fontSize: "17px", marginBottom: "6px" }}>Snap a Waste Photo</h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "18px" }}>
            Our Gemini AI scans volume, item categories, and weight to generate an instant
            transparent quote.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={18} /> Camera
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={18} /> Upload Photo
            </button>
          </div>
        </div>
      )}

      {/* Photo Preview & Live Scanning State */}
      {previewUrl && (
        <div>
          <div className="scanner-box" style={{ height: "220px", background: "#050b14" }}>
            <img
              src={previewUrl}
              alt="Waste preview"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isScanning ? "brightness(0.7) contrast(1.1)" : "none",
              }}
            />

            {/* Glowing Scanning Beam */}
            {isScanning && <div className="scanner-beam" />}

            {/* Overlay status text */}
            {isScanning && (
              <div
                style={{
                  position: "absolute",
                  bottom: "12px",
                  left: "12px",
                  right: "12px",
                  background: "rgba(10, 15, 29, 0.85)",
                  backdropFilter: "blur(10px)",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                <Sparkles size={16} color="var(--color-teal)" className="pulse" />
                <span>{scanStatus}</span>
              </div>
            )}
          </div>

          {/* Post-Scan Results & Analysis */}
          {!isScanning && estimateResult && (
            <div style={{ marginTop: "16px" }}>
              {/* High Confidence AI Result */}
              {!estimateResult.fallback && estimateResult.estimate && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid var(--border-subtle)",
                      paddingBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <CheckCircle size={18} color="var(--color-brand)" />
                      <span style={{ fontWeight: 700, fontSize: "15px" }}>
                        AI Waste Classification
                      </span>
                    </div>
                    <span className="badge badge-emerald">
                      {Math.round(estimateResult.estimate.confidence * 100)}% Confident
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        padding: "10px",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <span
                        style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}
                      >
                        Waste Category
                      </span>
                      <strong style={{ fontSize: "14px", textTransform: "capitalize" }}>
                        {estimateResult.estimate.wasteType.replace("_", " ")}
                      </strong>
                    </div>

                    <div
                      style={{
                        background: "rgba(255, 255, 255, 0.04)",
                        padding: "10px",
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <span
                        style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}
                      >
                        Estimated Weight
                      </span>
                      <strong style={{ fontSize: "14px", color: "var(--color-teal)" }}>
                        ~{estimateResult.estimate.estimatedWeightKg} kg (
                        {estimateResult.estimate.volumeClass})
                      </strong>
                    </div>
                  </div>

                  {estimateResult.estimate.hazardous && (
                    <div
                      style={{
                        background: "rgba(244, 63, 94, 0.12)",
                        border: "1px solid rgba(244, 63, 94, 0.3)",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "#fb7185",
                        fontWeight: 600,
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>Special handling: Hazardous materials detected.</span>
                    </div>
                  )}

                  {/* Items detected */}
                  <div>
                    <span
                      style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}
                    >
                      Detected Items ({estimateResult.estimate.items.length}):
                    </span>
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}
                    >
                      {estimateResult.estimate.items.map((it, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: "rgba(20, 184, 166, 0.12)",
                            border: "1px solid rgba(20, 184, 166, 0.25)",
                            borderRadius: "var(--radius-full)",
                            padding: "3px 10px",
                            fontSize: "12px",
                            color: "var(--color-teal)",
                            fontWeight: 500,
                          }}
                        >
                          {it.name} (x{it.quantity})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback Mode (Low Confidence < 0.6 or Provider Disruption) */}
              {estimateResult.fallback && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid rgba(245, 158, 11, 0.3)",
                      borderRadius: "var(--radius-md)",
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#fbbf24",
                    }}
                  >
                    <AlertTriangle size={18} flex-shrink={0} />
                    <span>
                      Confidence below threshold. Please confirm your waste category below:
                    </span>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Select Waste Category</label>
                    <select
                      className="input-field"
                      value={manualWasteTypeId}
                      onChange={(e) => setManualWasteTypeId(e.target.value)}
                    >
                      {wasteTypes.map((wt) => (
                        <option key={wt._id} value={wt._id}>
                          {wt.name} (₹{(wt.basePrice / 100).toFixed(0)} base + ₹
                          {(wt.ratePerKg / 100).toFixed(0)}/kg)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Bag / Load Size Presets */}
                  <div>
                    <label
                      className="input-label"
                      style={{ marginBottom: "6px", display: "block" }}
                    >
                      Estimated Load Size (No scale needed)
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      {[
                        { label: "Small Bag", weight: 5, hint: "Kitchen / bin (<5kg)" },
                        { label: "Medium Sack", weight: 12, hint: "Box / sack (5-15kg)" },
                        { label: "Heavy Sack", weight: 25, hint: "Gunny bag (15-30kg)" },
                        { label: "Bulk / Large", weight: 50, hint: "Furniture / debris (>30kg)" },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setManualWeightKg(preset.weight)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "var(--radius-md)",
                            border:
                              manualWeightKg === preset.weight
                                ? "1px solid var(--color-teal)"
                                : "1px solid var(--border-subtle)",
                            background:
                              manualWeightKg === preset.weight
                                ? "rgba(20, 184, 166, 0.15)"
                                : "rgba(255, 255, 255, 0.03)",
                            color:
                              manualWeightKg === preset.weight
                                ? "#ffffff"
                                : "var(--text-secondary)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{ fontSize: "12px", fontWeight: 700 }}>{preset.label}</div>
                          <div
                            style={{
                              fontSize: "10px",
                              color: "var(--text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            {preset.hint}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="input-group">
                      <label className="input-label">Number of Items/Bags</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        className="input-field"
                        value={manualQuantity}
                        onChange={(e) => setManualQuantity(Number(e.target.value))}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Est. Weight (kg)</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        className="input-field"
                        value={manualWeightKg}
                        onChange={(e) => setManualWeightKg(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <p style={{ fontSize: "11px", color: "var(--text-muted)", margin: "0" }}>
                    💡 Sanitary partner carries certified digital scales. Final fare adjusts
                    seamlessly with zero penalties.
                  </p>

                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={handleManualConfirm}
                  >
                    <Layers size={16} /> Confirm Manual Details
                  </button>
                </div>
              )}

              {/* Retake action */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "12px" }}
                  onClick={handleRetake}
                >
                  <RefreshCw size={14} /> Retake Photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
