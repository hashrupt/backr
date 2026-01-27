/**
 * Backr E2E Authentication Helpers
 *
 * Handles Keycloak authentication for E2E tests.
 * Uses the AppProvider realm from Canton Quickstart.
 */

// Environment configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://keycloak.localhost:8082';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'AppProvider';
const KEYCLOAK_TOKEN_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

// Client IDs
const WALLET_CLIENT_ID = process.env.WALLET_CLIENT_ID || 'app-provider-unsafe';
const VALIDATOR_CLIENT_ID = process.env.VALIDATOR_CLIENT_ID || 'app-provider-validator';
const VALIDATOR_CLIENT_SECRET = process.env.VALIDATOR_CLIENT_SECRET || 'AL8648b9SfdTFImq7FV56Vd0KHifHBuC';

/**
 * User roles for testing
 */
export type UserRole = 'operator' | 'app-owner' | 'backer';

/**
 * Test user credentials
 * These should match users created in Keycloak AppProvider realm
 */
const TEST_USERS: Record<UserRole, { username: string; password: string }> = {
  'operator': {
    username: process.env.OPERATOR_USERNAME || 'backr-operator',
    password: process.env.OPERATOR_PASSWORD || 'abc123',
  },
  'app-owner': {
    username: process.env.APP_OWNER_USERNAME || 'app-owner-1',
    password: process.env.APP_OWNER_PASSWORD || 'abc123',
  },
  'backer': {
    username: process.env.BACKER_USERNAME || 'backer-1',
    password: process.env.BACKER_PASSWORD || 'abc123',
  },
};

/**
 * Token cache to avoid repeated auth calls
 */
const tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

/**
 * Get access token for a user role using password grant
 */
export async function getAccessToken(role: UserRole): Promise<string> {
  const cacheKey = `user:${role}`;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const user = TEST_USERS[role];
  if (!user) {
    throw new Error(`Unknown user role: ${role}`);
  }

  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: WALLET_CLIENT_ID,
      username: user.username,
      password: user.password,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get token for ${role}: ${response.status} ${text}`);
  }

  const data = await response.json();
  const token = data.access_token;
  const expiresIn = data.expires_in || 300;

  // Cache with 60 second buffer before expiry
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  });

  return token;
}

/**
 * Get service account token (for operator/admin operations)
 */
export async function getServiceAccountToken(): Promise<string> {
  const cacheKey = 'service:validator';
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const response = await fetch(KEYCLOAK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: VALIDATOR_CLIENT_ID,
      client_secret: VALIDATOR_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get service account token: ${response.status} ${text}`);
  }

  const data = await response.json();
  const token = data.access_token;
  const expiresIn = data.expires_in || 300;

  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
  });

  return token;
}

/**
 * Clear token cache (useful between test suites)
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

/**
 * Decode JWT to extract claims (without verification)
 */
export function decodeJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  // Decode base64url to base64
  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (payload.length % 4) payload += '=';

  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

/**
 * Get user's party ID from JWT
 */
export function getPartyFromToken(token: string): string | null {
  try {
    const claims = decodeJwt(token);
    return claims.sub || null;
  } catch {
    return null;
  }
}

/**
 * Check if Keycloak is available
 */
export async function checkKeycloakHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
