export const KYC_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export const VEHICLE_TYPES = ["two_wheeler", "three_wheeler", "truck", "cycle"] as const;

export const ADDRESS_LABELS = ["home", "work", "other"] as const;

export const GEO_CONFIG = {
  GEO_KEY: "partners:geo",
  PRESENCE_KEY_PREFIX: "partner:presence:",
  PRESENCE_TTL_SECONDS: 30,
  PING_THROTTLE_SECONDS: 3,
  DEFAULT_SEARCH_RADIUS_KM: 5,
  MAX_SEARCH_RADIUS_KM: 25,
  DEFAULT_SEARCH_LIMIT: 20,
  MAX_SEARCH_LIMIT: 100,
} as const;
