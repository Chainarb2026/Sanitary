import { resolveUrl } from "../api/client.js";

/**
 * Production-ready Location, Geocoding & Autocomplete Service for Sanitary
 * Supports high-accuracy GPS geolocation, reverse-geocoding, and debounced live search
 * across all major Indian metropolitan areas.
 */

export interface LocationItem {
  id: string;
  name: string;
  subtitle: string;
  city: string;
  cityId: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  category?: "hub" | "residential" | "tech" | "transit" | "live";
  isRecent?: boolean;
}

// Comprehensive catalog of prime localities across Indian Metros
export const INDIAN_LOCATIONS_DIRECTORY: LocationItem[] = [
  // --- Bengaluru (BLR) ---
  {
    id: "blr-indiranagar",
    name: "Indiranagar 100ft Road",
    subtitle: "HAL 2nd Stage, East Bengaluru",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560038",
    lat: 12.9784,
    lng: 77.6408,
    category: "hub",
  },
  {
    id: "blr-indiranagar-12th",
    name: "Indiranagar 12th Main Road",
    subtitle: "Defence Colony & CMH Road Junction",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560038",
    lat: 12.9719,
    lng: 77.6412,
    category: "residential",
  },
  {
    id: "blr-koramangala-4th",
    name: "Koramangala 4th Block",
    subtitle: "Near Sony World Signal, South-East Bengaluru",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560034",
    lat: 12.9352,
    lng: 77.6245,
    category: "hub",
  },
  {
    id: "blr-koramangala-5th",
    name: "Koramangala 5th Block",
    subtitle: "Jyoti Nivas College Road & 80 Feet Road",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560095",
    lat: 12.9348,
    lng: 77.6165,
    category: "hub",
  },
  {
    id: "blr-hsr-sector1",
    name: "HSR Layout Sector 1",
    subtitle: "27th Main Road, Outer Ring Road Corridor",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560102",
    lat: 12.9121,
    lng: 77.6446,
    category: "residential",
  },
  {
    id: "blr-hsr-sector2",
    name: "HSR Layout Sector 2",
    subtitle: "Club Road & 14th Main Park",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560102",
    lat: 12.9084,
    lng: 77.6492,
    category: "residential",
  },
  {
    id: "blr-whitefield",
    name: "Whitefield ITPL Main Road",
    subtitle: "Prestige Shantiniketan / Tech Zone",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560066",
    lat: 12.9698,
    lng: 77.75,
    category: "tech",
  },
  {
    id: "blr-whitefield-hopefarm",
    name: "Whitefield Hope Farm Junction",
    subtitle: "Channasandra & Kadugodi Metro Line",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560067",
    lat: 12.9839,
    lng: 77.7516,
    category: "residential",
  },
  {
    id: "blr-jayanagar-4th",
    name: "Jayanagar 4th Block",
    subtitle: "South Bengaluru Cultural & Shopping Hub",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560041",
    lat: 12.925,
    lng: 77.5938,
    category: "residential",
  },
  {
    id: "blr-bellandur",
    name: "Bellandur Outer Ring Road",
    subtitle: "EcoWorld & EcoSpace Tech Parks",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560103",
    lat: 12.9299,
    lng: 77.6749,
    category: "tech",
  },
  {
    id: "blr-marathahalli",
    name: "Marathahalli Bridge Junction",
    subtitle: "ORR Outer Ring Road Tech Belt",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560037",
    lat: 12.9591,
    lng: 77.6974,
    category: "hub",
  },
  {
    id: "blr-electronic-city",
    name: "Electronic City Phase 1",
    subtitle: "Wipro & Infosys Campus Gate",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560100",
    lat: 12.8452,
    lng: 77.6602,
    category: "tech",
  },
  {
    id: "blr-electronic-city-p2",
    name: "Electronic City Phase 2",
    subtitle: "Neeladri Road & Tech Mahindra Precinct",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560100",
    lat: 12.8398,
    lng: 77.6775,
    category: "residential",
  },
  {
    id: "blr-sarjapur",
    name: "Sarjapur Road Wipro Circle",
    subtitle: "Carmelaram & Kaikondrahalli Residential",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560035",
    lat: 12.9081,
    lng: 77.6892,
    category: "residential",
  },
  {
    id: "blr-btm-layout",
    name: "BTM Layout 2nd Stage",
    subtitle: "Udupi Garden Signal & 7th Main",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560076",
    lat: 12.9166,
    lng: 77.6101,
    category: "residential",
  },
  {
    id: "blr-jp-nagar",
    name: "JP Nagar 2nd Phase",
    subtitle: "Outer Ring Road & Central Mall Corridor",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560078",
    lat: 12.9105,
    lng: 77.5857,
    category: "residential",
  },
  {
    id: "blr-malleshwaram",
    name: "Malleshwaram 8th Cross",
    subtitle: "North-West Bengaluru Traditional Hub",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560003",
    lat: 12.9982,
    lng: 77.5714,
    category: "residential",
  },
  {
    id: "blr-mg-road",
    name: "MG Road & Brigade Road",
    subtitle: "Cubbon Park Metro & Central CBD",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560001",
    lat: 12.9756,
    lng: 77.6066,
    category: "hub",
  },
  {
    id: "blr-hebbal-manyata",
    name: "Manyata Tech Park, Hebbal",
    subtitle: "Nagavara Outer Ring Road Corridor",
    city: "Bengaluru",
    cityId: "blr",
    state: "Karnataka",
    pincode: "560045",
    lat: 13.0475,
    lng: 77.6198,
    category: "tech",
  },

  // --- Mumbai (MUM) ---
  {
    id: "mum-bandra-west",
    name: "Bandra West, Hill Road",
    subtitle: "Pali Hill & Carter Road, Western Suburbs",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400050",
    lat: 19.0596,
    lng: 72.8295,
    category: "hub",
  },
  {
    id: "mum-bkc",
    name: "BKC (Bandra Kurla Complex)",
    subtitle: "G Block Financial & Commercial District",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400051",
    lat: 19.0664,
    lng: 72.8687,
    category: "tech",
  },
  {
    id: "mum-andheri-west",
    name: "Andheri West, Lokhandwala",
    subtitle: "Infinity Mall & Link Road corridor",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400053",
    lat: 19.1363,
    lng: 72.8277,
    category: "residential",
  },
  {
    id: "mum-powai",
    name: "Powai Hiranandani Gardens",
    subtitle: "Central Avenue, Tech & Startup District",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400076",
    lat: 19.1176,
    lng: 72.906,
    category: "tech",
  },
  {
    id: "mum-lower-parel",
    name: "Lower Parel, Senapati Bapat Marg",
    subtitle: "High Street Phoenix & Kamala Mills",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400013",
    lat: 18.9953,
    lng: 72.8295,
    category: "hub",
  },
  {
    id: "mum-juhu",
    name: "Juhu Tara Road",
    subtitle: "JW Marriott & Beach Promenade",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400049",
    lat: 19.1027,
    lng: 72.827,
    category: "residential",
  },
  {
    id: "mum-thane-west",
    name: "Thane West, Ghodbunder Road",
    subtitle: "Viviana Mall & Majiwada Junction",
    city: "Mumbai (MMR)",
    cityId: "mum",
    state: "Maharashtra",
    pincode: "400601",
    lat: 19.2183,
    lng: 72.9781,
    category: "residential",
  },

  // --- Delhi-NCR (DEL) ---
  {
    id: "del-connaught-place",
    name: "Connaught Place (CP) Inner Circle",
    subtitle: "Rajiv Chowk Metro, Central Delhi",
    city: "Delhi-NCR",
    cityId: "del",
    state: "National Capital",
    pincode: "110001",
    lat: 28.6315,
    lng: 77.2167,
    category: "hub",
  },
  {
    id: "del-hauz-khas",
    name: "Hauz Khas Enclave",
    subtitle: "Near HKV & Aurobindo Marg, South Delhi",
    city: "Delhi-NCR",
    cityId: "del",
    state: "National Capital",
    pincode: "110016",
    lat: 28.5494,
    lng: 77.2001,
    category: "residential",
  },
  {
    id: "del-cyber-city",
    name: "DLF Cyber City Gurugram",
    subtitle: "Cyber Hub & Rapid Metro Corridor",
    city: "Delhi-NCR",
    cityId: "del",
    state: "Haryana",
    pincode: "122002",
    lat: 28.495,
    lng: 77.0895,
    category: "tech",
  },
  {
    id: "del-golf-course",
    name: "Golf Course Road, DLF Phase 5",
    subtitle: "One Horizon Centre, Gurugram",
    city: "Delhi-NCR",
    cityId: "del",
    state: "Haryana",
    pincode: "122009",
    lat: 28.4595,
    lng: 77.0963,
    category: "residential",
  },
  {
    id: "del-noida-sec62",
    name: "Noida Sector 62",
    subtitle: "Institutional Area & Electronic City Metro",
    city: "Delhi-NCR",
    cityId: "del",
    state: "Uttar Pradesh",
    pincode: "201309",
    lat: 28.628,
    lng: 77.3649,
    category: "tech",
  },
  {
    id: "del-noida-sec18",
    name: "Noida Sector 18 (Atta Market)",
    subtitle: "DLF Mall of India & Wave City Center",
    city: "Delhi-NCR",
    cityId: "del",
    state: "Uttar Pradesh",
    pincode: "201301",
    lat: 28.5708,
    lng: 77.3261,
    category: "hub",
  },
  {
    id: "del-saket",
    name: "Saket District Centre",
    subtitle: "Select Citywalk & Press Enclave Rd",
    city: "Delhi-NCR",
    cityId: "del",
    state: "National Capital",
    pincode: "110017",
    lat: 28.5283,
    lng: 77.2193,
    category: "hub",
  },

  // --- Hyderabad (HYD) ---
  {
    id: "hyd-gachibowli",
    name: "Gachibowli Outer Ring Road",
    subtitle: "ISB & Financial District Gate",
    city: "Hyderabad",
    cityId: "hyd",
    state: "Telangana",
    pincode: "500032",
    lat: 17.4401,
    lng: 78.3489,
    category: "tech",
  },
  {
    id: "hyd-hitec-city",
    name: "HITEC City Cyber Towers",
    subtitle: "Madhapur Tech Belt & Inorbit Mall",
    city: "Hyderabad",
    cityId: "hyd",
    state: "Telangana",
    pincode: "500081",
    lat: 17.4474,
    lng: 78.3762,
    category: "tech",
  },
  {
    id: "hyd-jubilee-hills",
    name: "Jubilee Hills Road No. 36",
    subtitle: "Check Post & Upscale Residential",
    city: "Hyderabad",
    cityId: "hyd",
    state: "Telangana",
    pincode: "500033",
    lat: 17.4319,
    lng: 78.4073,
    category: "residential",
  },
  {
    id: "hyd-banjara-hills",
    name: "Banjara Hills Road No. 12",
    subtitle: "Taj Krishna & City Center Precinct",
    city: "Hyderabad",
    cityId: "hyd",
    state: "Telangana",
    pincode: "500034",
    lat: 17.4156,
    lng: 78.4357,
    category: "residential",
  },
  {
    id: "hyd-kondapur",
    name: "Kondapur RTA Junction",
    subtitle: "Botanical Garden Road Residential",
    city: "Hyderabad",
    cityId: "hyd",
    state: "Telangana",
    pincode: "500084",
    lat: 17.4699,
    lng: 78.3578,
    category: "residential",
  },

  // --- Chennai (CHN) ---
  {
    id: "chn-anna-nagar",
    name: "Anna Nagar 2nd Avenue",
    subtitle: "Roundtana & Tower Park Corridor",
    city: "Chennai",
    cityId: "chn",
    state: "Tamil Nadu",
    pincode: "600040",
    lat: 13.085,
    lng: 80.2101,
    category: "hub",
  },
  {
    id: "chn-t-nagar",
    name: "T. Nagar Panagal Park",
    subtitle: "Usman Road Shopping & Heritage Hub",
    city: "Chennai",
    cityId: "chn",
    state: "Tamil Nadu",
    pincode: "600017",
    lat: 13.0418,
    lng: 80.2341,
    category: "hub",
  },
  {
    id: "chn-omr",
    name: "OMR IT Corridor, Thoraipakkam",
    subtitle: "Tidel Park & Rajiv Gandhi Salai",
    city: "Chennai",
    cityId: "chn",
    state: "Tamil Nadu",
    pincode: "600097",
    lat: 12.935,
    lng: 80.2312,
    category: "tech",
  },
  {
    id: "chn-adyar",
    name: "Adyar Gandhi Nagar",
    subtitle: "Malhar Road & Kasturba Nagar",
    city: "Chennai",
    cityId: "chn",
    state: "Tamil Nadu",
    pincode: "600020",
    lat: 13.0012,
    lng: 80.2565,
    category: "residential",
  },
  {
    id: "chn-velachery",
    name: "Velachery Bypass Road",
    subtitle: "Phoenix Marketcity Junction",
    city: "Chennai",
    cityId: "chn",
    state: "Tamil Nadu",
    pincode: "600042",
    lat: 12.9815,
    lng: 80.218,
    category: "residential",
  },

  // --- Pune (PUN) ---
  {
    id: "pun-koregaon-park",
    name: "Koregaon Park North Main Road",
    subtitle: "Osho International & German Bakery Line",
    city: "Pune",
    cityId: "pun",
    state: "Maharashtra",
    pincode: "411001",
    lat: 18.5362,
    lng: 73.894,
    category: "residential",
  },
  {
    id: "pun-viman-nagar",
    name: "Viman Nagar Central Avenue",
    subtitle: "Phoenix Marketcity & Symbiosis Hub",
    city: "Pune",
    cityId: "pun",
    state: "Maharashtra",
    pincode: "411014",
    lat: 18.5679,
    lng: 73.9143,
    category: "hub",
  },
  {
    id: "pun-hinjewadi",
    name: "Hinjewadi IT Park Phase 1",
    subtitle: "Rajiv Gandhi Infotech Park Gate",
    city: "Pune",
    cityId: "pun",
    state: "Maharashtra",
    pincode: "411057",
    lat: 18.5913,
    lng: 73.7389,
    category: "tech",
  },
  {
    id: "pun-baner",
    name: "Baner High Street",
    subtitle: "Balewadi Phata & Commercial Belt",
    city: "Pune",
    cityId: "pun",
    state: "Maharashtra",
    pincode: "411045",
    lat: 18.559,
    lng: 73.7868,
    category: "residential",
  },

  // --- Kolkata (KOL) ---
  {
    id: "kol-salt-lake",
    name: "Salt Lake Sector V",
    subtitle: "Webel & Wipro Tech Corridor",
    city: "Kolkata",
    cityId: "kol",
    state: "West Bengal",
    pincode: "700091",
    lat: 22.5804,
    lng: 88.4378,
    category: "tech",
  },
  {
    id: "kol-new-town",
    name: "New Town Action Area 1",
    subtitle: "Eco Park & Biswa Bangla Gate",
    city: "Kolkata",
    cityId: "kol",
    state: "West Bengal",
    pincode: "700156",
    lat: 22.5867,
    lng: 88.4756,
    category: "residential",
  },
  {
    id: "kol-park-street",
    name: "Park Street Heritage Hub",
    subtitle: "Camac Street & Chowringhee Crossing",
    city: "Kolkata",
    cityId: "kol",
    state: "West Bengal",
    pincode: "700016",
    lat: 22.5518,
    lng: 88.3524,
    category: "hub",
  },
];

