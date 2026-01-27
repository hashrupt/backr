/**
 * Canton JSON API v2 Client
 *
 * Handles ledger interactions for Backr contracts.
 * Based on Settla's canton-client patterns.
 */

import { config } from "../../config.js";

// ============================================================================
// Types
// ============================================================================

export interface ActiveContract {
  contractId: string;
  templateId: string;
  payload: Record<string, unknown>;
}

export interface CreatedContract {
  contractId: string;
  templateId: string;
}

export interface CommandResult {
  success: boolean;
  contractId?: string;
  createdContracts?: CreatedContract[];
  error?: string;
}

export interface DisclosedContract {
  contractId: string;
  templateId: string;
  createdEventBlob: string;
}

export interface CantonHealthStatus {
  connected: boolean;
  ledgerTime?: string;
  participantId?: string;
  error?: string;
}

// ============================================================================
// Template IDs (to be updated when DAML contracts are written)
// ============================================================================

export const TEMPLATE_IDS = {
  // Operator contracts
  Operator: "Backr.Operator:Operator",
  OperatorInvite: "Backr.Operator:OperatorInvite",

  // App validation contracts
  FeeRequest: "Backr.FeeRequest:ValidateApplicationOwnershipFeeRequest",
  AllocationRequest:
    "Backr.AllocationRequest:BackrApplicationOwnershipAllocationRequest",
  ValidatedApp: "Backr.ValidatedApp:BackrValidatedApplication",

  // Campaign contracts
  Campaign: "Backr.Campaign:BackingCampaign",
};

export const CHOICES = {
  Operator: {
    InviteAppForValidation: "InviteAppForValidation",
    UpdateFeeConfig: "UpdateFeeConfig",
  },
  OperatorInvite: {
    AcceptOperatorInvite: "AcceptOperatorInvite",
  },
  FeeRequest: {
    ValidateNAcceptAppOwnershipFee: "ValidateNAcceptAppOwnershipFee",
    RejectFeeRequest: "RejectFeeRequest",
    CancelFeeRequest: "CancelFeeRequest",
  },
  AllocationRequest: {
    AllocateFunds: "AllocateFunds",
    ExecuteTransfer: "ExecuteTransfer",
    WithdrawAllocation: "WithdrawAllocation",
    ExpireAllocation: "ExpireAllocation",
  },
  ValidatedApp: {
    UpdateAppMetadata: "UpdateAppMetadata",
    CreateCampaign: "CreateCampaign",
    DeactivateApp: "DeactivateApp",
    ReactivateApp: "ReactivateApp",
  },
  Campaign: {
    UpdateCampaignGoal: "UpdateCampaignGoal",
    OpenCampaign: "OpenCampaign",
    CloseCampaign: "CloseCampaign",
    CancelCampaign: "CancelCampaign",
  },
};

// ============================================================================
// Helpers
// ============================================================================

function getParticipantUrl(): string {
  const protocol = config.CANTON_USE_TLS ? "https" : "http";
  return `${protocol}://${config.CANTON_LEDGER_HOST}:${config.CANTON_LEDGER_PORT}`;
}

function toCantonTemplateId(templateId: string): string {
  // If already has package prefix, use as-is
  if (templateId.startsWith("#") || templateId.split(":").length === 3) {
    return templateId;
  }
  // Add backr package prefix
  return `#backr:${templateId}`;
}

function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Extract party ID from JWT token
 */
export function extractPartyFromToken(authToken: string): string | null {
  try {
    const parts = authToken.split(".");
    if (parts.length !== 3) return null;

    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";

    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return decoded.sub || null;
  } catch {
    return null;
  }
}

/**
 * Get user's primary party from Canton
 */
