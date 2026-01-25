// Mock Canton Service for Web2 MVP
// TODO: DAML_INTEGRATION - Replace with real Canton/Daml integration

import type {
  ICantonService,
  EntityInfo,
  RewardInfo,
  LockResult,
  UnlockResult,
} from "./types.js";
import { UNLOCK_PERIOD_DAYS } from "@backr/shared";

/**
 * Mock implementation of Canton service for Web2 MVP.
 * All operations are simulated and return mock data.
 * This will be replaced with real Canton/Daml integration later.
 */
class MockCantonService implements ICantonService {
  // Simulated balances for testing
  private mockBalances: Map<string, bigint> = new Map();
  private mockLockedAmounts: Map<string, bigint> = new Map();

  constructor() {
    // Initialize with some mock data
    this.mockBalances.set("default", BigInt("1000000000000000000000000")); // 1M CC
  }

  async validatePartyId(partyId: string): Promise<boolean> {
    return partyId.length > 0;
  }

  async getPartyBalance(partyId: string): Promise<bigint> {
    return (
      this.mockBalances.get(partyId) ||
      BigInt("1000000000000000000000000")
    );
  }

  async verifyEntityPartyId(partyId: string): Promise<EntityInfo | null> {
    if (!partyId) return null;

    return {
      partyId,
      name: `Entity-${partyId.slice(0, 8)}`,
      type: "FEATURED_APP",
      isActive: true,
    };
  }

  async getFoundationStatus(
    _partyId: string
  ): Promise<"PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED"> {
    return "APPROVED";
  }

  async verifyOwnership(
    claimerPartyId: string,
    entityPartyId: string,
    _signature: string
  ): Promise<boolean> {
    return claimerPartyId === entityPartyId;
  }

  async lockCC(
    backerPartyId: string,
    entityPartyId: string,
    amount: bigint
  ): Promise<LockResult> {
    const key = `${backerPartyId}:${entityPartyId}`;
    const currentLocked = this.mockLockedAmounts.get(key) || BigInt(0);
    this.mockLockedAmounts.set(key, currentLocked + amount);

    return {
      success: true,
      txHash: `mock-tx-${Date.now()}`,
      lockedPartyId: `locked-${backerPartyId.slice(0, 8)}`,
    };
  }

  async requestUnlock(
    _backerPartyId: string,
    _entityPartyId: string
  ): Promise<UnlockResult> {
    const unlockEffectiveAt = new Date();
    unlockEffectiveAt.setDate(
      unlockEffectiveAt.getDate() + UNLOCK_PERIOD_DAYS
    );

    return {
      success: true,
      txHash: `mock-unlock-tx-${Date.now()}`,
      unlockEffectiveAt,
    };
  }

  async withdrawCC(
    backerPartyId: string,
    entityPartyId: string
  ): Promise<boolean> {
    const key = `${backerPartyId}:${entityPartyId}`;
    this.mockLockedAmounts.delete(key);
    return true;
  }

  async verifyLockedBalance(
    backerPartyId: string,
    entityPartyId: string
  ): Promise<bigint> {
    const key = `${backerPartyId}:${entityPartyId}`;
    return this.mockLockedAmounts.get(key) || BigInt(0);
  }

  async getEntityRewards(_partyId: string): Promise<RewardInfo> {
    return {
      partyId: _partyId,
      pendingRewards: BigInt(0),
      totalEarned: BigInt(0),
    };
  }

  // Helper method to set mock balance for testing
  setMockBalance(partyId: string, balance: bigint): void {
    this.mockBalances.set(partyId, balance);
  }
}

// Export singleton instance
export const cantonService = new MockCantonService();
export default cantonService;
