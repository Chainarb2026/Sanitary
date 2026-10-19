import { describe, it, expect } from "vitest";

describe("Client-side Image Scaling & Aspect Ratio Math", () => {
  function calculateDimensions(width: number, height: number, maxDimension = 1280) {
    let targetWidth = width;
    let targetHeight = height;

    if (width > height) {
      if (width > maxDimension) {
        targetHeight = Math.round((height * maxDimension) / width);
        targetWidth = maxDimension;
      }
    } else {
      if (height > maxDimension) {
        targetWidth = Math.round((width * maxDimension) / height);
        targetHeight = maxDimension;
      }
    }

    return { targetWidth, targetHeight };
  }

  it("scales down large landscape camera photos (4032x3024) to fit max 1280px maintaining aspect ratio", () => {
    const { targetWidth, targetHeight } = calculateDimensions(4032, 3024, 1280);
    expect(targetWidth).toBe(1280);
    expect(targetHeight).toBe(960);
    expect(Math.abs(4032 / 3024 - targetWidth / targetHeight)).toBeLessThan(0.01);
  });

  it("scales down portrait camera photos (3024x4032) to fit max 1280px height maintaining aspect ratio", () => {
    const { targetWidth, targetHeight } = calculateDimensions(3024, 4032, 1280);
    expect(targetWidth).toBe(960);
    expect(targetHeight).toBe(1280);
  });

  it("leaves images under 1280px untouched", () => {
    const { targetWidth, targetHeight } = calculateDimensions(800, 600, 1280);
    expect(targetWidth).toBe(800);
    expect(targetHeight).toBe(600);
  });
});
