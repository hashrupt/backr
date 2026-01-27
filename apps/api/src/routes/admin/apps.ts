/**
 * Admin App Routes
 *
 * Operator endpoints for managing app validation fee requests.
 */

import { FastifyPluginAsync } from "fastify";
import {
  cantonClient,
  TEMPLATE_IDS,
  CHOICES,
} from "../../services/canton/client.js";
import {
  getDsoPartyId,
  getExecuteTransferContext,
} from "../../services/canton/scan-proxy.js";
import { extractAuthToken, getPartyId } from "../../lib/auth.js";
import { config } from "../../config.js";

interface InviteAppBody {
  faPartyId: string;
  appName: string;
  feeAmount?: string;
  prepareUntilDays?: number;
  settleBeforeDays?: number;
}

interface ExecuteTransferBody {
  allocationCid: string;
}

const adminAppsRoutes: FastifyPluginAsync = async (fastify) => {
  // Create app validation fee request
  // POST /admin/apps/:partyId/invite
  fastify.post<{
    Params: { partyId: string };
    Body: InviteAppBody;
  }>("/:partyId/invite", {
    schema: {
      description: "Invite an app to pay validation fee",
      tags: ["admin", "apps"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          partyId: { type: "string", description: "Featured App party ID" },
        },
        required: ["partyId"],
      },
      body: {
        type: "object",
        properties: {
          faPartyId: { type: "string" },
          appName: { type: "string" },
          feeAmount: { type: "string", description: "Fee in Amulets (default: 25.0)" },
          prepareUntilDays: { type: "number", description: "Days to allocate (default: 7)" },
          settleBeforeDays: { type: "number", description: "Days to settle (default: 14)" },
        },
        required: ["faPartyId", "appName"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            contractId: { type: "string" },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { partyId } = request.params;
      const { faPartyId, appName, feeAmount, prepareUntilDays = 7, settleBeforeDays = 14 } = request.body;

      // First, query for Operator contract
      const operatorContracts = await cantonClient.queryContracts(
        TEMPLATE_IDS.Operator,
        authToken
      );

      if (operatorContracts.length === 0) {
        return reply.status(404).send({ error: "Operator contract not found" });
      }

      const operatorCid = operatorContracts[0].contractId;

      // Calculate deadlines
      const now = new Date();
      const prepareUntil = new Date(now.getTime() + prepareUntilDays * 24 * 60 * 60 * 1000);
      const settleBefore = new Date(now.getTime() + settleBeforeDays * 24 * 60 * 60 * 1000);

      // Exercise InviteAppForValidation
      const result = await cantonClient.exerciseChoice(
        operatorCid,
        TEMPLATE_IDS.Operator,
        CHOICES.Operator.InviteAppForValidation,
        {
          faParty: faPartyId || partyId,
          appPartyId: partyId,
          appName,
          feeAmount: feeAmount ? { Some: feeAmount } : { None: {} },
          prepareUntil: prepareUntil.toISOString(),
          settleBefore: settleBefore.toISOString(),
        },
        authToken
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, contractId: result.contractId };
    },
  });

  // Execute transfer after FA allocates funds
  // POST /admin/allocations/:contractId/execute
  fastify.post<{
    Params: { contractId: string };
    Body: ExecuteTransferBody;
  }>("/allocations/:contractId/execute", {
    schema: {
      description: "Execute transfer after FA allocates funds",
      tags: ["admin", "apps"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          contractId: { type: "string", description: "Allocation request contract ID" },
        },
        required: ["contractId"],
      },
      body: {
        type: "object",
        properties: {
          allocationCid: { type: "string", description: "CIP-56 Allocation contract ID" },
        },
        required: ["allocationCid"],
      },
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { contractId } = request.params;
      const { allocationCid } = request.body;

      // Get execution context from scan-proxy (disclosed contracts)
      const transferContext = await getExecuteTransferContext(
        allocationCid,
        authToken
      );

      const disclosedContracts = transferContext?.disclosedContracts || [];

      // Exercise ExecuteTransfer
      const result = await cantonClient.exerciseChoice(
        contractId,
        TEMPLATE_IDS.AllocationRequest,
        CHOICES.AllocationRequest.ExecuteTransfer,
        {
          allocationCid,
          extraArgs: { disclosedContracts },
        },
        authToken,
        disclosedContracts
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, validatedAppContractId: result.contractId };
    },
  });

  // List pending fee requests
  // GET /admin/apps/fee-requests
  fastify.get("/fee-requests", {
    schema: {
      description: "List pending fee requests",
      tags: ["admin", "apps"],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const contracts = await cantonClient.queryContracts(
        TEMPLATE_IDS.FeeRequest,
        authToken
      );

      return {
        feeRequests: contracts.map((c) => ({
          contractId: c.contractId,
          ...c.payload,
        })),
      };
    },
  });

  // List pending allocation requests
  // GET /admin/apps/allocation-requests
  fastify.get("/allocation-requests", {
    schema: {
      description: "List pending allocation requests",
      tags: ["admin", "apps"],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const contracts = await cantonClient.queryContracts(
        TEMPLATE_IDS.AllocationRequest,
        authToken
      );

      return {
        allocationRequests: contracts.map((c) => ({
          contractId: c.contractId,
          ...c.payload,
        })),
      };
    },
  });

  // List validated apps
  // GET /admin/apps/validated
  fastify.get("/validated", {
    schema: {
      description: "List validated apps",
      tags: ["admin", "apps"],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const contracts = await cantonClient.queryContracts(
        TEMPLATE_IDS.ValidatedApp,
        authToken
      );

      return {
        validatedApps: contracts.map((c) => ({
          contractId: c.contractId,
          ...c.payload,
        })),
      };
    },
  });
};

export default adminAppsRoutes;
