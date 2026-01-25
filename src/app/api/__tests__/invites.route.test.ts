import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import {
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
import { GET, POST } from "../invites/route";
import { PATCH as respondPATCH } from "../invites/[id]/respond/route";

const mockParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const res = await GET();
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns user invites", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    const mockInvites = [
      { id: "inv-1", campaignId: "c-1", status: "PENDING" },
    ];
    (prisma.campaignInvite.findMany as any).mockResolvedValue(mockInvites);

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.invites).toHaveLength(1);
    expect(prisma.campaignInvite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: "user-1" },
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

describe("POST /api/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest("/api/invites", {
      campaignId: "c-1",
      recipientEmail: "user@test.com",
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("creates invite successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });

    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      entity: { ownerId: "user-1" },
    });
    (prisma.user.findUnique as any).mockResolvedValue({ id: "user-2" });

    const mockInvite = {
      id: "inv-1",
      status: "PENDING",
      recipient: { id: "user-2", name: "Recipient", email: "r@test.com" },
    };
    (prisma.campaignInvite.create as any).mockResolvedValue(mockInvite);

    const req = createJsonRequest("/api/invites", {
      campaignId: "c-1",
      recipientEmail: "r@test.com",
      message: "Join us!",
      suggestedAmount: 5000,
    });

    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.invite.status).toBe("PENDING");
  });

  it("returns 404 when campaign not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaign.findUnique as any).mockResolvedValue(null);

    const req = createJsonRequest("/api/invites", {
      campaignId: "nonexistent",
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
    (prisma.campaign.findUnique as any).mockResolvedValue({
      id: "c-1",
      entity: { ownerId: "other-user" },
    });

    const req = createJsonRequest("/api/invites", {
      campaignId: "c-1",
      recipientEmail: "r@test.com",
    });

    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

describe("PATCH /api/invites/[id]/respond", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest(
      "/api/invites/inv-1/respond",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await respondPATCH(req, mockParams("inv-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("accepts an invite", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaignInvite.findUnique as any).mockResolvedValue({
      id: "inv-1",
      recipientId: "user-1",
      status: "PENDING",
    });

    const mockUpdated = {
      id: "inv-1",
      status: "ACCEPTED",
      campaign: { entity: { id: "e-1", name: "Entity" } },
    };
    (prisma.campaignInvite.update as any).mockResolvedValue(mockUpdated);

    const req = createJsonRequest(
      "/api/invites/inv-1/respond",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await respondPATCH(req, mockParams("inv-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.invite.status).toBe("ACCEPTED");
  });

  it("returns 404 when invite not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaignInvite.findUnique as any).mockResolvedValue(null);

    const req = createJsonRequest(
      "/api/invites/inv-1/respond",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await respondPATCH(req, mockParams("nonexistent"));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 when user is not the recipient", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaignInvite.findUnique as any).mockResolvedValue({
      id: "inv-1",
      recipientId: "other-user",
      status: "PENDING",
    });

    const req = createJsonRequest(
      "/api/invites/inv-1/respond",
      { status: "ACCEPTED" },
      "PATCH"
    );
    const res = await respondPATCH(req, mockParams("inv-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 when invite already responded to", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.campaignInvite.findUnique as any).mockResolvedValue({
      id: "inv-1",
      recipientId: "user-1",
      status: "ACCEPTED", // already responded
    });

    const req = createJsonRequest(
      "/api/invites/inv-1/respond",
      { status: "DECLINED" },
      "PATCH"
    );
    const res = await respondPATCH(req, mockParams("inv-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });
});