async function getUserParty(authToken: string): Promise<string | null> {
  const userId = extractPartyFromToken(authToken);
  if (!userId) return null;

  // If already looks like a party ID (contains ::), use directly
  if (userId.includes("::")) {
    return userId;
  }

  // Otherwise query Canton user management API
  const participantUrl = getParticipantUrl();
  try {
    const response = await fetch(`${participantUrl}/v2/users/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.user?.primaryParty || null;
    }
  } catch (error) {
    console.error("[Canton] Failed to get user party:", error);
  }

  return userId; // Fallback to userId
}

/**
 * Get current ledger offset
 */
async function getLedgerOffset(authToken?: string): Promise<string> {
  const participantUrl = getParticipantUrl();
  const token = authToken || config.CANTON_AUTH_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${participantUrl}/v2/state/ledger-end`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to get ledger offset: ${response.status}`);
  }

  const data = await response.json();
  return data.offset || "";
}

// ============================================================================
// Contract Operations
// ============================================================================

/**
 * Query active contracts by template
 */
export async function queryContracts(
  templateId: string,
  authToken?: string
): Promise<ActiveContract[]> {
  const participantUrl = getParticipantUrl();
  const token = authToken || config.CANTON_AUTH_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Get current offset
  const offset = await getLedgerOffset(token);

  // Get party ID from token
  let partyId: string | null = null;
  if (token) {
    partyId = await getUserParty(token);
  }

  if (!partyId) {
    throw new Error("Could not determine party ID from auth token");
  }

  const cantonTemplateId = toCantonTemplateId(templateId);

  // Build filter with TemplateFilter
  const filter = {
    filtersByParty: {
      [partyId]: {
        cumulative: [
          {
            identifierFilter: {
              TemplateFilter: {
                value: {
                  templateId: cantonTemplateId,
                  includeCreatedEventBlob: false,
                },
              },
            },
          },
        ],
      },
    },
  };

  const response = await fetch(`${participantUrl}/v2/state/active-contracts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      verbose: true,
      activeAtOffset: offset,
      filter,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to query contracts: ${response.status} ${errorText}`
    );
  }

  const data = await response.json();
  const results: ActiveContract[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      const contract = item?.contractEntry?.JsActiveContract?.createdEvent;
      if (contract) {
        results.push({
          contractId: contract.contractId,
          templateId: contract.templateId || "",
          payload: contract.createArgument || contract.payload || {},
        });
      }
    }
  }

  return results;
}

/**
 * Exercise a choice on a contract
 */
export async function exerciseChoice(
  contractId: string,
  templateId: string,
  choice: string,
  argument: Record<string, unknown> = {},
  authToken?: string,
  disclosedContracts?: DisclosedContract[]
): Promise<CommandResult> {
  const participantUrl = getParticipantUrl();
  const token = authToken || config.CANTON_AUTH_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Get party ID
  let actAs: string[] = [];
  if (token) {
    const partyId = await getUserParty(token);
    if (partyId) {
      actAs = [partyId];
    }
  }

  if (actAs.length === 0) {
    return { success: false, error: "Could not determine actAs party" };
  }

  const commands: Record<string, unknown> = {
    commandId: generateCommandId(),
    actAs,
    commands: [
      {
        ExerciseCommand: {
          contractId,
          templateId: toCantonTemplateId(templateId),
          choice,
          choiceArgument: argument,
        },
      },
    ],
    workflowId: `backr-api-${Date.now()}`,
    applicationId: "backr-api",
  };

  // Add disclosed contracts for CIP-56 if provided
  if (disclosedContracts && disclosedContracts.length > 0) {
    commands.disclosedContracts = disclosedContracts;
  }

  const response = await fetch(
    `${participantUrl}/v2/commands/submit-and-wait-for-transaction`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ commands }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.cause || errorData.message || `HTTP ${response.status}`,
    };
  }

  const data = await response.json();

  // Extract created contracts from events
  const createdContracts: CreatedContract[] = [];
  const events = data.transaction?.events || data.completion?.events || [];

  for (const event of events) {
    if (event.CreatedEvent?.contractId) {
      createdContracts.push({
        contractId: event.CreatedEvent.contractId,
        templateId: event.CreatedEvent.templateId || "",
      });
    }
  }

  return {
    success: true,
    contractId: createdContracts[0]?.contractId,
    createdContracts,
  };
}

/**
 * Create a contract
 */
export async function createContract(
  templateId: string,
  payload: Record<string, unknown>,
  authToken?: string
): Promise<CommandResult> {
  const participantUrl = getParticipantUrl();
  const token = authToken || config.CANTON_AUTH_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Get party ID
  let actAs: string[] = [];
  if (token) {
    const partyId = await getUserParty(token);
    if (partyId) {
      actAs = [partyId];
    }
  }

  if (actAs.length === 0) {
    return { success: false, error: "Could not determine actAs party" };
  }

  const commands = {
    commandId: generateCommandId(),
    actAs,
    commands: [
      {
        CreateCommand: {
          templateId: toCantonTemplateId(templateId),
          createArgument: payload,
        },
      },
    ],
    workflowId: `backr-api-${Date.now()}`,
    applicationId: "backr-api",
  };

  const response = await fetch(
    `${participantUrl}/v2/commands/submit-and-wait-for-transaction`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ commands }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: errorData.cause || errorData.message || `HTTP ${response.status}`,
    };
  }

  const data = await response.json();

  // Extract created contract
  const events = data.transaction?.events || [];
  for (const event of events) {
    if (event.CreatedEvent?.contractId) {
      return {
        success: true,
        contractId: event.CreatedEvent.contractId,
        createdContracts: [
          {
            contractId: event.CreatedEvent.contractId,
            templateId: event.CreatedEvent.templateId || templateId,
          },
        ],
      };
    }
  }

  return { success: true };
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check Canton ledger connectivity
 */
export async function checkHealth(
  authToken?: string
): Promise<CantonHealthStatus> {
  const participantUrl = getParticipantUrl();
  const token = authToken || config.CANTON_AUTH_TOKEN;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${participantUrl}/v2/state/ledger-end`, {
      method: "GET",
      headers,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        connected: true,
        ledgerTime: data.offset || data.ledgerEnd,
        participantId: data.participantId,
      };
    }

    if (response.status === 401) {
      return {
        connected: true,
        error: "Authentication required",
      };
    }

    return {
      connected: false,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

// ============================================================================
// Export Canton Client
// ============================================================================

export const cantonClient = {
  queryContracts,
  exerciseChoice,
  createContract,
  checkHealth,
  extractPartyFromToken,
  TEMPLATE_IDS,
  CHOICES,
};

export default cantonClient;
