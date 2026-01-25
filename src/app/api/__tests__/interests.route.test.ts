import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
  createRequest,
  createJsonRequest,
  parseResponse,
} from "@/test-utils/api-helpers";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import { GET, POST } from "../interests/route";
import { PATCH as reviewPATCH } from "../interests/[id]/review/route";

const mockParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET();
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns user interests", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    const mockInterests = [
      { id: "i-1", campaignId: "c-1", status: "PENDING" },
    ];
    (prisma.interest.findMany as any).mockResolvedValue(mockInterests);

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.interests).toHaveLength(1);
    expect(prisma.interest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

describe("POST /api/interests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("creates interest successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "OPEN",
      minContribution: null,
      maxContribution: null,
      entity: { ownerId: "other-user" },
    });
    (prisma.interest.findUnique as any).mockResolvedValue(null);

    const mockInterest = {
      id: "i-1",
      status: "PENDING",
      campaign: { entity: { id: "e-1", name: "Entity" } },
    };
    (prisma.interest.create as any).mockResolvedValue(mockInterest);

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 1000,
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.interest.status).toBe("PENDING");
  });

  it("returns 404 when campaign not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue(null);

    const req = createJsonRequest("/api/interests", {
      campaignId: "nonexistent",
      pledgeAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when campaign is not open", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "CLOSED",
      entity: { ownerId: "other-user" },
    });

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when user is entity owner", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "OPEN",
      entity: { ownerId: "user-1" }, // same user
    });

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when below minimum contribution", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "OPEN",
      minContribution: 500,
      maxContribution: null,
      entity: { ownerId: "other-user" },
    });

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 100, // below min
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when above maximum contribution", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "OPEN",
      minContribution: null,
      maxContribution: 1000,
      entity: { ownerId: "other-user" },
    });

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 5000, // above max
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 for duplicate interest", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "OPEN",
      minContribution: null,
      maxContribution: null,
      entity: { ownerId: "other-user" },
    });
    (prisma.interest.findUnique as any).mockResolvedValue({
      id: "existing",
    });

    const req = createJsonRequest("/api/interests", {
      campaignId: "c-1",
      pledgeAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});

describe("PATCH /api/interests/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest(
      "/api/interests/i-1/review",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await reviewPATCH(req, mockParams("i-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("accepts an interest", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.interest.findUnique as any).mockResolvedValue({
      id: "i-1",
      status: "PENDING",
      campaign: { entity: { ownerId: "user-1" } },
    });

    const mockUpdated = {
      id: "i-1",
      status: "ACCEPTED",
      user: { id: "user-2", name: "Backer", email: "b@test.com" },
    };
    (prisma.interest.update as any).mockResolvedValue(mockUpdated);

    const req = createJsonRequest(
      "/api/interests/i-1/review",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await reviewPATCH(req, mockParams("i-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.interest.status).toBe("ACCEPTED");
  });

  it("returns 404 when interest not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.interest.findUnique as any).mockResolvedValue(null);

    const req = createJsonRequest(
      "/api/interests/i-1/review",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await reviewPATCH(req, mockParams("nonexistent"));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 when user does not own entity", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.interest.findUnique as any).mockResolvedValue({
      id: "i-1",
      status: "PENDING",
      campaign: { entity: { ownerId: "other-user" } },
    });

    const req = createJsonRequest(
      "/api/interests/i-1/review",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await reviewPATCH(req, mockParams("i-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 when interest is not pending", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.interest.findUnique as any).mockResolvedValue({
      id: "i-1",
      status: "ACCEPTED", // not pending
      campaign: { entity: { ownerId: "user-1" } },
    });

    const req = createJsonRequest(
      "/api/interests/i-1/review",
      { status: "DECLINED" },
      "PATCH"
    );
    const res = await reviewPATCH(req, mockParams("i-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
