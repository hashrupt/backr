import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createJsonRequest, parseResponse } from "@/test-utils/api-helpers";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));
vi.mock("@/services/canton", () => ({
  cantonService: {
    lockCC: vi.fn(),
  },
}));

import { getServerSession } from "next-auth";
import { cantonService } from "@/services/canton";
import { POST } from "../backings/route";

describe("POST /api/backings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest("/api/backings", {
      interestId: "i-1",
      campaignId: "c-1",
      entityId: "e-1",
      amount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("creates backing successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    // Interest exists and is ACCEPTED
    (prisma.interest.findFirst as any).mockResolvedValue({
      id: "i-1",
      userId: "user-1",
      campaignId: "c-1",
      status: "ACCEPTED",
    });

    // User has sufficient balance
    (prisma.user.findUnique as any).mockResolvedValue({
      partyId: "party-1",
      mockBalance: 10000,
    });

    // Canton lock succeeds
    vi.mocked(cantonService.lockCC).mockResolvedValue({
      success: true,
      txHash: "mock-tx-123",
      lockedPartyId: "locked-party-1",
    });

    // Transaction mock
    const mockBacking = {
      id: "b-1",
      userId: "user-1",
      entityId: "e-1",
      campaignId: "c-1",
      amount: 1000,
      status: "LOCKED",
    };

    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      const tx = {
        backing: { create: vi.fn().mockResolvedValue(mockBacking) },
        interest: { update: vi.fn() },
        campaign: { update: vi.fn() },
        entity: { update: vi.fn() },
        user: { update: vi.fn() },
      };
      return fn(tx);
    });

    const req = createJsonRequest("/api/backings", {
      interestId: "i-1",
      campaignId: "c-1",
      entityId: "e-1",
      amount: 1000,
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.backing.status).toBe("LOCKED");
  });

  it("returns 404 when interest not found or not accepted", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.interest.findFirst as any).mockResolvedValue(null);

    const req = createJsonRequest("/api/backings", {
      interestId: "i-1",
      campaignId: "c-1",
      entityId: "e-1",
      amount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when insufficient balance", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.interest.findFirst as any).mockResolvedValue({
      id: "i-1",
      status: "ACCEPTED",
    });
    (prisma.user.findUnique as any).mockResolvedValue({
      partyId: "party-1",
      mockBalance: 100, // insufficient
    });

    const req = createJsonRequest("/api/backings", {
      interestId: "i-1",
      campaignId: "c-1",
      entityId: "e-1",
      amount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 for validation errors", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    const req = createJsonRequest("/api/backings", {
      interestId: "i-1",
      // missing required fields
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
