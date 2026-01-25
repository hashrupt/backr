import { describe, it, expect } from "vitest";
import { getKeywordIcon, extractOneLiner } from "../keyword-icons";

describe("keyword-icons", () => {
  describe("getKeywordIcon", () => {
    it("returns correct icon for known finance keywords", () => {
      expect(getKeywordIcon("DeFi")).toBe("💱");
      expect(getKeywordIcon("Lending")).toBe("🏦");
      expect(getKeywordIcon("Staking")).toBe("🔒");
    });

    it("returns correct icon for infrastructure keywords", () => {
      expect(getKeywordIcon("Validator")).toBe("✅");
      expect(getKeywordIcon("Bridge")).toBe("🌉");
      expect(getKeywordIcon("API")).toBe("⚡");
    });

    it("returns correct icon for identity keywords", () => {
      expect(getKeywordIcon("KYC")).toBe("🆔");
      expect(getKeywordIcon("Compliance")).toBe("⚖️");
      expect(getKeywordIcon("Privacy")).toBe("🔒");
    });

    it("returns correct icon for gaming keywords", () => {
      expect(getKeywordIcon("Gaming")).toBe("🎮");
      expect(getKeywordIcon("Metaverse")).toBe("🌐");
    });

    it("returns correct icon for Canton-specific keywords", () => {
      expect(getKeywordIcon("Daml")).toBe("📜");
      expect(getKeywordIcon("Canton Coin")).toBe("🪙");
    });

    it("returns default icon for unknown keywords", () => {
      expect(getKeywordIcon("UnknownKeyword")).toBe("🏷️");
      expect(getKeywordIcon("")).toBe("🏷️");
      expect(getKeywordIcon("random text")).toBe("🏷️");
    });
  });

  describe("extractOneLiner", () => {
    it("returns null for null input", () => {
      expect(extractOneLiner(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(extractOneLiner(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractOneLiner("")).toBeNull();
    });

    it("returns first sentence when short enough", () => {
      expect(extractOneLiner("This is a short sentence.")).toBe("This is a short sentence.");
    });

    it("returns first sentence ending with period", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      expect(extractOneLiner(text)).toBe("First sentence.");
    });

    it("returns first sentence ending with exclamation", () => {
      expect(extractOneLiner("Hello world! More text here.")).toBe("Hello world!");
    });

    it("returns first sentence ending with question mark", () => {
      expect(extractOneLiner("What is this? It is a test.")).toBe("What is this?");
    });

    it("truncates at word boundary when over 100 chars", () => {
      const longText =
        "This is a very long description that goes on and on and on and keeps going beyond the hundred character limit without any punctuation";
      const result = extractOneLiner(longText);

      expect(result).not.toBeNull();
      expect(result!.endsWith("...")).toBe(true);
      // The part before "..." should be <= 100 chars
      expect(result!.length).toBeLessThanOrEqual(103); // 100 + "..."
    });

    it("handles text without sentence-ending punctuation", () => {
      const text = "A short phrase";
      expect(extractOneLiner(text)).toBe("A short phrase");
    });
  });
});
