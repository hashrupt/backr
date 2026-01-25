import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createJsonRequest, parseResponse } from "@/test-utils/api-helpers";

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password-123"),
}));

import { POST } from "../auth/register/route";

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a user successfully", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({
      id: "user-1",
      name: "John Doe",
      email: "john@test.com",
    });

    const req = createJsonRequest("/api/auth/register", {
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.message).toBe("User created successfully");
    expect(body.user.email).toBe("john@test.com");
  });

  it("returns 400 for duplicate email", async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: "existing" });

    const req = createJsonRequest("/api/auth/register", {
      name: "John Doe",
      email: "existing@test.com",
      password: "password123",
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain("already exists");
  });

  it("returns 400 for duplicate partyId", async () => {
    (prisma.user.findUnique as any)
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce({ id: "existing" }); // partyId check

    const req = createJsonRequest("/api/auth/register", {
      name: "John Doe",
      email: "new@test.com",
      password: "password123",
      partyId: "taken-party",
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain("PartyId");
  });

  it("returns 400 for invalid email", async () => {
    const req = createJsonRequest("/api/auth/register", {
      name: "John Doe",
      email: "not-an-email",
      password: "password123",
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const req = createJsonRequest("/api/auth/register", {
      name: "John Doe",
      email: "john@test.com",
      password: "short",
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 for short name", async () => {
    const req = createJsonRequest("/api/auth/register", {
      name: "J",
      email: "john@test.com",
      password: "password123",
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("includes optional bio and partyId", async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({
      id: "user-1",
      name: "John Doe",
      email: "john@test.com",
    });

    const req = createJsonRequest("/api/auth/register", {
      name: "John Doe",
      email: "john@test.com",
      password: "password123",
      bio: "Hello world",
      partyId: "party-123",
    });

    await POST(req);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bio: "Hello world",
          partyId: "party-123",
        }),
      })
    );
  });
});
