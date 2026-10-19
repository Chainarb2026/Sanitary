import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Geocoding & Reverse Geocoding API", () => {
  it("GET /geo/reverse returns 200 with structured doorstep address for valid coordinates", async () => {
    const res = await request(app).get("/geo/reverse?lat=12.9784&lng=77.6408");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("city", "Bengaluru");
    expect(res.body).toHaveProperty("cityId", "blr");
    expect(res.body).toHaveProperty("state", "Karnataka");
    expect(res.body).toHaveProperty("pincode");
    expect(res.body).toHaveProperty("lat", 12.9784);
    expect(res.body).toHaveProperty("lng", 77.6408);
  });

  it("GET /geo/reverse returns 400 if lat or lng is missing", async () => {
    const res = await request(app).get("/geo/reverse?lat=12.9784");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /geo/reverse returns 400 if coordinates are out of bounds", async () => {
    const res = await request(app).get("/geo/reverse?lat=195.0&lng=77.6408");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /geo/search returns 200 with matched localities for a query", async () => {
    const res = await request(app).get("/geo/search?q=koramangala&city=blr");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const match = res.body.items.find((item: any) =>
      item.name.toLowerCase().includes("koramangala"),
    );
    expect(match).toBeDefined();
    expect(match.city).toBe("Bengaluru");
  });

  it("GET /geo/search returns 400 if search query is missing", async () => {
    const res = await request(app).get("/geo/search");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /geo/ip-detect returns 200 with default or detected location", async () => {
    const res = await request(app).get("/geo/ip-detect");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("city");
    expect(res.body).toHaveProperty("lat");
    expect(res.body).toHaveProperty("lng");
  });
});
