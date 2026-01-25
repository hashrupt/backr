import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import {
  registerInterest,
  getInterestById,
  getUserInterests,
  getCampaignInterests,
  reviewInterest,
  withdrawInterest,
  sendInvite,
  getUserInvites,
  respondToInvite,
  getCampaignInvites,
} from "../interest.service";

describe("interest.service", () => {
  describe("registerInterest", () => {
    it("creates interest with PENDING status", async () => {
      const mockInterest = {
        id: "interest-1",
        userId: "user-1",
        campaignId: "campaign-1",
        pledgeAmount: 1000,
        status: "PENDING",
      };

      (prisma.interest.create as any).mockResolvedValue(mockInterest);

      const result = await registerInterest({
        userId: "user-1",
        campaignId: "campaign-1",
        pledgeAmount: 1000,
      });

      expect(result.status).toBe("PENDING");
      expect(prisma.interest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-1",
          campaignId: "campaign-1",
          pledgeAmount: 1000,
          status: "PENDING",
        }),
      });
    });

    it("includes optional message when provided", async () => {
      (prisma.interest.create as any).mockResolvedValue({ id: "i-1" });

      await registerInterest({
        userId: "user-1",
        campaignId: "campaign-1",
        pledgeAmount: 500,
        message: "I'm interested",
      });

      expect(prisma.interest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: "I'm interested",
        }),
      });
    });
  });

  describe("getInterestById", () => {
    it("returns interest with user and campaign relations", async () => {
      const mockInterest = {
        id: "interest-1",
        user: { id: "user-1", name: "Test" },
        campaign: { entity: { id: "entity-1" } },
      };

      (prisma.interest.findUnique as any).mockResolvedValue(mockInterest);

      const result = await getInterestById("interest-1");

      expect(result).toEqual(mockInterest);
      expect(prisma.interest.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "interest-1" } })
      );
    });
  });

  describe("getUserInterests", () => {
    it("returns interests ordered by createdAt desc", async () => {
      (prisma.interest.findMany as any).mockResolvedValue([]);

      await getUserInterests("user-1");

      expect(prisma.interest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("getCampaignInterests", () => {
    it("returns all interests for a campaign", async () => {
      (prisma.interest.findMany as any).mockResolvedValue([]);

      await getCampaignInterests("campaign-1");

      expect(prisma.interest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: "campaign-1" },
        })
      );
    });

    it("filters by status when provided", async () => {
      (prisma.interest.findMany as any).mockResolvedValue([]);

      await getCampaignInterests("campaign-1", "PENDING" as any);

      expect(prisma.interest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: "campaign-1", status: "PENDING" },
        })
      );
    });
  });

  describe("reviewInterest", () => {
    it("accepts an interest with review date", async () => {
      const mockUpdated = {
        id: "interest-1",
        status: "ACCEPTED",
        reviewedAt: new Date(),
      };

      (prisma.interest.update as any).mockResolvedValue(mockUpdated);

      const result = await reviewInterest("interest-1", "ACCEPTED" as any);

      expect(result.status).toBe("ACCEPTED");
      expect(prisma.interest.update).toHaveBeenCalledWith({
        where: { id: "interest-1" },
        data: expect.objectContaining({
          status: "ACCEPTED",
          reviewedAt: expect.any(Date),
        }),
      });
    });

    it("declines an interest with optional review note", async () => {
      (prisma.interest.update as any).mockResolvedValue({ id: "i-1", status: "DECLINED" });

      await reviewInterest("interest-1", "DECLINED" as any, "Not enough CC");

      expect(prisma.interest.update).toHaveBeenCalledWith({
        where: { id: "interest-1" },
        data: expect.objectContaining({
          status: "DECLINED",
          reviewNote: "Not enough CC",
        }),
      });
    });
  });

  describe("withdrawInterest", () => {
    it("sets status to WITHDRAWN", async () => {
      (prisma.interest.update as any).mockResolvedValue({ id: "i-1", status: "WITHDRAWN" });

      const result = await withdrawInterest("interest-1");

      expect(result.status).toBe("WITHDRAWN");
      expect(prisma.interest.update).toHaveBeenCalledWith({
        where: { id: "interest-1" },
        data: { status: "WITHDRAWN" },
      });
    });
  });

  describe("sendInvite", () => {
    it("creates invite with PENDING status", async () => {
      const mockInvite = {
        id: "invite-1",
        campaignId: "campaign-1",
        senderId: "user-1",
        recipientId: "user-2",
        status: "PENDING",
      };

      (prisma.campaignInvite.create as any).mockResolvedValue(mockInvite);

      const result = await sendInvite({
        campaignId: "campaign-1",
        senderId: "user-1",
        recipientId: "user-2",
      });

      expect(result.status).toBe("PENDING");
    });

    it("supports email-based invites", async () => {
      (prisma.campaignInvite.create as any).mockResolvedValue({ id: "invite-1" });

      await sendInvite({
        campaignId: "campaign-1",
        senderId: "user-1",
        recipientEmail: "other@test.com",
        message: "Join us!",
        suggestedAmount: 5000,
      });

      expect(prisma.campaignInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientEmail: "other@test.com",
          message: "Join us!",
          suggestedAmount: 5000,
          status: "PENDING",
        }),
      });
    });
  });

  describe("getUserInvites", () => {
    it("returns invites for a recipient", async () => {
      (prisma.campaignInvite.findMany as any).mockResolvedValue([]);

      await getUserInvites("user-1");

      expect(prisma.campaignInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: "user-1" },
          orderBy: { createdAt: "desc" },
        })
      );
    });
  });

  describe("respondToInvite", () => {
    it("accepts an invite with response date", async () => {
      (prisma.campaignInvite.update as any).mockResolvedValue({
        id: "invite-1",
        status: "ACCEPTED",
        respondedAt: new Date(),
      });

      const result = await respondToInvite("invite-1", "ACCEPTED" as any);

      expect(result.status).toBe("ACCEPTED");
      expect(prisma.campaignInvite.update).toHaveBeenCalledWith({
        where: { id: "invite-1" },
        data: expect.objectContaining({
          status: "ACCEPTED",
          respondedAt: expect.any(Date),
        }),
      });
    });

    it("declines an invite", async () => {
      (prisma.campaignInvite.update as any).mockResolvedValue({
        id: "invite-1",
        status: "DECLINED",
      });

      const result = await respondToInvite("invite-1", "DECLINED" as any);
      expect(result.status).toBe("DECLINED");
    });
  });

  describe("getCampaignInvites", () => {
    it("returns invites for a campaign with recipient details", async () => {
      (prisma.campaignInvite.findMany as any).mockResolvedValue([]);

      await getCampaignInvites("campaign-1");

      expect(prisma.campaignInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: "campaign-1" },
        })
      );
    });
  });
});
