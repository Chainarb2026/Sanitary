import type { Redis } from "ioredis";

interface GeoMember {
  longitude: number;
  latitude: number;
  member: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

export class MockRedis {
  private store = new Map<string, string>();
  private hashStore = new Map<string, Map<string, string>>();
  private geoStore = new Map<string, Map<string, GeoMember>>();
  private expiries = new Map<string, number>();
  public status: string = "ready";

  public reset(): void {
    this.store.clear();
    this.hashStore.clear();
    this.geoStore.clear();
    this.expiries.clear();
  }

  public async get(key: string): Promise<string | null> {
    this.checkExpiry(key);
    return this.store.get(key) ?? null;
  }

  public async exists(key: string): Promise<number> {
    this.checkExpiry(key);
    const exists = this.store.has(key) || this.hashStore.has(key) || this.geoStore.has(key);
    return exists ? 1 : 0;
  }

  public async set(key: string, value: string, ...opts: unknown[]): Promise<string | null> {
    this.checkExpiry(key);

    const isNx = opts.includes("NX");
    if (isNx && (this.store.has(key) || this.hashStore.has(key))) {
      return null;
    }

    this.store.set(key, value);
    const exIdx = opts.indexOf("EX");
    if (exIdx !== -1 && typeof opts[exIdx + 1] === "number") {
      this.expiries.set(key, Date.now() + (opts[exIdx + 1] as number) * 1000);
    }
    return "OK";
  }

  public async incr(key: string): Promise<number> {
    this.checkExpiry(key);
    const current = parseInt(this.store.get(key) ?? "0", 10) || 0;
    const next = current + 1;
    this.store.set(key, next.toString());
    return next;
  }

  public async del(key: string): Promise<number> {
    const existed =
      this.store.delete(key) ||
      this.hashStore.delete(key) ||
      this.geoStore.delete(key) ||
      this.expiries.delete(key);
    return existed ? 1 : 0;
  }

  public async geoadd(
    key: string,
    longitude: number,
    latitude: number,
    member: string,
  ): Promise<number> {
    let geo = this.geoStore.get(key);
    if (!geo) {
      geo = new Map();
      this.geoStore.set(key, geo);
    }
    geo.set(member, { longitude, latitude, member });
    return 1;
  }

  public async zrem(key: string, member: string): Promise<number> {
    const geo = this.geoStore.get(key);
    if (!geo) return 0;
    return geo.delete(member) ? 1 : 0;
  }

  public async call(cmd: string, ...args: unknown[]): Promise<unknown> {
    if (cmd.toUpperCase() === "GEORADIUS") {
      const [key, lngStr, latStr, radiusStr, _unit, ...rest] = args as [
        string,
        number | string,
        number | string,
        number | string,
        string,
        ...string[],
      ];

      const centerLng = parseFloat(String(lngStr));
      const centerLat = parseFloat(String(latStr));
      const radiusKm = parseFloat(String(radiusStr));

      let limit = 100;
      const countIdx = rest.indexOf("COUNT");
      if (countIdx !== -1 && rest[countIdx + 1]) {
        limit = parseInt(String(rest[countIdx + 1]), 10) || 100;
      }

      const geo = this.geoStore.get(key);
      if (!geo) return [];

      const matches: Array<{
        member: string;
        dist: number;
        lng: number;
        lat: number;
      }> = [];

      for (const item of geo.values()) {
        const dist = haversineKm(centerLat, centerLng, item.latitude, item.longitude);
        if (dist <= radiusKm) {
          matches.push({
            member: item.member,
            dist,
            lng: item.longitude,
            lat: item.latitude,
          });
        }
      }

      // Sort ascending by distance
      matches.sort((a, b) => a.dist - b.dist);

      const sliced = matches.slice(0, limit);
      // Format as Redis GEORADIUS: [ [member, "distance", ["lng", "lat"]], ... ]
      return sliced.map((m) => [m.member, m.dist.toFixed(4), [m.lng.toString(), m.lat.toString()]]);
    }

    throw new Error(`Command ${cmd} not mocked in MockRedis`);
  }

