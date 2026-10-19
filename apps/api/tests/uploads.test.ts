import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { generateAccessToken } from "../src/utils/jwt.js";
import { connectDB, disconnectDB } from "../src/infra/db.js";
import { MongoMemoryServer } from "mongodb-memory-server";

describe("Direct Presigned Upload Module", () => {
  let mongoServer: MongoMemoryServer;
  let customerToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());
    customerToken = generateAccessToken({
      userId: "6aca227fe178a871dd15eb11",
      phone: "+919876543210",
      role: "customer",
    });
  });

  afterAll(async () => {
    await disconnectDB();
    await mongoServer.stop();
  });

  it("generates a direct presigned upload URL with valid key and PUT method", async () => {
    const res = await request(app)
      .post("/uploads/presign")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        fileName: "waste_bag.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.uploadUrl).toBeDefined();
    expect(res.body.downloadUrl).toBeDefined();
    expect(res.body.key).toMatch(/^waste_\d+_[a-z0-9-]+\.jpg$/);
    expect(res.body.method).toBe("PUT");
  });

  it("allows direct binary PUT upload and subsequent file retrieval", async () => {
    // 1. Get presigned URL
    const presignRes = await request(app)
      .post("/uploads/presign")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ fileName: "photo.jpg", contentType: "image/jpeg" });

    expect(presignRes.status).toBe(200);
    const key = presignRes.body.key;

    // 2. Direct binary PUT upload
    const mockImageBuffer = Buffer.from("fake-binary-image-data-stream-bytes-1234");
    const uploadRes = await request(app)
      .put(`/uploads/files/${key}`)
      .set("Content-Type", "image/jpeg")
      .send(mockImageBuffer);

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);

    // 3. Fetch file back
    const getRes = await request(app).get(`/uploads/files/${key}`);
    expect(getRes.status).toBe(200);
    expect(getRes.headers["content-type"]).toBe("image/jpeg");
    expect(getRes.body.toString()).toBe("fake-binary-image-data-stream-bytes-1234");
  });
});
