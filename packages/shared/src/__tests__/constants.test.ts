import { describe, it, expect } from "vitest";
import {
  MIN_CC_REQUIREMENTS,
  MIN_CC_DISPLAY,
  GRACE_PERIOD_DAYS,
  UNLOCK_PERIOD_DAYS,
  CC_DECIMALS,
  formatCC,
  parseCC,
} from "../constants";

describe("constants", () => {
  describe("MIN_CC_REQUIREMENTS", () => {
    it("has correct BigInt values for FEATURED_APP (10M CC with 18 decimals)", () => {
      expect(MIN_CC_REQUIREMENTS.FEATURED_APP).toBe(BigInt("10000000000000000000000000"));
    });

    it("has correct BigInt values for VALIDATOR (1M CC with 18 decimals)", () => {
      expect(MIN_CC_REQUIREMENTS.VALIDATOR).toBe(BigInt("1000000000000000000000000"));
    });
  });

  describe("MIN_CC_DISPLAY", () => {
    it("has correct display values", () => {
      expect(MIN_CC_DISPLAY.FEATURED_APP).toBe(10_000_000);
      expect(MIN_CC_DISPLAY.VALIDATOR).toBe(1_000_000);
    });
  });

  describe("GRACE_PERIOD_DAYS", () => {
    it("has 7 days for FEATURED_APP", () => {
      expect(GRACE_PERIOD_DAYS.FEATURED_APP).toBe(7);
    });

    it("has 30 days for VALIDATOR", () => {
      expect(GRACE_PERIOD_DAYS.VALIDATOR).toBe(30);
    });
  });

  describe("UNLOCK_PERIOD_DAYS", () => {
    it("is 365 days", () => {
      expect(UNLOCK_PERIOD_DAYS).toBe(365);
    });
  });

  describe("CC_DECIMALS", () => {
    it("is 18", () => {
      expect(CC_DECIMALS).toBe(18);
    });
  });

  describe("formatCC", () => {
    it("formats BigInt with 18 decimals to whole number", () => {
      // 1M CC = 1000000 * 10^18
      const amount = BigInt("1000000") * BigInt(10 ** 18);
      const result = formatCC(amount);
      expect(result).toBe("1,000,000");
    });

    it("formats zero", () => {
      expect(formatCC(BigInt(0))).toBe("0");
    });

    it("formats string input", () => {
      const amount = "1000000000000000000000000"; // 1M CC
      expect(formatCC(amount)).toBe("1,000,000");
    });

    it("formats number input", () => {
      // Small number — will be 0 when divided by 10^18
      expect(formatCC(0)).toBe("0");
    });

    it("handles decimal string by taking integer part", () => {
      expect(formatCC("1000000000000000000000000.5")).toBe("1,000,000");
    });

    it("handles object with toString()", () => {
      const prismaDecimal = { toString: () => "1000000000000000000000000" };
      expect(formatCC(prismaDecimal)).toBe("1,000,000");
    });
  });

  describe("parseCC", () => {
    it("converts display amount to raw BigInt with 18 decimals", () => {
      const result = parseCC(1);
      expect(result).toBe(BigInt(10 ** 18));
    });

    it("round-trips with formatCC", () => {
      const displayAmount = 1_000_000;
      const raw = parseCC(displayAmount);
      const formatted = formatCC(raw);
      expect(formatted).toBe("1,000,000");
    });

    it("handles zero", () => {
      expect(parseCC(0)).toBe(BigInt(0));
    });

    it("handles large values", () => {
      const result = parseCC(10_000_000);
      expect(result).toBe(BigInt(10_000_000) * BigInt(10 ** 18));
    });
  });
});
