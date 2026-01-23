// Canton Network Types

export interface EntityInfo {
  partyId: string;
  name: string;
  type: "FEATURED_APP" | "VALIDATOR";
  isActive: boolean;
}

export interface RewardInfo {
  partyId: string;
  pendingRewards: bigint;
  totalEarned: bigint;
}

export interface LockResult {
  success: boolean;
  txHash?: string;
  lockedPartyId?: string;
  error?: string;
}

export interface UnlockResult {
  success: boolean;
  txHash?: string;
  unlockEffectiveAt?: Date;
  error?: string;
}

// Canton service interface
// TODO: DAML_INTEGRATION - Replace mock implementation with real Canton calls
export interface ICantonService {
  // PartyId operations
  validatePartyId(partyId: string): Promise<boolean>;
  getPartyBalance(partyId: string): Promise<bigint>;

  // Entity verification
  verifyEntityPartyId(partyId: string): Promise<EntityInfo | null>;
  getFoundationStatus(
    partyId: string
  ): Promise<"PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED">;

  // Claim verification (smart contract)
  verifyOwnership(
    claimerPartyId: string,
    entityPartyId: string,
    signature: string
  ): Promise<boolean>;

  // Backing operations
  lockCC(
    backerPartyId: string,
    entityPartyId: string,
    amount: bigint
  ): Promise<LockResult>;

  requestUnlock(
    backerPartyId: string,
    entityPartyId: string
  ): Promise<UnlockResult>;

  withdrawCC(backerPartyId: string, entityPartyId: string): Promise<boolean>;

  // Backing verification
  verifyLockedBalance(
    backerPartyId: string,
    entityPartyId: string
  ): Promise<bigint>;

  // Rewards (future)
  getEntityRewards(partyId: string): Promise<RewardInfo>;
}
