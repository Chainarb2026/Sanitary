import { getRedisClient } from "../../infra/redis.js";
import { logger } from "../../infra/logger.js";

export interface GeoLocationItem {
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
}

// Comprehensive catalog of prime Indian metropolitan hubs and localities
export const INDIAN_METRO_HUBS: GeoLocationItem[] = [
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

  // --- Hyderabad (HYD) ---
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

  // --- Chennai (CHN) ---
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

  // --- Kolkata (KOL) ---
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

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

function findClosestHub(lat: number, lng: number): GeoLocationItem {
  let closest = INDIAN_METRO_HUBS[0]!;
  let minDistance = Infinity;

  for (const hub of INDIAN_METRO_HUBS) {
    const d = haversineDistanceKm(lat, lng, hub.lat, hub.lng);
    if (d < minDistance) {
      minDistance = d;
      closest = hub;
    }
  }

  return closest;
}

function resolveCityId(cityName: string, stateName: string = ""): string {
  const s = `${cityName} ${stateName}`.toLowerCase();
  if (s.includes("bengaluru") || s.includes("bangalore") || s.includes("karnataka")) return "blr";
  if (s.includes("mumbai") || s.includes("thane") || s.includes("navi mumbai")) return "mum";
  if (s.includes("delhi") || s.includes("noida") || s.includes("gurugram") || s.includes("faridabad"))
    return "del";
  if (s.includes("hyderabad") || s.includes("secunderabad") || s.includes("telangana")) return "hyd";
  if (s.includes("chennai") || s.includes("tamil nadu")) return "chn";
  if (s.includes("pune")) return "pun";
  if (s.includes("kolkata") || s.includes("west bengal")) return "kol";
  return "blr";
}

export class GeoCodingService {
  /**
   * Reverse geocodes exact coordinates into structured doorstep address.
   * Leverages Redis cache (24h) and compliant server-side OSM geocoding with custom User-Agent.
   */
  public async reverseGeocode(lat: number, lng: number): Promise<GeoLocationItem> {
    const redis = getRedisClient();
    const cacheKey = `geo:reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as GeoLocationItem;
      }
    } catch (cacheErr) {
      logger.warn({ cacheErr }, "Redis cache lookup failed for reverse geocode");
    }

    const closest = findClosestHub(lat, lng);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "SanitaryPlatform/1.0 (+https://sanitary.eco; engineering@sanitary.eco)",
          "Accept-Language": "en",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          name?: string;
          display_name?: string;
          address?: Record<string, string>;
        };
        const addr = data.address || {};

        const road =
          addr.road || addr.pedestrian || addr.street || addr.residential || addr.footway || "";
        const neighbourhood =
          addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || "";
        const city = addr.city || addr.town || addr.county || addr.state_district || closest.city;
        const state = addr.state || closest.state;
        const pincode = addr.postcode || closest.pincode;

        const primaryParts = [road, neighbourhood].filter(Boolean);
        const name =
          primaryParts.length > 0
            ? primaryParts.join(", ")
            : data.name || closest.name;
        const subtitle = [city, pincode, state].filter(Boolean).join(", ");
        const cityId = resolveCityId(city, state);

        const result: GeoLocationItem = {
          id: `rev-${Date.now()}`,
          name,
          subtitle,
          city,
          cityId,
          state,
          pincode,
          lat,
          lng,
          category: "live",
        };

        try {
          await redis.set(cacheKey, JSON.stringify(result), "EX", 86400); // 24 hours
        } catch {
          // ignore cache write error
        }

        return result;
      }
    } catch (err) {
      logger.warn({ err, lat, lng }, "Server-side reverse geocoding external API failed, using closest hub fallback");
    }

    // Fallback if external API timed out or failed
    const fallback: GeoLocationItem = {
      id: `closest-${closest.id}`,
      name: closest.name,
      subtitle: `${closest.subtitle} • Real Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      city: closest.city,
      cityId: closest.cityId,
      state: closest.state,
      pincode: closest.pincode,
      lat,
      lng,
      category: "live",
    };

    return fallback;
  }

  /**
   * Searches locations with multi-token fuzzy matching and server-side augmentation.
   */
  public async search(query: string, cityId?: string): Promise<GeoLocationItem[]> {
    const redis = getRedisClient();
    const trimmed = query.trim().toLowerCase();
    const cacheKey = `geo:search:${encodeURIComponent(trimmed)}:${cityId || "all"}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as GeoLocationItem[];
      }
    } catch {
      // ignore cache read error
    }

    const cityHub =
      INDIAN_METRO_HUBS.find((loc) => loc.cityId === cityId) || INDIAN_METRO_HUBS[0]!;

    if (!trimmed) {
      const cityFiltered = INDIAN_METRO_HUBS.filter(
        (loc) => !cityId || loc.cityId === cityId,
      ).slice(0, 8);
      return cityFiltered;
    }

    const tokens = trimmed
      .replace(/[,/\\-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const scoredMatches = INDIAN_METRO_HUBS.map((loc) => {
      const fullText =
        `${loc.name} ${loc.subtitle} ${loc.city} ${loc.state} ${loc.pincode}`.toLowerCase();
      const nameLower = loc.name.toLowerCase();
      const cityLower = loc.city.toLowerCase();

      let score = 0;
      if (nameLower === trimmed) score += 200;
      else if (fullText === trimmed) score += 180;
      else if (trimmed.startsWith(nameLower)) score += 150;
      else if (nameLower.startsWith(trimmed)) score += 140;
      else if (nameLower.includes(trimmed) || trimmed.includes(nameLower)) score += 110;
      else if (fullText.includes(trimmed)) score += 90;

      if (tokens.length > 0) {
        let matchedCount = 0;
        for (const token of tokens) {
          if (fullText.includes(token)) matchedCount++;
        }
        if (matchedCount === tokens.length) score += 80;
        else if (matchedCount > 0) score += (matchedCount / tokens.length) * 60;
      }

      if (cityId && loc.cityId === cityId) score += 30;
      else if (tokens.some((t) => cityLower.includes(t))) score += 25;

      if (loc.pincode === trimmed || trimmed.includes(loc.pincode)) score += 70;

      return { loc, score };
    })
      .filter((item) => item.score >= 35)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.loc);

    // If query has 3+ chars, also augment via server-side geocoding
    let liveItems: GeoLocationItem[] = [];
    if (trimmed.length >= 3) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const cityName = cityHub.city;
        const searchQuery = !trimmed.includes(cityName.toLowerCase())
          ? `${query}, ${cityName}, India`
          : `${query}, India`;

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery,
          )}&countrycodes=in&addressdetails=1&limit=5`,
          {
            signal: controller.signal,
            headers: {
              "User-Agent": "SanitaryPlatform/1.0 (+https://sanitary.eco; engineering@sanitary.eco)",
              "Accept-Language": "en",
            },
          },
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = (await response.json()) as Array<{
            place_id?: number | string;
            lat: string;
            lon: string;
            display_name: string;
            address?: Record<string, string>;
          }>;

          if (Array.isArray(data)) {
            liveItems = data.map((item, idx) => {
              const addr = item.address || {};
              const locality =
                addr.suburb ||
                addr.neighbourhood ||
                addr.residential ||
                addr.road ||
                item.display_name.split(",")[0] ||
                "Location";
              const city = addr.city || addr.town || addr.county || cityHub.city;
              const pincode = addr.postcode || "";

              return {
                id: `live-${item.place_id || idx}`,
                name: locality,
                subtitle: item.display_name.split(",").slice(1, 4).join(",").trim(),
                city,
                cityId: resolveCityId(city),
                state: addr.state || cityHub.state,
                pincode,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                category: "live" as const,
              };
            });
          }
        }
      } catch {
        // live search failed or timed out — safely continue with local matches
      }
    }

    // Merge and deduplicate
    const seen = new Set<string>();
    const combined: GeoLocationItem[] = [];

    // Synthesize custom address item if query is 3+ chars
    const cleanOriginalQuery = query.trim().replace(/\s+/g, " ");
    const customOption: GeoLocationItem = {
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

    if (cleanOriginalQuery.length >= 3) {
      combined.push(customOption);
      seen.add(customOption.name.toLowerCase());
    }

    for (const item of [...scoredMatches, ...liveItems]) {
      const key = item.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(item);
      }
    }

    const finalResults = combined.slice(0, 8);
    try {
      await redis.set(cacheKey, JSON.stringify(finalResults), "EX", 3600); // 1 hour
    } catch {
      // ignore cache write error
    }

    return finalResults;
  }

  /**
   * Detects location based on client IP address for desktop browsers.
   */
  public async detectIp(clientIp: string): Promise<GeoLocationItem> {
    const isLocal =
      !clientIp ||
      clientIp === "::1" ||
      clientIp === "127.0.0.1" ||
      clientIp.startsWith("192.168.") ||
      clientIp.startsWith("10.") ||
      clientIp.startsWith("172.16.");

    // Default to Bengaluru central hub for local development
    if (isLocal) {
      const hub = INDIAN_METRO_HUBS[0]!;
      return {
        ...hub,
        id: "ip-local",
        subtitle: `${hub.name} (Local Development IP)`,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,city,zip,lat,lon`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as {
          status: string;
          country?: string;
          city?: string;
          zip?: string;
          lat?: number;
          lon?: number;
        };

        if (data.status === "success" && data.lat && data.lon) {
          return this.reverseGeocode(data.lat, data.lon);
        }
      }
    } catch {
      // IP lookup failed
    }

    return INDIAN_METRO_HUBS[0]!;
  }
}

export const geoCodingService = new GeoCodingService();
