import { useState, useCallback } from "react";

export interface CompressionResult {
  blob: Blob;
  previewUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  reductionPercentage: number;
}

export function useImageCompression() {
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const compressImage = useCallback(
    async (file: File, maxDimension = 1280, quality = 0.78): Promise<CompressionResult> => {
      setIsCompressing(true);
      setError(null);

      return new Promise<CompressionResult>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
          setIsCompressing(false);
          const err = "Failed to read image file";
          setError(err);
          reject(new Error(err));
        };

        reader.onload = (event) => {
          const img = new Image();
          img.onerror = () => {
            setIsCompressing(false);
            const err = "Failed to load image into DOM";
            setError(err);
            reject(new Error(err));
          };

          img.onload = () => {
            try {
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > maxDimension) {
                  height = Math.round((height * maxDimension) / width);
                  width = maxDimension;
                }
              } else {
                if (height > maxDimension) {
                  width = Math.round((width * maxDimension) / height);
                  height = maxDimension;
                }
              }

              const canvas = document.createElement("canvas");
              canvas.width = width;
              canvas.height = height;

              const ctx = canvas.getContext("2d");
              if (!ctx) {
                throw new Error("Could not acquire canvas 2D context");
              }

              // High-quality image smoothing
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";
              ctx.drawImage(img, 0, 0, width, height);

              canvas.toBlob(
                (blob) => {
                  setIsCompressing(false);
                  if (!blob) {
                    const err = "Image canvas compression failed";
                    setError(err);
                    reject(new Error(err));
                    return;
                  }

                  const previewUrl = URL.createObjectURL(blob);
                  const originalSizeBytes = file.size;
                  const compressedSizeBytes = blob.size;
                  const reductionPercentage = Math.round(
                    ((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100,
                  );

                  resolve({
                    blob,
                    previewUrl,
                    originalSizeBytes,
                    compressedSizeBytes,
                    reductionPercentage: Math.max(0, reductionPercentage),
                  });
                },
                "image/jpeg",
                quality,
              );
            } catch (err) {
              setIsCompressing(false);
              const errMsg = err instanceof Error ? err.message : "Compression failed";
              setError(errMsg);
              reject(err);
            }
          };

          img.src = event.target?.result as string;
        };

        reader.readAsDataURL(file);
      });
    },
    [],
  );

  return {
    compressImage,
    isCompressing,
    error,
  };
}