  public pipeline() {
    const results: Array<[Error | null, unknown]> = [];
    const chain = {
      exists: (key: string) => {
        this.checkExpiry(key);
        const present = this.store.has(key) || this.hashStore.has(key) || this.geoStore.has(key);
        results.push([null, present ? 1 : 0]);
        return chain;
      },
      exec: async () => results,
    };
    return chain;
  }

  public async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    this.checkExpiry(key);
    const hash = this.hashStore.get(key);
    if (!hash) {
      return fields.map(() => null);
    }
    return fields.map((f) => hash.get(f) ?? null);
  }

  public async hset(key: string, ...args: (string | number)[]): Promise<number> {
    let hash = this.hashStore.get(key);
    if (!hash) {
      hash = new Map();
      this.hashStore.set(key, hash);
    }

    let count = 0;
    for (let i = 0; i < args.length; i += 2) {
      const field = String(args[i]);
      const value = String(args[i + 1]);
      hash.set(field, value);
      count++;
    }
    return count;
  }

  public async expire(key: string, seconds: number): Promise<number> {
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  public expireImmediately(key: string): void {
    this.store.delete(key);
    this.hashStore.delete(key);
    this.geoStore.delete(key);
    this.expiries.delete(key);
  }

  public multi() {
    const ops: Array<() => Promise<unknown>> = [];
    const chain = {
      hset: (key: string, ...args: (string | number)[]) => {
        ops.push(() => this.hset(key, ...args));
        return chain;
      },
      set: (key: string, value: string, ...opts: unknown[]) => {
        ops.push(() => this.set(key, value, ...opts));
        return chain;
      },
      expire: (key: string, seconds: number) => {
        ops.push(() => this.expire(key, seconds));
        return chain;
      },
      geoadd: (key: string, longitude: number, latitude: number, member: string) => {
        ops.push(() => this.geoadd(key, longitude, latitude, member));
        return chain;
      },
      zrem: (key: string, member: string) => {
        ops.push(() => this.zrem(key, member));
        return chain;
      },
      del: (key: string) => {
        ops.push(() => this.del(key));
        return chain;
      },
      exec: async () => {
        const results = [];
        for (const op of ops) {
          results.push(await op());
        }
        return results;
      },
    };
    return chain;
  }

  public async eval(
    _script: string,
    _numKeys: number,
    key: string,
    capacityStr: string,
    refillRateStr: string,
    costStr: string,
    nowStr: string,
  ): Promise<[number, number, number]> {
    const capacity = parseFloat(capacityStr);
    const refillRate = parseFloat(refillRateStr);
    const cost = parseFloat(costStr);
    const now = parseFloat(nowStr);

    let hash = this.hashStore.get(key);
    if (!hash) {
      hash = new Map();
      this.hashStore.set(key, hash);
    }

    const currentTokensStr = hash.get("tokens");
    const lastUpdatedStr = hash.get("last_updated");

    let tokens = capacity;

    if (currentTokensStr !== undefined && lastUpdatedStr !== undefined) {
      const storedTokens = parseFloat(currentTokensStr);
      const storedUpdated = parseFloat(lastUpdatedStr);
      const delta = Math.max(0, now - storedUpdated);
      const refilled = delta * refillRate;
      tokens = Math.min(capacity, storedTokens + refilled);
    }

    if (tokens >= cost) {
      tokens = tokens - cost;
      hash.set("tokens", String(tokens));
      hash.set("last_updated", String(now));
      return [1, Math.floor(tokens), 0];
    } else {
      const needed = cost - tokens;
      const retryAfter = Math.ceil(needed / refillRate);
      return [0, Math.floor(tokens), retryAfter];
    }
  }

  public async ping(): Promise<string> {
    return "PONG";
  }

  public duplicate(): this {
    return this;
  }

  public async quit(): Promise<"OK"> {
    return "OK";
  }

  public on(): this {
    return this;
  }

  private checkExpiry(key: string): void {
    const exp = this.expiries.get(key);
    if (exp && exp <= Date.now()) {
      this.store.delete(key);
      this.hashStore.delete(key);
      this.geoStore.delete(key);
      this.expiries.delete(key);
    }
  }
}

export function createMockRedis(): MockRedis & Redis {
  return new MockRedis() as unknown as MockRedis & Redis;
}
