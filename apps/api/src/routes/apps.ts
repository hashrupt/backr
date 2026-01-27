/**
 * App Routes
 *
 * Featured App endpoints for validation flow and campaign management.
 */

import { FastifyPluginAsync } from "fastify";
import {
  cantonClient,
  TEMPLATE_IDS,
  CHOICES,
} from "../services/canton/client.js";
import {
  getDsoPartyId,
  getAllocationFactoryContext,
} from "../services/canton/scan-proxy.js";
import { extractAuthToken, getPartyId } from "../lib/auth.js";
import { config } from "../config.js";

interface AcceptFeeRequestBody {
  allocationId: string;
  holdingContractId: string;
}

interface AllocateFundsBody {
  holdingCid: string;
}

interface CreateCampaignBody {
  campaignId: string;
  campaignType: "STAKING" | "FUNDING";
  goal: string;
  minBacking: string;
  maxBacking: string;
  endsAt: string;
}

const appRoutes: FastifyPluginAsync = async (fastify) => {
  // Get my pending fee requests
  // GET /apps/fee-requests
  fastify.get("/fee-requests", {
    schema: {
      description: "List pending fee requests for current user",
      tags: ["apps"],
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

  // Accept fee request and create allocation request
  // POST /apps/fee-requests/:contractId/accept
  fastify.post<{
    Params: { contractId: string };
    Body: AcceptFeeRequestBody;
  }>("/fee-requests/:contractId/accept", {
    schema: {
      description: "Accept fee request and create allocation request",
      tags: ["apps"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          contractId: { type: "string" },
        },
        required: ["contractId"],
      },
      body: {
        type: "object",
        properties: {
          allocationId: { type: "string", description: "Unique allocation ID" },
          holdingContractId: { type: "string", description: "Holding contract reference" },
        },
        required: ["allocationId", "holdingContractId"],
      },
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { contractId } = request.params;
      const { allocationId, holdingContractId } = request.body;

      const result = await cantonClient.exerciseChoice(
        contractId,
        TEMPLATE_IDS.FeeRequest,
        CHOICES.FeeRequest.ValidateNAcceptAppOwnershipFee,
        {
          allocationId,
          holdingContractId,
        },
        authToken
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        allocationRequestContractId: result.contractId,
      };
    },
  });

  // Reject fee request
  // POST /apps/fee-requests/:contractId/reject
  fastify.post<{
    Params: { contractId: string };
  }>("/fee-requests/:contractId/reject", {
    schema: {
      description: "Reject fee request",
      tags: ["apps"],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { contractId } = request.params;

      const result = await cantonClient.exerciseChoice(
        contractId,
        TEMPLATE_IDS.FeeRequest,
        CHOICES.FeeRequest.RejectFeeRequest,
        {},
        authToken
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true };
    },
  });

  // Get my allocation requests
  // GET /apps/allocation-requests
  fastify.get("/allocation-requests", {
    schema: {
      description: "List allocation requests for current user",
      tags: ["apps"],
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

  // Allocate funds for fee payment (CIP-56)
  // POST /apps/allocation-requests/:contractId/allocate
  fastify.post<{
    Params: { contractId: string };
    Body: AllocateFundsBody;
  }>("/allocation-requests/:contractId/allocate", {
    schema: {
      description: "Allocate funds for fee payment via CIP-56",
      tags: ["apps"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          contractId: { type: "string" },
        },
        required: ["contractId"],
      },
      body: {
        type: "object",
        properties: {
          holdingCid: { type: "string", description: "Holding contract ID" },
        },
        required: ["holdingCid"],
      },
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { contractId } = request.params;
      const { holdingCid } = request.body;

      // Get DSO party and allocation factory context
      const dsoParty = await getDsoPartyId(authToken);
      if (!dsoParty) {
        return reply.status(500).send({ error: "Could not get DSO party" });
      }

      // Query the allocation request to get amount and operator
      const contracts = await cantonClient.queryContracts(
        TEMPLATE_IDS.AllocationRequest,
        authToken
      );
      const allocReq = contracts.find((c) => c.contractId === contractId);
      if (!allocReq) {
        return reply.status(404).send({ error: "Allocation request not found" });
      }

      const operator = allocReq.payload.operator as string;
      const feeAmount = BigInt(
        Math.floor(parseFloat(allocReq.payload.feeAmount as string) * 1e10)
      );

      // Get allocation factory context from scan-proxy
      const context = await getAllocationFactoryContext(
        dsoParty,
        feeAmount,
        operator,
        authToken
      );

      if (!context) {
        return reply.status(500).send({ error: "Could not get allocation context" });
      }

      const result = await cantonClient.exerciseChoice(
        contractId,
        TEMPLATE_IDS.AllocationRequest,
        CHOICES.AllocationRequest.AllocateFunds,
        {
          allocationFactoryCid: context.factoryCid,
          expectedAdmin: dsoParty,
          inputHoldingCids: [holdingCid],
          allocationRequestedAt: new Date().toISOString(),
          extraArgs: { disclosedContracts: context.disclosedContracts || [] },
        },
        authToken,
        context.disclosedContracts
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        allocationCid: result.contractId,
      };
    },
  });

  // Withdraw allocation before settlement
  // POST /apps/allocation-requests/:contractId/withdraw
  fastify.post<{
    Params: { contractId: string };
  }>("/allocation-requests/:contractId/withdraw", {
    schema: {
      description: "Withdraw allocation before settlement",
      tags: ["apps"],
      security: [{ bearerAuth: [] }],
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { contractId } = request.params;

      const result = await cantonClient.exerciseChoice(
        contractId,
        TEMPLATE_IDS.AllocationRequest,
        CHOICES.AllocationRequest.WithdrawAllocation,
        {},
        authToken
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true };
    },
  });

  // Get my validated apps
  // GET /apps/validated
  fastify.get("/validated", {
    schema: {
      description: "List validated apps for current user",
      tags: ["apps"],
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

  // Create a campaign from validated app
  // POST /apps/validated/:contractId/campaigns
  fastify.post<{
    Params: { contractId: string };
    Body: CreateCampaignBody;
  }>("/validated/:contractId/campaigns", {
    schema: {
      description: "Create a campaign from validated app",
      tags: ["apps", "campaigns"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          contractId: { type: "string" },
        },
        required: ["contractId"],
      },
      body: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          campaignType: { type: "string", enum: ["STAKING", "FUNDING"] },
          goal: { type: "string", description: "Goal amount in Amulets" },
          minBacking: { type: "string", description: "Minimum backing per backer" },
          maxBacking: { type: "string", description: "Maximum backing per backer" },
          endsAt: { type: "string", format: "date-time" },
        },
        required: ["campaignId", "campaignType", "goal", "minBacking", "maxBacking", "endsAt"],
      },
    },
    handler: async (request, reply) => {
      const authToken = extractAuthToken(request);
      if (!authToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const { contractId } = request.params;
      const { campaignId, campaignType, goal, minBacking, maxBacking, endsAt } = request.body;

      const result = await cantonClient.exerciseChoice(
        contractId,
        TEMPLATE_IDS.ValidatedApp,
        CHOICES.ValidatedApp.CreateCampaign,
        {
          campaignId,
          campaignType,
          goal,
          minBacking,
          maxBacking,
          endsAt,
        },
        authToken
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        campaignContractId: result.contractId,
      };
    },
  });
};

export default appRoutes;
