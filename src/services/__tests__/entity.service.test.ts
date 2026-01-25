import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import {
  createEntity,
  getEntityById,
  getEntityByPartyId,
  listEntities,
  claimEntity,
  updateEntityCurrentAmount,
  updateEntity,
} from "../entity.service";
import { MIN_CC_DISPLAY, GRACE_PERIOD_DAYS } from "@/lib/constants";

describe("entity.service", () => {
  describe("createEntity", () => {
    it("creates FEATURED_APP with correct target and grace period", async () => {
      (prisma.entity.create as any).mockImplementation(async (args: any) => ({
        id: "entity-1",
        ...args.data,
      }));

      const result = await createEntity({
        type: "FEATURED_APP",
        name: "Test App",
        partyId: "party-123",
      });

      expect(prisma.entity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetAmount: MIN_CC_DISPLAY.FEATURED_APP,
          gracePeriodDays: GRACE_PERIOD_DAYS.FEATURED_APP,
          claimStatus: "UNCLAIMED",
          claimedAt: null,
        }),
      });
    });

    it("creates VALIDATOR with correct target and grace period", async () => {
      (prisma.entity.create as any).mockImplementation(async (args: any) => ({
        id: "entity-1",
        ...args.data,
      }));

      await createEntity({
        type: "VALIDATOR",
        name: "Test Validator",
        partyId: "party-456",
      });

      expect(prisma.entity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetAmount: MIN_CC_DISPLAY.VALIDATOR,
          gracePeriodDays: GRACE_PERIOD_DAYS.VALIDATOR,
        }),
      });
    });

    it("sets SELF_REGISTERED when ownerId is provided", async () => {
      (prisma.entity.create as any).mockImplementation(async (args: any) => ({
        id: "entity-1",
        ...args.data,
      }));

      await createEntity({
        type: "FEATURED_APP",
        name: "My App",
        partyId: "party-789",
        ownerId: "user-1",
      });

      expect(prisma.entity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          claimStatus: "SELF_REGISTERED",
          claimedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("getEntityById", () => {
    it("returns entity with owner, campaigns, and backing count", async () => {
      const mockEntity = {
        id: "entity-1",
        name: "Test",
        owner: { id: "user-1", name: "Owner" },
        campaigns: [],
        _count: { backings: 5 },
      };

      (prisma.entity.findUnique as any).mockResolvedValue(mockEntity);

      const result = await getEntityById("entity-1");

      expect(result).toEqual(mockEntity);
      expect(prisma.entity.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "entity-1" },
          include: expect.objectContaining({
            owner: expect.any(Object),
            campaigns: expect.any(Object),
            _count: expect.any(Object),
          }),
        })
      );
    });
  });

  describe("getEntityByPartyId", () => {
    it("returns entity by partyId", async () => {
      const mockEntity = { id: "entity-1", partyId: "party-123" };
      (prisma.entity.findUnique as any).mockResolvedValue(mockEntity);

      const result = await getEntityByPartyId("party-123");

      expect(result?.partyId).toBe("party-123");
      expect(prisma.entity.findUnique).toHaveBeenCalledWith({
        where: { partyId: "party-123" },
      });
    });

    it("returns null for unknown partyId", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(null);

      const result = await getEntityByPartyId("unknown");
      expect(result).toBeNull();
    });
  });

  describe("listEntities", () => {
    it("returns paginated results", async () => {
      (prisma.entity.findMany as any).mockResolvedValue([{ id: "e-1" }]);
      (prisma.entity.count as any).mockResolvedValue(50);

      const result = await listEntities({ page: 2, limit: 10 });

      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(5);
      expect(result.page).toBe(2);
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

      await listEntities({ type: "VALIDATOR" as any });

      expect(prisma.entity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "VALIDATOR" }),
        })
      );
    });

    it("filters by claimStatus", async () => {
      (prisma.entity.findMany as any).mockResolvedValue([]);
      (prisma.entity.count as any).mockResolvedValue(0);

      await listEntities({ claimStatus: "UNCLAIMED" as any });

      expect(prisma.entity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ claimStatus: "UNCLAIMED" }),
        })
      );
    });

    it("supports text search on name and partyId", async () => {
      (prisma.entity.findMany as any).mockResolvedValue([]);
      (prisma.entity.count as any).mockResolvedValue(0);

      await listEntities({ search: "test" });

      expect(prisma.entity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: "test", mode: "insensitive" } }),
              expect.objectContaining({ partyId: { contains: "test", mode: "insensitive" } }),
            ]),
          }),
        })
      );
    });
  });

  describe("claimEntity", () => {
    it("updates claim status and sets owner", async () => {
      const mockEntity = {
        id: "entity-1",
        claimStatus: "CLAIMED",
        ownerId: "user-1",
        claimedAt: new Date(),
      };

      (prisma.entity.update as any).mockResolvedValue(mockEntity);

      const result = await claimEntity("entity-1", "user-1");

      expect(result.claimStatus).toBe("CLAIMED");
      expect(prisma.entity.update).toHaveBeenCalledWith({
        where: { id: "entity-1" },
        data: expect.objectContaining({
          claimStatus: "CLAIMED",
          ownerId: "user-1",
          claimedAt: expect.any(Date),
        }),
      });
    });
  });

  describe("updateEntityCurrentAmount", () => {
    it("aggregates active backings", async () => {
      (prisma.backing.aggregate as any).mockResolvedValue({
        _sum: { amount: 100000 },
      });
      (prisma.entity.update as any).mockResolvedValue({ id: "e-1", currentAmount: 100000 });

      await updateEntityCurrentAmount("entity-1");

      expect(prisma.backing.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entityId: "entity-1",
            status: { in: ["PLEDGED", "LOCKED"] },
          },
        })
      );
    });
  });

  describe("updateEntity", () => {
    it("updates entity fields", async () => {
      const mockEntity = {
        id: "entity-1",
        name: "Updated Name",
        description: "New desc",
        owner: { id: "user-1", name: "Owner" },
      };

      (prisma.entity.update as any).mockResolvedValue(mockEntity);

      const result = await updateEntity("entity-1", {
        name: "Updated Name",
        description: "New desc",
      });

      expect(result.name).toBe("Updated Name");
      expect(prisma.entity.update).toHaveBeenCalledWith({
        where: { id: "entity-1" },
        data: { name: "Updated Name", description: "New desc" },
        include: expect.objectContaining({ owner: expect.any(Object) }),
      });
    });
  });
});
