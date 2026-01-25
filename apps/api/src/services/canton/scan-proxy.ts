/**
 * Canton Scan-Proxy Client (CIP-56)
 *
 * Handles token operations that require disclosed contracts.
 * Based on Settla's scan-proxy-client patterns.
 */

import { config } from "../../config.js";
import type { DisclosedContract } from "./client.js";

// ============================================================================
// Types
// ============================================================================

interface DsoPartyResponse {
  dso_party_id?: string;
  dsoPartyId?: string;
}

interface AllocationContext {
  factoryCid: string;
  disclosedContracts: DisclosedContract[];
  extraArgs: Record<string, unknown>;
}

interface TransferContext {
  transferCid: string;
  disclosedContracts: DisclosedContract[];
}

// ============================================================================
// DSO Party
// ============================================================================

/**
 * Get DSO Party ID from scan-proxy
 */
export async function getDsoPartyId(authToken: string): Promise<string | null> {
  const url = `${config.VALIDATOR_HOST}/api/validator/v0/scan-proxy/dso-party-id`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[ScanProxy] Failed to get DSO party: ${response.status}`);
      return null;
    }

    const data: DsoPartyResponse = await response.json();
    return data.dso_party_id || data.dsoPartyId || null;
  } catch (error) {
    console.error("[ScanProxy] Error fetching DSO party:", error);
    return null;
  }
}

// ============================================================================
// CC Allocation (for locking CC to entity)
// ============================================================================

/**
 * Get allocation factory context for locking CC
 */
export async function getAllocationFactoryContext(
  dsoPartyId: string,
  amount: bigint,
  receiverPartyId: string,
  authToken: string
): Promise<AllocationContext | null> {
  const url = `${config.VALIDATOR_HOST}/api/validator/v0/scan-proxy/registry/allocation-instruction/v1/allocation-factory`;

  const payload = {
    choiceArguments: {
      expectedAdmin: dsoPartyId,
      allocation: {
        amount: amount.toString(),
        receiver: receiverPartyId,
        // Additional fields as needed
      },
    },
    excludeDebugFields: true,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[ScanProxy] Failed to get allocation context: ${response.status}`,
        errorText
      );
      return null;
    }

    const data = await response.json();

    return {
      factoryCid: data.factoryId || data.contractId,
      disclosedContracts: data.choiceContext?.disclosedContracts || [],
      extraArgs: data.choiceContext?.extraArgs || {},
    };
  } catch (error) {
    console.error("[ScanProxy] Error getting allocation context:", error);
    return null;
  }
}

// ============================================================================
// Execute Transfer (for completing CC transfer)
// ============================================================================

/**
 * Get execute transfer context with retry for indexing lag
 */
export async function getExecuteTransferContext(
  allocationCid: string,
  authToken: string,
  maxRetries: number = 5,
  retryDelayMs: number = 2000
): Promise<TransferContext | null> {
  const url = `${config.VALIDATOR_HOST}/api/validator/v0/scan-proxy/registry/allocation-instruction/v1/execute-transfer`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allocationCid }),
      });

      if (response.status === 404 && attempt < maxRetries) {
        // Retry on not found (indexing lag)
        console.log(
          `[ScanProxy] Allocation not yet indexed, retrying (${attempt}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[ScanProxy] Failed to get transfer context: ${response.status}`,
          errorText
        );
        return null;
      }

      const data = await response.json();

      return {
        transferCid: data.transferId || data.contractId,
        disclosedContracts: data.choiceContext?.disclosedContracts || [],
      };
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(
          `[ScanProxy] Error on attempt ${attempt}, retrying...`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      console.error("[ScanProxy] Error getting transfer context:", error);
      return null;
    }
  }

  return null;
}

// ============================================================================
// Export
// ============================================================================

export const scanProxyClient = {
  getDsoPartyId,
  getAllocationFactoryContext,
  getExecuteTransferContext,
};

export default scanProxyClient;
