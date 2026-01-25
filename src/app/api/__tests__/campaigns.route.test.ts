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
import { GET, POST } from "../campaigns/route";

describe("GET /api/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns campaigns with default OPEN status", async () => {
    const mockCampaigns = [
      { id: "c-1", title: "Campaign 1", status: "OPEN" },
    ];
    (prisma.campaign.findMany as any).mockResolvedValue(mockCampaigns);

    const req = createRequest("/api/campaigns");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.campaigns).toEqual(mockCampaigns);
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
      })
    );
  });

  it("filters by custom status", async () => {
    (prisma.campaign.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/campaigns?status=DRAFT");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DRAFT" }),
      })
    );
  });

  it("filters by entity type", async () => {
    (prisma.campaign.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/campaigns?entityType=VALIDATOR");
    const res = await GET(req);
    await parseResponse(res);

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          entity: { type: "VALIDATOR" },
        }),
      })
    );
  });

  it("searches by title or entity name", async () => {
    (prisma.campaign.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/campaigns?search=DeFi");
    const res = await GET(req);
    await parseResponse(res);

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: "DeFi", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });

  it("sorts by newest by default", async () => {
    (prisma.campaign.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/campaigns");
    await GET(req);

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("sorts by ending soon", async () => {
    (prisma.campaign.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/campaigns?sort=ending");
    await GET(req);

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { endsAt: "asc" },
      })
    );
  });

  it("sorts by most funded", async () => {
    (prisma.campaign.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/campaigns?sort=funded");
    await GET(req);

    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { currentAmount: "desc" },
      })
    );
  });
});

describe("POST /api/campaigns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest("/api/campaigns", {
      entityId: "e-1",
      title: "Test Campaign",
      targetAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("creates a campaign successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    (prisma.entity.findUnique as any).mockResolvedValue({
      ownerId: "user-1",
    });

    const mockCampaign = {
      id: "c-1",
      title: "Test Campaign",
      status: "DRAFT",
      entity: { id: "e-1", name: "Entity", type: "FEATURED_APP" },
    };
    (prisma.campaign.create as any).mockResolvedValue(mockCampaign);

    const req = createJsonRequest("/api/campaigns", {
      entityId: "e-1",
      title: "Test Campaign",
      targetAmount: 1000,
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.campaign.status).toBe("DRAFT");
  });

  it("returns 404 when entity not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue(null);

    const req = createJsonRequest("/api/campaigns", {
      entityId: "nonexistent",
      title: "Test Campaign",
      targetAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 when user does not own entity", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      ownerId: "other-user",
    });

    const req = createJsonRequest("/api/campaigns", {
      entityId: "e-1",
      title: "Test Campaign",
      targetAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 for validation errors", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    const req = createJsonRequest("/api/campaigns", {
      entityId: "e-1",
      title: "AB", // too short
      targetAmount: 1000,
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
