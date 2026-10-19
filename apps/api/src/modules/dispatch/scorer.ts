import { MinHeap } from "@sanitary/shared";

export interface CandidatePartnerInput {
  partnerId: string;
  distanceKm: number;
  rating?: number;
  acceptanceRate?: number;
  recentLoad?: number;
}

export interface ScoredCandidatePartner extends CandidatePartnerInput {
  score: number;
}

/**
 * Weights for partner scoring algorithm.
 * Proximity: 40%, Rating: 30%, Acceptance Rate: 20%, Recent Load: 10%.
 */
export const SCORING_WEIGHTS = {
  PROXIMITY: 0.4,
  RATING: 0.3,
  ACCEPTANCE_RATE: 0.2,
  RECENT_LOAD: 0.1,
} as const;

/**
 * Computes a weighted score between 0.0 and 1.0 for a candidate partner.
 * Big-O: O(1) time and O(1) space.
 */
export function calculatePartnerScore(candidate: CandidatePartnerInput, maxRadiusKm = 8): number {
  // Proximity: closer partners get higher score (bounded between 0 and 1)
  const proximityNorm = Math.max(0, Math.min(1, 1 - candidate.distanceKm / maxRadiusKm));

  // Rating: 1.0 to 5.0 normalized to 0.0 to 1.0 (default 5.0 -> 1.0)
  const ratingNorm = Math.max(0, Math.min(1, (candidate.rating ?? 5.0) / 5.0));

  // Acceptance Rate: 0.0 to 1.0 (default 1.0)
  const acceptanceNorm = Math.max(0, Math.min(1, candidate.acceptanceRate ?? 1.0));

  // Recent Load: fewer active/recent pickups preferred -> 1 / (1 + load)
  const loadNorm = 1 / (1 + Math.max(0, candidate.recentLoad ?? 0));

  const totalScore =
    SCORING_WEIGHTS.PROXIMITY * proximityNorm +
    SCORING_WEIGHTS.RATING * ratingNorm +
    SCORING_WEIGHTS.ACCEPTANCE_RATE * acceptanceNorm +
    SCORING_WEIGHTS.RECENT_LOAD * loadNorm;

  return Number(totalScore.toFixed(4));
}

/**
 * Ranks candidates and picks top-k highest scoring partners using a Min-Heap of size k.
 * Big-O: O(N log k) time complexity and O(k) space complexity where N is candidates count.
 */
export function selectTopKPartners(
  candidates: CandidatePartnerInput[],
  k = 5,
  maxRadiusKm = 8,
): ScoredCandidatePartner[] {
  if (candidates.length === 0 || k <= 0) return [];

  // Min-heap ordered by score ascending
  const heap = new MinHeap<ScoredCandidatePartner>((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    const score = calculatePartnerScore(candidate, maxRadiusKm);
    const scoredItem: ScoredCandidatePartner = { ...candidate, score };

    heap.push(scoredItem);
    if (heap.size() > k) {
      heap.pop(); // Remove the lowest score among the current k + 1 candidates
    }
  }

  // Returns array sorted descending by score (highest score first)
  return heap.toDescendingArray();
}
