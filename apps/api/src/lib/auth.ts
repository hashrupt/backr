import { FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { config } from "../config.js";

// Extend FastifyRequest with user info from JWT
declare module "fastify" {
  interface FastifyRequest {
    user?: {
      sub: string; // Party ID (used for Canton operations)
      email?: string;
      name?: string;
      preferred_username?: string;
    };
    authToken?: string; // Raw Bearer token for Canton client
  }
}

interface KeycloakCerts {
  keys: Array<{
    kid: string;
    kty: string;
    alg: string;
    use: string;
    n: string;
    e: string;
  }>;
}

let _cachedCerts: KeycloakCerts | null = null;

async function fetchKeycloakCerts(): Promise<KeycloakCerts> {
  if (_cachedCerts) return _cachedCerts;

  const url = `${config.KEYCLOAK_URL}/realms/${config.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch Keycloak certs: ${res.status}`);
  }
  _cachedCerts = (await res.json()) as KeycloakCerts;
  return _cachedCerts;
}

/**
 * Decode and verify JWT token from Keycloak.
 * In production, this should verify the signature using JWKS.
 * For MVP, we decode and validate basic claims.
 */
async function verifyToken(token: string): Promise<FastifyRequest["user"]> {
  // Decode JWT payload (base64url)
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf-8")
  );

  // Validate issuer
  const expectedIssuer = `${config.KEYCLOAK_URL}/realms/${config.KEYCLOAK_REALM}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error("Invalid token issuer");
  }

  // Check expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error("Token expired");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    preferred_username: payload.preferred_username,
  };
}

/**
 * Authentication hook — extracts and verifies Bearer token.
 * Attach to routes that require authentication.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  try {
    request.user = await verifyToken(token);
    request.authToken = token; // Store for Canton client calls
  } catch {
    return reply.status(401).send({ error: "Invalid or expired token" });
  }
}

/**
 * Optional auth — extracts user if token present, but doesn't block.
 */
export async function optionalAuth(request: FastifyRequest): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return;

  const token = authHeader.slice(7);
  try {
    request.user = await verifyToken(token);
    request.authToken = token;
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
}

/**
 * Extract Bearer token from request (for Canton client calls)
 */
export function extractAuthToken(request: FastifyRequest): string | undefined {
  // Use cached token if available
  if (request.authToken) return request.authToken;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return undefined;
}

/**
 * Get user's party ID from request (for Canton operations)
 */
export function getPartyId(request: FastifyRequest): string | undefined {
  return request.user?.sub;
}

export default fp(
  async function authPlugin(app) {
    app.decorate("authenticate", authenticate);
    // Pre-fetch certs on startup (non-blocking)
    fetchKeycloakCerts().catch(() => {
      app.log.warn("Could not pre-fetch Keycloak certs — will retry on first request");
    });
  },
  { name: "auth" }
);
