/**
 * Backr E2E Ledger Helpers
 *
 * Provides helpers for querying Canton ledger contracts and
 * calling the Backr REST API from Playwright tests.
 */

import { getAccessToken, getServiceAccountToken, UserRole } from './auth';

// Configuration
const PARTICIPANT_URL = process.env.PARTICIPANT_URL || 'http://localhost:3975';
const API_URL = process.env.BACKR_API_URL || 'http://localhost:4001';

/**
 * Get the current ledger offset
 */
async function getLedgerOffset(token: string): Promise<string> {
  const response = await fetch(`${PARTICIPANT_URL}/v2/state/ledger-end`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return '0';
  }

  const data = await response.json();
  return data.offset || '0';
}

/**
 * Get user's primary party from Canton
 */
async function getUserParty(token: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode base64url to base64
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';

    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    const userId = decoded.sub;

    if (!userId) return null;

    // If already looks like a party ID, use directly
    if (userId.includes('::')) {
      return userId;
    }

    // Query Canton user management to get party
    const response = await fetch(`${PARTICIPANT_URL}/v2/users/${userId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.user?.primaryParty || null;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * Query active contracts on the ledger
 */
export async function queryContracts(
  user: UserRole,
  templateId: string
): Promise<any[]> {
  const token = await getAccessToken(user);
  const offset = await getLedgerOffset(token);

  const partyId = await getUserParty(token);
  if (!partyId) {
    console.log('Could not determine party ID from token');
    return [];
  }

  // Convert template ID to Canton format with #backr: prefix
  let cantonTemplateId = templateId;
  if (!templateId.startsWith('#') && templateId.split(':').length !== 3) {
    cantonTemplateId = `#backr:${templateId}`;
  }

  const response = await fetch(`${PARTICIPANT_URL}/v2/state/active-contracts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      verbose: true,
      activeAtOffset: offset,
      filter: {
        filtersByParty: {
          [partyId]: {
            cumulative: [{
              identifierFilter: {
                TemplateFilter: {
                  value: {
                    templateId: cantonTemplateId,
                    includeCreatedEventBlob: false,
                  },
                },
              },
            }],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to query contracts: ${response.status} ${text}`);
  }

  const data = await response.json();

  // Parse response - Canton v2 returns array with contractEntry structure
  const results: any[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      const contract = item?.contractEntry?.JsActiveContract?.createdEvent;
      if (contract) {
        results.push({
          contractId: contract.contractId,
          templateId: contract.templateId || '',
          payload: contract.createArgument || contract.createArguments || contract.payload || {},
          createdAt: contract.createdAt,
        });
      }
    }
  }

  return results;
}

/**
 * Query fee requests visible to the user
 */
export async function queryFeeRequests(user: UserRole): Promise<any[]> {
  return queryContracts(user, 'Backr.FeeRequest:ValidateApplicationOwnershipFeeRequest');
}

/**
 * Query allocation requests visible to the user
 */
export async function queryAllocationRequests(user: UserRole): Promise<any[]> {
  return queryContracts(user, 'Backr.AllocationRequest:BackrApplicationOwnershipAllocationRequest');
}

/**
 * Query validated applications visible to the user
 */
export async function queryValidatedApps(user: UserRole): Promise<any[]> {
  return queryContracts(user, 'Backr.ValidatedApp:BackrValidatedApplication');
}

/**
 * Query campaigns visible to the user
 */
export async function queryCampaigns(user: UserRole): Promise<any[]> {
  return queryContracts(user, 'Backr.Campaign:BackingCampaign');
}

/**
 * Wait for a contract to appear on the ledger
 */
export async function waitForContract(
  user: UserRole,
  templateId: string,
  predicate: (contract: any) => boolean,
  timeoutMs: number = 30000
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const contracts = await queryContracts(user, templateId);
    const found = contracts.find(predicate);

    if (found) {
      return found;
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Contract not found within ${timeoutMs}ms`);
}

// =========================================================================
// Backr REST API Helpers
// =========================================================================

/**
 * Call the Backr REST API
 */
export async function apiCall(
  user: UserRole | 'service',
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  const token = user === 'service'
    ? await getServiceAccountToken()
    : await getAccessToken(user);

  const response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

/**
 * Check API health
 */
export async function checkAPIHealth(): Promise<any> {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}

/**
 * Get fee requests via REST API
 */
export async function getFeeRequestsViaAPI(user: UserRole): Promise<any> {
  return apiCall(user, 'GET', '/apps/fee-requests');
}

/**
 * Get allocation requests via REST API
 */
export async function getAllocationRequestsViaAPI(user: UserRole): Promise<any> {
  return apiCall(user, 'GET', '/apps/allocation-requests');
}

/**
 * Get validated apps via REST API
 */
export async function getValidatedAppsViaAPI(user: UserRole): Promise<any> {
  return apiCall(user, 'GET', '/apps/validated');
}

/**
 * Accept fee request via REST API
 */
export async function acceptFeeRequestViaAPI(
  user: UserRole,
  contractId: string,
  params: { allocationId: string; holdingContractId: string }
): Promise<any> {
  return apiCall(user, 'POST', `/apps/fee-requests/${contractId}/accept`, params);
}

/**
 * Reject fee request via REST API
 */
export async function rejectFeeRequestViaAPI(
  user: UserRole,
  contractId: string
): Promise<any> {
  return apiCall(user, 'POST', `/apps/fee-requests/${contractId}/reject`, {});
}

/**
 * Create campaign via REST API
 */
export async function createCampaignViaAPI(
  user: UserRole,
  validatedAppContractId: string,
  params: {
    campaignId: string;
    campaignType: string;
    goal: string;
    minBacking: string;
    maxBacking: string;
    endsAt: string;
  }
): Promise<any> {
  return apiCall(user, 'POST', `/apps/validated/${validatedAppContractId}/campaigns`, params);
}

// =========================================================================
// Admin API Helpers
// =========================================================================

/**
 * Admin: Get all fee requests
 */
export async function adminGetFeeRequestsViaAPI(): Promise<any> {
  return apiCall('service', 'GET', '/admin/apps/fee-requests');
}

/**
 * Admin: Get all validated apps
 */
export async function adminGetValidatedAppsViaAPI(): Promise<any> {
  return apiCall('service', 'GET', '/admin/apps/validated');
}

/**
 * Admin: Invite an app for validation
 */
export async function adminInviteAppViaAPI(
  faPartyId: string,
  params: {
    appName: string;
    prepareUntilDays?: number;
    settleBeforeDays?: number;
  }
): Promise<any> {
  return apiCall('service', 'POST', `/admin/apps/${faPartyId}/invite`, {
    faPartyId,
    appName: params.appName,
    prepareUntilDays: params.prepareUntilDays || 7,
    settleBeforeDays: params.settleBeforeDays || 14,
  });
}

/**
 * Admin: Execute transfer for allocation
 */
export async function adminExecuteTransferViaAPI(
  allocationRequestContractId: string,
  allocationCid: string
): Promise<any> {
  return apiCall('service', 'POST', `/admin/allocations/${allocationRequestContractId}/execute`, {
    allocationCid,
  });
}

// =========================================================================
// Utility Functions
// =========================================================================

/**
 * Generate future datetime string
 */
export function futureDateTime(days: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * Generate unique ID
 */
export function generateId(prefix: string = 'TEST'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wait for a condition with polling
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}
