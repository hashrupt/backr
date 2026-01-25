import Keycloak from "keycloak-js";

// Keycloak configuration from environment
const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || "http://localhost:8080",
  realm: import.meta.env.VITE_KEYCLOAK_REALM || "backr",
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "backr-web",
};

// Keycloak instance
const keycloak = new Keycloak(keycloakConfig);

// Init options with PKCE (S256) for security
export const initOptions: Keycloak.KeycloakInitOptions = {
  onLoad: "check-sso",
  silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
  pkceMethod: "S256",
  checkLoginIframe: false,
};

// Singleton init state
let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize Keycloak with caching to prevent multiple inits
 */
export async function initKeycloak(): Promise<boolean> {
  if (isInitialized) {
    return keycloak.authenticated || false;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = keycloak.init(initOptions).then((authenticated) => {
    isInitialized = true;
    return authenticated;
  });

  return initPromise;
}

// Token refresh interval (4 minutes - tokens typically expire in 5 min)
const TOKEN_REFRESH_INTERVAL = 240000;
let refreshIntervalId: number | null = null;

/**
 * Start automatic token refresh
 */
export function startTokenRefresh(): void {
  if (refreshIntervalId) return;

  refreshIntervalId = window.setInterval(async () => {
    if (!keycloak.authenticated) return;

    try {
      const refreshed = await keycloak.updateToken(60); // Refresh if < 60s left
      if (refreshed) {
        console.debug("[Keycloak] Token refreshed");
      }
    } catch (error) {
      console.error("[Keycloak] Failed to refresh token:", error);
      // Force re-login on refresh failure
      keycloak.login();
    }
  }, TOKEN_REFRESH_INTERVAL);
}

/**
 * Stop automatic token refresh
 */
export function stopTokenRefresh(): void {
  if (refreshIntervalId) {
    window.clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
}

/**
 * Get current access token (refreshes if needed)
 */
export async function getAccessToken(): Promise<string> {
  if (!keycloak.authenticated) {
    throw new Error("Not authenticated");
  }

  try {
    // Refresh if token expires in < 30 seconds
    await keycloak.updateToken(30);
  } catch (error) {
    console.error("[Keycloak] Token refresh failed:", error);
    keycloak.login();
    throw new Error("Token refresh failed");
  }

  return keycloak.token || "";
}

/**
 * Get current token synchronously (may be expired)
 */
export function getToken(): string | undefined {
  return keycloak.token;
}

/**
 * Get parsed token claims
 */
export function getTokenParsed(): Keycloak.KeycloakTokenParsed | undefined {
  return keycloak.tokenParsed;
}

/**
 * Get user's party ID (from JWT sub claim)
 */
export function getPartyId(): string | undefined {
  return keycloak.tokenParsed?.sub;
}

/**
 * Logout and redirect to origin
 */
export function logout(): void {
  stopTokenRefresh();
  keycloak.logout({ redirectUri: window.location.origin });
}

export default keycloak;
