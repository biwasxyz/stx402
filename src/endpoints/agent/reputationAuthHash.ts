import { BaseEndpoint } from "../BaseEndpoint";
import type { AppContext } from "../../types";
import {
  computeSip018MessageHash,
  computeDomainHash,
  computeFeedbackAuthHash,
  REPUTATION_DOMAIN,
  type ERC8004Network,
  ERC8004_CONTRACTS,
} from "../../utils/erc8004";

export class ReputationAuthHash extends BaseEndpoint {
  schema = {
    tags: ["Agent Registry"],
    summary: "(paid) Generate SIP-018 message hash for off-chain feedback authorization",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object" as const,
            required: ["agentId", "signer", "indexLimit", "expiryBlockHeight"],
            properties: {
              agentId: {
                type: "number" as const,
                description: "Agent ID to authorize feedback for",
              },
              signer: {
                type: "string" as const,
                description: "Principal who will be authorized (agent owner/operator)",
              },
              indexLimit: {
                type: "number" as const,
                description: "Maximum feedback index allowed",
              },
              expiryBlockHeight: {
                type: "number" as const,
                description: "Block height when authorization expires",
              },
            },
          },
        },
      },
    },
    parameters: [
      {
        name: "network",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["mainnet", "testnet"] as const,
          default: "testnet",
        },
      },
      {
        name: "tokenType",
        in: "query" as const,
        required: false,
        schema: {
          type: "string" as const,
          enum: ["STX", "sBTC", "USDCx"] as const,
          default: "STX",
        },
      },
    ],
    responses: {
      "200": {
        description: "SIP-018 message hash and structured data",
        content: {
          "application/json": {
            schema: {
              type: "object" as const,
              properties: {
                messageHash: {
                  type: "string" as const,
                  description: "Hex-encoded hash to sign with your private key",
                },
                domainHash: { type: "string" as const },
                structuredDataHash: { type: "string" as const },
                domain: {
                  type: "object" as const,
                  properties: {
                    name: { type: "string" as const },
                    version: { type: "string" as const },
                    chainId: { type: "number" as const },
                  },
                },
                structuredData: {
                  type: "object" as const,
                  properties: {
                    agentId: { type: "number" as const },
                    signer: { type: "string" as const },
                    indexLimit: { type: "number" as const },
                    expiryBlockHeight: { type: "number" as const },
                  },
                },
                instructions: { type: "string" as const },
                network: { type: "string" as const },
                tokenType: { type: "string" as const },
              },
            },
          },
        },
      },
      "400": { description: "Invalid input" },
      "402": { description: "Payment required" },
      "501": { description: "Network not supported" },
    },
  };

  async handle(c: AppContext) {
    const tokenType = this.getTokenType(c);
    const network = (c.req.query("network") || "testnet") as ERC8004Network;

    if (network === "mainnet" && !ERC8004_CONTRACTS.mainnet) {
      return this.errorResponse(
        c,
        "ERC-8004 contracts not yet deployed on mainnet",
        501
      );
    }

    let body: {
      agentId?: number;
      signer?: string;
      indexLimit?: number;
      expiryBlockHeight?: number;
    };
    try {
      body = await c.req.json();
    } catch {
      return this.errorResponse(c, "Invalid JSON body", 400);
    }

    const { agentId, signer, indexLimit, expiryBlockHeight } = body;

    if (agentId === undefined || agentId < 0) {
      return this.errorResponse(c, "agentId is required and must be >= 0", 400);
    }
    if (!signer) {
      return this.errorResponse(c, "signer principal is required", 400);
    }
    if (indexLimit === undefined || indexLimit < 0) {
      return this.errorResponse(c, "indexLimit is required and must be >= 0", 400);
    }
    if (expiryBlockHeight === undefined || expiryBlockHeight < 0) {
      return this.errorResponse(
        c,
        "expiryBlockHeight is required and must be >= 0",
        400
      );
    }

    try {
      const params = { agentId, signer, indexLimit, expiryBlockHeight };
      const messageHash = computeSip018MessageHash(network, params);
      const domainHash = computeDomainHash(network);
      const structuredDataHash = computeFeedbackAuthHash(params);

      const chainId = REPUTATION_DOMAIN.chainId[network];

      return c.json({
        messageHash: `0x${messageHash}`,
        domainHash: `0x${domainHash}`,
        structuredDataHash: `0x${structuredDataHash}`,
        domain: {
          name: REPUTATION_DOMAIN.name,
          version: REPUTATION_DOMAIN.version,
          chainId,
        },
        structuredData: {
          agentId,
          signer,
          indexLimit,
          expiryBlockHeight,
        },
        instructions: [
          "1. Sign the messageHash with your private key using secp256k1",
          "2. The signature should be 65 bytes (r: 32, s: 32, v: 1)",
          "3. Call give-feedback-signed with the signature and these parameters",
          "4. The signer must be the agent owner or an approved operator",
        ].join("\n"),
        network,
        tokenType,
      });
    } catch (error) {
      return this.errorResponse(
        c,
        `Failed to compute auth hash: ${String(error)}`,
        400
      );
    }
  }
}
