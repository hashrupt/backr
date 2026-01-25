import { describe, it, expect, beforeEach } from "vitest";
import { UNLOCK_PERIOD_DAYS } from "@/lib/constants";

// Import the class directly to create fresh instances per test
// We need to re-import to get fresh state
let cantonService: any;

beforeEach(async () => {
  // Dynamic import to get fresh module state
  const mod = await import("../mock");
  cantonService = mod.cantonService;
});

describe("MockCantonService", () => {
  describe("validatePartyId", () => {
    it("returns true for non-empty partyId", async () => {
      expect(await cantonService.validatePartyId("party-123")).toBe(true);
    });

    it("returns false for empty partyId", async () => {
      expect(await cantonService.validatePartyId("")).toBe(false);
    });
  });

  describe("getPartyBalance", () => {
    it("returns default 1M CC balance", async () => {
      const balance = await cantonService.getPartyBalance("any-party");
      expect(balance).toBe(BigInt("1000000000000000000000000"));
    });

    it("returns custom balance after setMockBalance", () => {
      const customBalance = BigInt("5000000000000000000000000");
      cantonService.setMockBalance("custom-party", customBalance);

      // Note: getPartyBalance is async
      return cantonService.getPartyBalance("custom-party").then((balance: bigint) => {
        expect(balance).toBe(customBalance);
      });
    });
  });

  describe("verifyEntityPartyId", () => {
    it("returns entity info for valid partyId", async () => {
      const info = await cantonService.verifyEntityPartyId("party-123");
      expect(info).not.toBeNull();
      expect(info?.partyId).toBe("party-123");
      expect(info?.type).toBe("FEATURED_APP");
      expect(info?.isActive).toBe(true);
    });

    it("returns null for empty partyId", async () => {
      const info = await cantonService.verifyEntityPartyId("");
      expect(info).toBeNull();
    });
  });

  describe("getFoundationStatus", () => {
    it("always returns APPROVED in mock", async () => {
      expect(await cantonService.getFoundationStatus("any")).toBe("APPROVED");
    });
  });

  describe("verifyOwnership", () => {
    it("returns true when claimer and entity partyIds match", async () => {
      expect(await cantonService.verifyOwnership("party-1", "party-1", "sig")).toBe(true);
    });

    it("returns false when partyIds differ", async () => {
      expect(await cantonService.verifyOwnership("party-1", "party-2", "sig")).toBe(false);
    });
  });

  describe("lockCC", () => {
    it("returns success with txHash", async () => {
      const result = await cantonService.lockCC("backer-1", "entity-1", BigInt(1000));

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^mock-tx-/);
      expect(result.lockedPartyId).toContain("locked-");
    });

    it("accumulates locked amounts", async () => {
      await cantonService.lockCC("backer-accum", "entity-accum", BigInt(1000));
      await cantonService.lockCC("backer-accum", "entity-accum", BigInt(2000));

      const locked = await cantonService.verifyLockedBalance("backer-accum", "entity-accum");
      expect(locked).toBe(BigInt(3000));
    });
  });

  describe("requestUnlock", () => {
    it("returns success with unlock effective date", async () => {
      const result = await cantonService.requestUnlock("backer-1", "entity-1");

      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^mock-unlock-tx-/);
      expect(result.unlockEffectiveAt).toBeInstanceOf(Date);

      // Should be UNLOCK_PERIOD_DAYS from now
      const now = new Date();
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + UNLOCK_PERIOD_DAYS);

      const diff = Math.abs(
        result.unlockEffectiveAt.getTime() - expectedDate.getTime()
      );
      expect(diff).toBeLessThan(2000); // 2 second tolerance
    });
  });

  describe("withdrawCC", () => {
    it("returns true and clears locked amount", async () => {
      // Lock first
      await cantonService.lockCC("backer-1", "entity-1", BigInt(1000));

      // Withdraw
      const result = await cantonService.withdrawCC("backer-1", "entity-1");
      expect(result).toBe(true);

      // Verify cleared
      const locked = await cantonService.verifyLockedBalance("backer-1", "entity-1");
      expect(locked).toBe(BigInt(0));
    });
  });

  describe("verifyLockedBalance", () => {
    it("returns 0 for non-locked pair", async () => {
      const locked = await cantonService.verifyLockedBalance("unknown", "unknown");
      expect(locked).toBe(BigInt(0));
    });
  });

  describe("getEntityRewards", () => {
    it("returns zero rewards in mock", async () => {
      const rewards = await cantonService.getEntityRewards("party-1");

      expect(rewards.partyId).toBe("party-1");
      expect(rewards.pendingRewards).toBe(BigInt(0));
      expect(rewards.totalEarned).toBe(BigInt(0));
    });
  });
});
