import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createRequest, parseResponse } from "@/test-utils/api-helpers";

import { GET } from "../entities/route";
import { GET as searchGET } from "../entities/search/route";

describe("GET /api/entities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated entities", async () => {
    const mockEntities = [
      { id: "e-1", name: "Entity 1", type: "FEATURED_APP" },
    ];
    (prisma.entity.findMany as any).mockResolvedValue(mockEntities);
    (prisma.entity.count as any).mockResolvedValue(1);

    const req = createRequest("/api/entities");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.entities).toHaveLength(1);
    expect(body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("supports pagination params", async () => {
    (prisma.entity.findMany as any).mockResolvedValue([]);
    (prisma.entity.count as any).mockResolvedValue(50);

    const req = createRequest("/api/entities?page=2&limit=10");
    const res = await GET(req);
    const { body } = await parseResponse(res);

    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(10);
    expect(body.pagination.totalPages).toBe(5);
    expect(prisma.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    );
  });

  it("filters by type", async () => {
    (prisma.entity.findMany as any).mockResolvedValue([]);
    (prisma.entity.count as any).mockResolvedValue(0);

    const req = createRequest("/api/entities?type=VALIDATOR");
    await GET(req);

    expect(prisma.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "VALIDATOR" },
      })
    );
  });
});

describe("GET /api/entities/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches by query string", async () => {
    const mockEntities = [{ id: "e-1", name: "DeFi App" }];
    (prisma.entity.findMany as any).mockResolvedValue(mockEntities);

    const req = createRequest("/api/entities/search?q=DeFi");
    const res = await searchGET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.entities).toHaveLength(1);
    expect(prisma.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "DeFi", mode: "insensitive" } },
            { partyId: { contains: "DeFi", mode: "insensitive" } },
          ],
        }),
      })
    );
  });

  it("filters by type and claimStatus", async () => {
    (prisma.entity.findMany as any).mockResolvedValue([]);

    const req = createRequest(
      "/api/entities/search?type=FEATURED_APP&claimStatus=UNCLAIMED"
    );
    await searchGET(req);

    expect(prisma.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "FEATURED_APP",
          claimStatus: "UNCLAIMED",
        }),
      })
    );
  });

  it("limits results to 20", async () => {
    (prisma.entity.findMany as any).mockResolvedValue([]);

    const req = createRequest("/api/entities/search?q=test");
    await searchGET(req);

    expect(prisma.entity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });
});
