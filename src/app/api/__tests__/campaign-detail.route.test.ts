import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createRequest, createJsonRequest, parseResponse } from "@/test-utils/api-helpers";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth";
import { GET } from "../campaigns/[id]/route";
import { POST as publishPOST } from "../campaigns/[id]/publish/route";

const mockParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns campaign details", async () => {
    const mockCampaign = {
      id: "c-1",
      title: "Test Campaign",
      entity: { id: "e-1", name: "Entity" },
      backings: [],
      _count: { backings: 0, interests: 0 },
    };
    (prisma.campaign.findUnique as any).mockResolvedValue(mockCampaign);

    const req = createRequest("/api/campaigns/c-1");
    const res = await GET(req, mockParams("c-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.campaign.id).toBe("c-1");
  });

  it("returns 404 when campaign not found", async () => {
    (prisma.campaign.findUnique as any).mockResolvedValue(null);

    const req = createRequest("/api/campaigns/nonexistent");
    const res = await GET(req, mockParams("nonexistent"));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

describe("POST /api/campaigns/[id]/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createRequest("/api/campaigns/c-1/publish", { method: "POST" });
    const res = await publishPOST(req, mockParams("c-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("publishes a draft campaign", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "DRAFT",
      entity: { ownerId: "user-1" },
    });

    const mockUpdated = { id: "c-1", status: "OPEN" };
    (prisma.campaign.update as any).mockResolvedValue(mockUpdated);

    const req = createRequest("/api/campaigns/c-1/publish", { method: "POST" });
    const res = await publishPOST(req, mockParams("c-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.campaign.status).toBe("OPEN");
  });

  it("returns 404 when campaign not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue(null);

    const req = createRequest("/api/campaigns/c-1/publish", { method: "POST" });
    const res = await publishPOST(req, mockParams("nonexistent"));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 when user does not own entity", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "DRAFT",
      entity: { ownerId: "other-user" },
    });

    const req = createRequest("/api/campaigns/c-1/publish", { method: "POST" });
    const res = await publishPOST(req, mockParams("c-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 when campaign is not draft", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      status: "OPEN",
      entity: { ownerId: "user-1" },
    });

    const req = createRequest("/api/campaigns/c-1/publish", { method: "POST" });
    const res = await publishPOST(req, mockParams("c-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
