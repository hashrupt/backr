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
vi.mock("@/services/canton", () => ({
  cantonService: {
    verifyOwnership: vi.fn(),
  },
}));
vi.mock("@/services/collaboration.service", () => ({
  getCollaborationSuggestions: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { cantonService } from "@/services/canton";
import { getCollaborationSuggestions } from "@/services/collaboration.service";
import { GET, PATCH } from "../entities/[id]/route";
import { POST as claimPOST } from "../entities/[id]/claim/route";
import { GET as collabGET } from "../entities/[id]/collaborations/route";

const mockParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/entities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns entity details", async () => {
    const mockEntity = {
      id: "e-1",
      name: "Test Entity",
      owner: { id: "user-1", name: "Owner" },
      campaigns: [],
      _count: { campaigns: 0, backings: 0 },
    };
    (prisma.entity.findUnique as any).mockResolvedValue(mockEntity);

    const req = createRequest("/api/entities/e-1");
    const res = await GET(req, mockParams("e-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.entity.id).toBe("e-1");
  });

  it("returns 404 when entity not found", async () => {
    (prisma.entity.findUnique as any).mockResolvedValue(null);

    const req = createRequest("/api/entities/nonexistent");
    const res = await GET(req, mockParams("nonexistent"));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });
});

describe("PATCH /api/entities/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createJsonRequest("/api/entities/e-1", { name: "New Name" }, "PATCH");
    const res = await PATCH(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("updates entity successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      ownerId: "user-1",
      claimStatus: "CLAIMED",
    });
    (prisma.entity.update as any).mockResolvedValue({
      id: "e-1",
      name: "Updated Name",
      owner: { id: "user-1", name: "Owner" },
    });

    const req = createJsonRequest("/api/entities/e-1", { name: "Updated Name" }, "PATCH");
    const res = await PATCH(req, mockParams("e-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.entity.name).toBe("Updated Name");
  });

  it("returns 400 when entity is not claimed", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      ownerId: "user-1",
      claimStatus: "UNCLAIMED",
    });

    const req = createJsonRequest("/api/entities/e-1", { name: "New Name" }, "PATCH");
    const res = await PATCH(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 when user does not own entity", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      ownerId: "other-user",
      claimStatus: "CLAIMED",
    });

    const req = createJsonRequest("/api/entities/e-1", { name: "New Name" }, "PATCH");
    const res = await PATCH(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("allows SELF_REGISTERED entities to be edited", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      ownerId: "user-1",
      claimStatus: "SELF_REGISTERED",
    });
    (prisma.entity.update as any).mockResolvedValue({
      id: "e-1",
      name: "Updated",
      owner: { id: "user-1", name: "Owner" },
    });

    const req = createJsonRequest("/api/entities/e-1", { name: "Updated" }, "PATCH");
    const res = await PATCH(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });
});

describe("POST /api/entities/[id]/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = createRequest("/api/entities/e-1/claim", { method: "POST" });
    const res = await claimPOST(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("claims entity successfully", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      partyId: "party-1",
      claimStatus: "UNCLAIMED",
      ownerId: null,
    });
    (prisma.user.findUnique as any).mockResolvedValue({
      partyId: "party-1",
    });
    vi.mocked(cantonService.verifyOwnership).mockResolvedValue(true);
    (prisma.entity.update as any).mockResolvedValue({
      id: "e-1",
      claimStatus: "CLAIMED",
      owner: { id: "user-1", name: "Owner" },
    });

    const req = createRequest("/api/entities/e-1/claim", { method: "POST" });
    const res = await claimPOST(req, mockParams("e-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.entity.claimStatus).toBe("CLAIMED");
  });

  it("returns 400 when entity already claimed", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      partyId: "party-1",
      claimStatus: "CLAIMED",
      ownerId: "other-user",
    });

    const req = createRequest("/api/entities/e-1/claim", { method: "POST" });
    const res = await claimPOST(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 when ownership verification fails", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1" },
      expires: "",
    });
    (prisma.entity.findUnique as any).mockResolvedValue({
      id: "e-1",
      partyId: "party-1",
      claimStatus: "UNCLAIMED",
      ownerId: null,
    });
    (prisma.user.findUnique as any).mockResolvedValue({
      partyId: "party-2", // different partyId
    });
    vi.mocked(cantonService.verifyOwnership).mockResolvedValue(false);

    const req = createRequest("/api/entities/e-1/claim", { method: "POST" });
    const res = await claimPOST(req, mockParams("e-1"));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

describe("GET /api/entities/[id]/collaborations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns collaboration suggestions", async () => {
    const mockResult = {
      entity: { id: "e-1" },
      suggestions: [{ entity: { id: "e-2" }, score: 85 }],
    };
    vi.mocked(getCollaborationSuggestions).mockResolvedValue(mockResult as any);

    const req = createRequest("/api/entities/e-1/collaborations");
    const res = await collabGET(req, mockParams("e-1"));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.suggestions).toHaveLength(1);
  });

  it("uses default limit of 5", async () => {
    vi.mocked(getCollaborationSuggestions).mockResolvedValue({
      entity: {},
      suggestions: [],
    } as any);

    const req = createRequest("/api/entities/e-1/collaborations");
    await collabGET(req, mockParams("e-1"));

    expect(getCollaborationSuggestions).toHaveBeenCalledWith("e-1", 5);
  });

  it("clamps limit between 1 and 10", async () => {
    vi.mocked(getCollaborationSuggestions).mockResolvedValue({
      entity: {},
      suggestions: [],
    } as any);

    const req = createRequest("/api/entities/e-1/collaborations?limit=50");
    await collabGET(req, mockParams("e-1"));

    expect(getCollaborationSuggestions).toHaveBeenCalledWith("e-1", 10);
  });
});
