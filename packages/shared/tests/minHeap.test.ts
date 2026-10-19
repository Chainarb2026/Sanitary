import { describe, it, expect } from "vitest";
import { MinHeap } from "../src/minHeap.js";

describe("MinHeap Data Structure", () => {
  it("maintains min element at root and extracts items in ascending order", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    const numbers = [45, 12, 89, 5, 23, 7, 64];

    for (const n of numbers) {
      heap.push(n);
    }

    expect(heap.size()).toBe(7);
    expect(heap.peek()).toBe(5);

    const extracted: number[] = [];
    while (!heap.isEmpty()) {
      extracted.push(heap.pop()!);
    }

    expect(extracted).toEqual([5, 7, 12, 23, 45, 64, 89]);
  });

  it("selects top-k highest-scoring elements in O(N log k) time", () => {
    interface Candidate {
      id: string;
      score: number;
    }

    // Min-heap ordered by score ascending
    const heap = new MinHeap<Candidate>((a, b) => a.score - b.score);
    const k = 3;

    const candidates: Candidate[] = [
      { id: "p1", score: 0.65 },
      { id: "p2", score: 0.92 },
      { id: "p3", score: 0.41 },
      { id: "p4", score: 0.88 },
      { id: "p5", score: 0.77 },
      { id: "p6", score: 0.95 },
    ];

    for (const c of candidates) {
      heap.push(c);
      if (heap.size() > k) {
        heap.pop();
      }
    }

    expect(heap.size()).toBe(3);

    const topK = heap.toDescendingArray();
    expect(topK.map((c) => c.id)).toEqual(["p6", "p2", "p4"]);
    expect(topK[0].score).toBe(0.95);
    expect(topK[1].score).toBe(0.92);
    expect(topK[2].score).toBe(0.88);
  });
});
