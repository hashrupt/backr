/**
 * Centralized configuration for data ingestion sources
 * Used by crawlers and API clients for importing entity data
 */

export const importConfig = {
  // Web crawlers - no auth required
  crawlers: {
    ccview: {
      url: "https://ccview.io/featured-apps/",
      enabled: true,
      rateLimit: 2000, // ms between requests
      description: "Featured Apps data from ccview.io",
    },
    lighthouse: {
      url: "https://lighthouse.cantonloop.com/featured-apps",
      enabled: true,
      rateLimit: 2000,
      description: "Featured Apps data from 5N Lighthouse Explorer",
    },
    groupsIo: {
      url: "https://lists.sync.global/g/tokenomics-announce",
      enabled: false, // Parked until auth is available
      rateLimit: 3000,
      description: "Tokenomics announcements from groups.io (requires auth)",
    },
  },

  // Canton Scan Proxy API - requires auth
  scanProxy: {
    baseUrl: process.env.CANTON_SCAN_PROXY_URL || "",
    token: process.env.CANTON_SCAN_PROXY_TOKEN || "",
    endpoints: {
      featuredApps: "/v0/scan-proxy/featured-apps/{provider_party_id}",
      dsoPartyId: "/v0/scan-proxy/dso-party-id",
      dsoInfo: "/v0/scan-proxy/dso",
      ansEntries: "/v0/scan-proxy/ans-entries",
      ansEntriesByParty: "/v0/scan-proxy/ans-entries/by-party/{party}",
      ansEntriesByName: "/v0/scan-proxy/ans-entries/by-name/{name}",
      ansRules: "/v0/scan-proxy/ans-rules",
      amuletRules: "/v0/scan-proxy/amulet-rules",
      openAndIssuingMiningRounds: "/v0/scan-proxy/open-and-issuing-mining-rounds",
      transferPreapprovals: "/v0/scan-proxy/transfer-preapprovals/by-party/{party}",
      transferCommandCounter: "/v0/scan-proxy/transfer-command-counter/{party}",
      transferCommandStatus: "/v0/scan-proxy/transfer-command/status",
    },
  },

  // Crawler settings
  settings: {
    headless: true,
    timeout: 30000,
    retries: 3,
    retryDelay: 5000,
    userAgent: "Backr Entity Importer/1.0",
  },

  // Import sources for tracking
  sources: {
    CCVIEW: "ccview.io",
    LIGHTHOUSE: "lighthouse.cantonloop.com",
    GROUPS_IO: "groups.io",
    MANUAL: "manual",
    SCAN_API: "scan-api",
  },
} as const;

export type ImportConfig = typeof importConfig;
export type CrawlerKey = keyof typeof importConfig.crawlers;
export type ImportSource = (typeof importConfig.sources)[keyof typeof importConfig.sources];