const RECENT_KEY = "sanitary_recent_locations";

export function getRecentLocations(): LocationItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 4).map((p) => ({ ...p, isRecent: true }));
    }
  } catch {
    // Ignore storage parse errors
  }
  return [];
}

export function saveRecentLocation(item: LocationItem): void {
  try {
    const current = getRecentLocations().filter((loc) => loc.id !== item.id && loc.name !== item.name);
    const updated = [{ ...item, isRecent: true }, ...current].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage write errors
  }
}

/**
 * Calculates straight-line distance in kilometers between two GPS points using Haversine formula
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the closest city hub from our directory given arbitrary GPS coordinates
 */
export function findClosestCityHub(lat: number, lng: number): LocationItem {
  let closest = INDIAN_LOCATIONS_DIRECTORY[0]!;
  let minDistance = Infinity;

  for (const loc of INDIAN_LOCATIONS_DIRECTORY) {
    const d = haversineDistanceKm(lat, lng, loc.lat, loc.lng);
    if (d < minDistance) {
      minDistance = d;
      closest = loc;
    }
  }

  return closest;
}

// High-performance in-memory search & geocode cache (0ms lookup for repeated queries)
interface CacheEntry {
  data: LocationItem[];
  timestamp: number;
}
const SEARCH_CACHE = new Map<string, CacheEntry>();
const REVERSE_CACHE = new Map<string, { data: LocationItem; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache
const MAX_CACHE_SIZE = 120;

function getCachedSearch(key: string): LocationItem[] | null {
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedSearch(key: string, data: LocationItem[]): void {
  if (SEARCH_CACHE.size >= MAX_CACHE_SIZE) {
    const oldestKey = SEARCH_CACHE.keys().next().value;
    if (oldestKey) SEARCH_CACHE.delete(oldestKey);
  }
  SEARCH_CACHE.set(key, { data, timestamp: Date.now() });
}

/**
 * Searches locations in the local directory with multi-token fuzzy matching
 * and automatically synthesizes a selectable custom doorstep option if needed.
 */
export async function searchLocations(
  query: string,
  preferredCityId?: string,
): Promise<LocationItem[]> {
  const trimmed = query.trim().toLowerCase();
  const cacheKey = `${trimmed}::${preferredCityId || "all"}`;

  // Check in-memory cache first (0ms latency for repeated searches / backspaces)
  const cached = getCachedSearch(cacheKey);
  if (cached) {
    return cached;
  }

  const cityHub =
    INDIAN_LOCATIONS_DIRECTORY.find((loc) => loc.cityId === preferredCityId) ||
    INDIAN_LOCATIONS_DIRECTORY[0]!;

  // If query is empty, return popular hubs filtered by city (or default city)
  if (!trimmed) {
    const recent = getRecentLocations();
    const cityFiltered = INDIAN_LOCATIONS_DIRECTORY.filter(
      (loc) => !preferredCityId || loc.cityId === preferredCityId,
    ).slice(0, 6);

    const merged = [...recent];
    for (const item of cityFiltered) {
      if (!merged.some((m) => m.name === item.name)) {
        merged.push(item);
      }
    }
    return merged.slice(0, 6);
  }

  // 1. Try our high-accuracy backend geocoding endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = resolveUrl(`/geo/search?q=${encodeURIComponent(query)}&city=${preferredCityId || ""}`);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as { items: LocationItem[] };
      if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
        setCachedSearch(cacheKey, data.items);
        return data.items;
      }
    }
  } catch {
    // Backend geocoding offline or timed out — fall back to local directory scoring
  }

  // 2. Local directory fallback
  const tokens = trimmed
    .replace(/[,/\\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const scoredMatches = INDIAN_LOCATIONS_DIRECTORY.map((loc) => {
    const fullText =
      `${loc.name} ${loc.subtitle} ${loc.city} ${loc.state} ${loc.pincode} ${loc.category || ""}`.toLowerCase();
    const nameLower = loc.name.toLowerCase();
    const cityLower = loc.city.toLowerCase();

    let score = 0;

    if (nameLower === trimmed) {
      score += 200;
    } else if (fullText === trimmed) {
      score += 180;
    } else if (trimmed.startsWith(nameLower)) {
      score += 150;
    } else if (nameLower.startsWith(trimmed)) {
      score += 140;
    } else if (nameLower.includes(trimmed) || trimmed.includes(nameLower)) {
      score += 110;
    } else if (fullText.includes(trimmed)) {
      score += 90;
    }

    if (tokens.length > 0) {
      let matchedCount = 0;
      for (const token of tokens) {
        if (fullText.includes(token)) {
          matchedCount++;
        }
      }

      if (matchedCount === tokens.length) {
        score += 80;
      } else if (matchedCount > 0) {
        score += (matchedCount / tokens.length) * 60;
      }
    }

    if (preferredCityId && loc.cityId === preferredCityId) {
      score += 30;
    } else if (tokens.some((t) => cityLower.includes(t))) {
      score += 25;
    }

    if (loc.pincode === trimmed || trimmed.includes(loc.pincode)) {
      score += 70;
    }

    return { loc, score };
  })
    .filter((item) => item.score >= 35)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.loc);

  const cleanOriginalQuery = query.trim().replace(/\s+/g, " ");
  const customOption: LocationItem = {
    id: `custom-${cleanOriginalQuery.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name: cleanOriginalQuery,
    subtitle: `Custom doorstep address in ${cityHub.city}`,
    city: cityHub.city,
    cityId: cityHub.cityId,
    state: cityHub.state,
    pincode: cityHub.pincode,
    lat: cityHub.lat,
    lng: cityHub.lng,
    category: "live",
  };

  const isTopMatchExact =
    scoredMatches.length > 0 &&
    (scoredMatches[0]!.name.toLowerCase() === trimmed ||
      `${scoredMatches[0]!.name}, ${scoredMatches[0]!.city}`.toLowerCase() === trimmed);

  let finalResults: LocationItem[] = [];

  if (isTopMatchExact) {
    finalResults = scoredMatches.slice(0, 8);
  } else if (cleanOriginalQuery.length >= 3) {
    finalResults = [customOption, ...scoredMatches.filter((m) => m.name !== customOption.name)].slice(0, 8);
  } else {
    finalResults = scoredMatches.slice(0, 8);
  }

  setCachedSearch(cacheKey, finalResults);
  return finalResults;
}

/**
 * Reverse geocodes exact GPS coordinates to human-readable doorstep address
 * using our secure Backend Geocoding API with Redis caching.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
): Promise<LocationItem> {
  const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = REVERSE_CACHE.get(coordKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const closestHub = findClosestCityHub(lat, lng);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    // Call our server-side geocoding endpoint
    const response = await fetch(resolveUrl(`/geo/reverse?lat=${lat}&lng=${lng}`), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as LocationItem;
      REVERSE_CACHE.set(coordKey, { data, timestamp: Date.now() });
      return data;
    }
  } catch {
    // Backend geocoding failed — fallback to closest hub
  }

  const fallback: LocationItem = {
    ...closestHub,
    lat,
    lng,
    name: `${closestHub.name} (Nearby GPS)`,
  };
  REVERSE_CACHE.set(coordKey, { data: fallback, timestamp: Date.now() });
  return fallback;
}

/**
 * Triggers browser geolocation with resilient two-tier fallback:
 * 1. Attempts high accuracy (GPS/WiFi CoreLocation) with a 4s timeout.
 * 2. If high accuracy times out or is unavailable (common on desktop Macs without hardware GPS),
 *    falls back to standard accuracy (WiFi/IP trilateration) with a 4s timeout.
 * 3. If browser permissions are denied or unavailable on desktop, gracefully detects
 *    real city location via server-side IP detection (/geo/ip-detect).
 */
export function detectCurrentLocation(): Promise<LocationItem> {
  return new Promise((resolve) => {
    const fallbackToIp = async () => {
      try {
        const res = await fetch(resolveUrl("/geo/ip-detect"));
        if (res.ok) {
          const data = (await res.json()) as LocationItem;
          resolve(data);
          return;
        }
      } catch {
        // IP lookup error
      }
      resolve(INDIAN_LOCATIONS_DIRECTORY[0]!);
    };

    if (!navigator.geolocation) {
      void fallbackToIp();
      return;
    }

    const tryLowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const item = await reverseGeocodeCoordinates(
              position.coords.latitude,
              position.coords.longitude,
            );
            resolve(item);
          } catch {
            void fallbackToIp();
          }
        },
        () => {
          void fallbackToIp();
        },
        {
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 60000,
        },
      );
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const item = await reverseGeocodeCoordinates(
            position.coords.latitude,
            position.coords.longitude,
          );
          resolve(item);
        } catch {
          void fallbackToIp();
        }
      },
      (highError) => {
        if (highError.code === highError.PERMISSION_DENIED) {
          void fallbackToIp();
          return;
        }
        tryLowAccuracy();
      },
      {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 30000,
      },
    );
  });
}


