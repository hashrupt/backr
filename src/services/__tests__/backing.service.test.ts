import { describe, it, expect, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  createBacking,
  getBackingById,
  getUserBackings,
  getEntityBackings,
  requestUnlock,
  completWithdrawal,
  getUnlockingBackings,
} from "../backing.service";
import { UNLOCK_PERIOD_DAYS } from "@/lib/constants";

// Mock the dependent services to prevent chained prisma calls
vi.mock("../entity.service", () => ({
  updateEntityCurrentAmount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../campaign.service", () => ({
  updateCampaignCurrentAmount: vi.fn().mockResolvedValue(undefined),
}));

describe("backing.service", () => {
  describe("createBacking", () => {
    it("creates a backing with PLEDGED status", async () => {
      const mockBacking = {
        id: "backing-1",
        userId: "user-1",
        entityId: "entity-1",
        campaignId: "campaign-1",
        amount: 1000,
        status: "PLEDGED",
      };

      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          backing: { create: vi.fn().mockResolvedValue(mockBacking) },
          interest: { update: vi.fn() },
          campaignInvite: { update: vi.fn() },
        };
        return fn(tx);
      });

      const result = await createBacking({
        userId: "user-1",
        entityId: "entity-1",
        campaignId: "campaign-1",
        amount: 1000,
      });

      expect(result).toEqual(mockBacking);
      expect(result.status).toBe("PLEDGED");
    });

    it("converts interest to CONVERTED when interestId provided", async () => {
      const mockBacking = {
        id: "backing-1",
        userId: "user-1",
        entityId: "entity-1",
        amount: 500,
        status: "PLEDGED",
      };

      const interestUpdate = vi.fn();

      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          backing: { create: vi.fn().mockResolvedValue(mockBacking) },
          interest: { update: interestUpdate },
          campaignInvite: { update: vi.fn() },
        };
        return fn(tx);
      });

      await createBacking({
        userId: "user-1",
        entityId: "entity-1",
        amount: 500,
        interestId: "interest-1",
      });

      expect(interestUpdate).toHaveBeenCalledWith({
        where: { id: "interest-1" },
        data: { status: "CONVERTED" },
      });
    });

    it("converts invite to CONVERTED when inviteId provided", async () => {
      const mockBacking = {
        id: "backing-1",
        userId: "user-1",
        entityId: "entity-1",
        amount: 500,
        status: "PLEDGED",
      };

      const inviteUpdate = vi.fn();

      (prisma.$transaction as any).mockImplementation(async (fn: any) => {
        const tx = {
          backing: { create: vi.fn().mockResolvedValue(mockBacking) },
          interest: { update: vi.fn() },
          campaignInvite: { update: inviteUpdate },
        };
        return fn(tx);
      });

      await createBacking({
        userId: "user-1",
        entityId: "entity-1",
        amount: 500,
        inviteId: "invite-1",
      });

      expect(inviteUpdate).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: { status: "CONVERTED" },
      });
    });
  });

  describe("getBackingById", () => {
    it("returns backing with included relations", async () => {
      const mockBacking = {
        id: "backing-1",
        user: { id: "user-1", name: "Test", email: "test@test.com", partyId: "party-1" },
        entity: { id: "entity-1", name: "Entity", type: "FEATURED_APP" },
        campaign: { id: "campaign-1", title: "Campaign" },
      };

      (prisma.backing.findUnique as any).mockResolvedValue(mockBacking);

      const result = await getBackingById("backing-1");

      expect(result).toEqual(mockBacking);
      expect(prisma.backing.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "backing-1" } })
      );
    });

    it("returns null for non-existent backing", async () => {
      (prisma.backing.findUnique as any).mockResolvedValue(null);

      const result = await getBackingById("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getUserBackings", () => {
    it("returns backings ordered by createdAt desc", async () => {
      const mockBackings = [
        { id: "b-1", userId: "user-1", entity: { id: "e-1", name: "E1" } },
        { id: "b-2", userId: "user-1", entity: { id: "e-2", name: "E2" } },
      ];

      (prisma.backing.findMany as any).mockResolvedValue(mockBackings);

      const result = await getUserBackings("user-1");

      expect(result).toHaveLength(2);
      expect(prisma.backing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("getEntityBackings", () => {
    it("returns backings ordered by amount desc", async () => {
      (prisma.backing.findMany as any).mockResolvedValue([]);

      await getEntityBackings("entity-1");

      expect(prisma.backing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityId: "entity-1" },
          orderBy: { amount: "desc" },
        })
      );
    });
  });

  describe("requestUnlock", () => {
    it("sets status to UNLOCKING with unlock dates", async () => {
      const mockUpdated = {
        id: "backing-1",
        status: "UNLOCKING",
        unlockRequestedAt: new Date(),
        unlockEffectiveAt: new Date(),
      };

      (prisma.backing.update as any).mockResolvedValue(mockUpdated);

      const result = await requestUnlock("backing-1");

      expect(result.status).toBe("UNLOCKING");
      expect(prisma.backing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "backing-1" },
          data: expect.objectContaining({
            status: "UNLOCKING",
            unlockRequestedAt: expect.any(Date),
            unlockEffectiveAt: expect.any(Date),
          }),
        })
      );
    });

    it("sets unlock effective date to UNLOCK_PERIOD_DAYS from now", async () => {
      (prisma.backing.update as any).mockImplementation(async (args: any) => args.data);

      const result = await requestUnlock("backing-1");

      const now = new Date();
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + UNLOCK_PERIOD_DAYS);

      // Allow 2 second tolerance
      const diff = Math.abs(result.unlockEffectiveAt.getTime() - expectedDate.getTime());
      expect(diff).toBeLessThan(2000);
    });
  });

  describe("completWithdrawal", () => {
    it("sets status to WITHDRAWN and updates totals", async () => {
      const mockBacking = {
        id: "backing-1",
        entityId: "entity-1",
        campaignId: "campaign-1",
        status: "WITHDRAWN",
        unlockedAt: new Date(),
      };

      (prisma.backing.update as any).mockResolvedValue(mockBacking);

      const result = await completWithdrawal("backing-1");

      expect(result.status).toBe("WITHDRAWN");
      expect(prisma.backing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "backing-1" },
          data: expect.objectContaining({
            status: "WITHDRAWN",
            unlockedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe("getUnlockingBackings", () => {
    it("returns backings that are ready to unlock", async () => {
      const mockBackings = [
        { id: "b-1", status: "UNLOCKING", unlockEffectiveAt: new Date("2020-01-01") },
      ];

      (prisma.backing.findMany as any).mockResolvedValue(mockBackings);

      const result = await getUnlockingBackings();

      expect(result).toHaveLength(1);
      expect(prisma.backing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "UNLOCKING",
            unlockEffectiveAt: { lte: expect.any(Date) },
          }),
        })
      );
    });
  });
});
