import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import {
  createCampaign,
  getCampaignById,
  listOpenCampaigns,
  publishCampaign,
  closeCampaign,
  getCampaignsByEntity,
  updateCampaignCurrentAmount,
} from "../campaign.service";

describe("campaign.service", () => {
  describe("createCampaign", () => {
    it("creates a campaign with DRAFT status", async () => {
      const mockCampaign = {
        id: "campaign-1",
        entityId: "entity-1",
        title: "Test Campaign",
        targetAmount: 50000,
        status: "DRAFT",
      };

      (prisma.campaign.create as any).mockResolvedValue(mockCampaign);

      const result = await createCampaign({
        entityId: "entity-1",
        title: "Test Campaign",
        targetAmount: 50000,
      });

      expect(result.status).toBe("DRAFT");
      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityId: "entity-1",
          title: "Test Campaign",
          targetAmount: 50000,
          status: "DRAFT",
        }),
      });
    });

    it("includes optional fields when provided", async () => {
      (prisma.campaign.create as any).mockResolvedValue({ id: "c-1" });

      await createCampaign({
        entityId: "entity-1",
        title: "Full Campaign",
        targetAmount: 100000,
        minContribution: 100,
        maxContribution: 50000,
        terms: "Some terms",
        endsAt: new Date("2025-12-31"),
      });

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          minContribution: 100,
          maxContribution: 50000,
          terms: "Some terms",
        }),
      });
    });
  });

  describe("getCampaignById", () => {
    it("returns campaign with entity, owner, and counts", async () => {
      const mockCampaign = {
        id: "campaign-1",
        entity: { owner: { id: "user-1", name: "Owner" } },
        _count: { interests: 5, invites: 2, backings: 3 },
      };

      (prisma.campaign.findUnique as any).mockResolvedValue(mockCampaign);

      const result = await getCampaignById("campaign-1");

      expect(result).toEqual(mockCampaign);
      expect(result?._count.backings).toBe(3);
    });

    it("returns null for non-existent campaign", async () => {
      (prisma.campaign.findUnique as any).mockResolvedValue(null);

      const result = await getCampaignById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("listOpenCampaigns", () => {
    it("returns paginated results with only OPEN campaigns", async () => {
      const mockItems = [
        { id: "c-1", title: "Campaign 1", status: "OPEN" },
        { id: "c-2", title: "Campaign 2", status: "OPEN" },
      ];

      (prisma.campaign.findMany as any).mockResolvedValue(mockItems);
      (prisma.campaign.count as any).mockResolvedValue(10);

      const result = await listOpenCampaigns({ page: 1, limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(1);
    });

    it("filters by entity type", async () => {
      (prisma.campaign.findMany as any).mockResolvedValue([]);
      (prisma.campaign.count as any).mockResolvedValue(0);

      await listOpenCampaigns({ entityType: "FEATURED_APP" });

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "OPEN",
            entity: { type: "FEATURED_APP" },
          }),
        })
      );
    });

    it("supports text search", async () => {
      (prisma.campaign.findMany as any).mockResolvedValue([]);
      (prisma.campaign.count as any).mockResolvedValue(0);

      await listOpenCampaigns({ search: "defi" });

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: { contains: "defi", mode: "insensitive" } }),
            ]),
          }),
        })
      );
    });
  });

  describe("publishCampaign", () => {
    it("updates status to OPEN and sets startsAt", async () => {
      const mockCampaign = { id: "c-1", status: "OPEN", startsAt: new Date() };

      (prisma.campaign.update as any).mockResolvedValue(mockCampaign);

      const result = await publishCampaign("c-1");

      expect(result.status).toBe("OPEN");
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "c-1" },
        data: expect.objectContaining({
          status: "OPEN",
          startsAt: expect.any(Date),
        }),
      });
    });
  });

  describe("closeCampaign", () => {
    it("updates status to CLOSED", async () => {
      (prisma.campaign.update as any).mockResolvedValue({ id: "c-1", status: "CLOSED" });

      const result = await closeCampaign("c-1");

      expect(result.status).toBe("CLOSED");
      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id: "c-1" },
        data: { status: "CLOSED" },
      });
    });
  });

  describe("getCampaignsByEntity", () => {
    it("returns campaigns for an entity", async () => {
      (prisma.campaign.findMany as any).mockResolvedValue([]);

      await getCampaignsByEntity("entity-1");

      expect(prisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityId: "entity-1" },
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("updateCampaignCurrentAmount", () => {
    it("aggregates PLEDGED and LOCKED backings", async () => {
      (prisma.backing.aggregate as any).mockResolvedValue({
        _sum: { amount: 25000 },
      });
      (prisma.campaign.update as any).mockResolvedValue({ id: "c-1", currentAmount: 25000 });

      const result = await updateCampaignCurrentAmount("c-1");

      expect(prisma.backing.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: "c-1",
            status: { in: ["PLEDGED", "LOCKED"] },
          },
        })
      );
      expect(result.currentAmount).toBe(25000);
    });

    it("sets currentAmount to 0 when no backings exist", async () => {
      (prisma.backing.aggregate as any).mockResolvedValue({
        _sum: { amount: null },
      });
      (prisma.campaign.update as any).mockResolvedValue({ id: "c-1", currentAmount: 0 });

      const result = await updateCampaignCurrentAmount("c-1");
      expect(result.currentAmount).toBe(0);
    });
  });
});
