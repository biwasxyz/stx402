/**
 * ERC-8004 Agent Registry utilities
 * Contract addresses and helper functions for interacting with the agent registries
 */

import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  ClarityValue,
  uintCV,
  principalCV,
  bufferCV,
  stringUtf8CV,
  listCV,
  noneCV,
  someCV,
} from "@stacks/transactions";
import { getFetchOptions, setFetchOptions } from "@stacks/common";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";

// Fix stacks.js fetch for Workers
type StacksRequestInit = RequestInit & { referrerPolicy?: string };
const fetchOptions: StacksRequestInit = getFetchOptions();
delete fetchOptions.referrerPolicy;
setFetchOptions(fetchOptions);

// Contract addresses for each network
export const ERC8004_CONTRACTS = {
  testnet: {
    deployer: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18",
    identity: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18.identity-registry",
    reputation: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18.reputation-registry",
    validation: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18.validation-registry",
  },
  mainnet: null as null, // Not yet deployed
} as const;

export type ERC8004Network = "mainnet" | "testnet";

// SIP-018 constants for signature generation
export const SIP018_PREFIX = "534950303138"; // "SIP018" in hex
export const REPUTATION_DOMAIN = {
  name: "reputation-registry",
  version: "1.0.0",
  chainId: {
    mainnet: 1,
    testnet: 2147483648,
  },
};

/**
 * Get contract addresses for a network
 */
export function getContractAddresses(network: ERC8004Network) {
  const contracts = ERC8004_CONTRACTS[network];
  if (!contracts) {
    throw new Error(`ERC-8004 contracts not deployed on ${network}`);
  }
  return contracts;
}

/**
 * Parse contract ID into address and name
 */
export function parseContractId(contractId: string): {
  address: string;
  name: string;
} {
  const [address, name] = contractId.split(".");
  return { address, name };
}

/**
 * Call a read-only function on an ERC-8004 registry
 */
export async function callRegistryFunction(
  network: ERC8004Network,
  registry: "identity" | "reputation" | "validation",
  functionName: string,
  functionArgs: ClarityValue[] = []
): Promise<ClarityValue> {
  const contracts = getContractAddresses(network);
  const contractId = contracts[registry];
  const { address, name } = parseContractId(contractId);

  const stacksNetwork = network === "mainnet" ? "mainnet" : "testnet";

  const result = await fetchCallReadOnlyFunction({
    contractAddress: address,
    contractName: name,
    functionName,
    functionArgs,
    senderAddress: address,
    network: stacksNetwork,
  });

  return result;
}

/**
 * Convert Clarity response to JSON with proper typing
 */
export function clarityToJson(cv: ClarityValue): unknown {
  return cvToJSON(cv);
}

/**
 * Build uint Clarity value
 */
export function uint(n: number | bigint): ClarityValue {
  return uintCV(n);
}

/**
 * Build principal Clarity value
 */
export function principal(p: string): ClarityValue {
  return principalCV(p);
}

/**
 * Build buffer Clarity value from hex string
 */
export function buffer(hex: string): ClarityValue {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  return bufferCV(hexToBytes(cleanHex));
}

/**
 * Build string-utf8 Clarity value
 */
export function stringUtf8(s: string): ClarityValue {
  return stringUtf8CV(s);
}

/**
 * Build optional none
 */
export function none(): ClarityValue {
  return noneCV();
}

/**
 * Build optional some
 */
export function some(cv: ClarityValue): ClarityValue {
  return someCV(cv);
}

/**
 * Build list of Clarity values
 */
export function list(items: ClarityValue[]): ClarityValue {
  return listCV(items);
}

/**
 * Extract value from Clarity response (ok/err/some wrapper)
 */
export function extractValue(result: unknown): unknown {
  if (
    result &&
    typeof result === "object" &&
    "type" in result &&
    "value" in result
  ) {
    const typed = result as { type: string; value: unknown };
    if (typed.type === "ok" || typed.type === "err" || typed.type === "some") {
      return typed.value;
    }
  }
  return result;
}

/**
 * Check if result is ok (for response types)
 */
export function isOk(result: unknown): boolean {
  if (result && typeof result === "object" && "type" in result) {
    return (result as { type: string }).type === "ok";
  }
  return false;
}

/**
 * Check if result is some (for optional types)
 */
export function isSome(result: unknown): boolean {
  if (result && typeof result === "object" && "type" in result) {
    return (result as { type: string }).type === "some";
  }
  return false;
}

/**
 * Check if result is none (for optional types)
 */
export function isNone(result: unknown): boolean {
  if (result && typeof result === "object" && "type" in result) {
    return (result as { type: string }).type === "none";
  }
  return false;
}

/**
 * Extract the inner value from typed Clarity values (principal, uint, string-utf8, etc.)
 */
export function extractTypedValue(result: unknown): unknown {
  if (result && typeof result === "object" && "value" in result) {
    return (result as { value: unknown }).value;
  }
  return result;
}

/**
 * Get error code from Clarity err response
 * Handles cvToJSON structure: { type: "err", value: { type: "uint", value: "1001" } }
 */
export function getErrorCode(result: unknown): number | null {
  if (
    result &&
    typeof result === "object" &&
    "type" in result &&
    "value" in result
  ) {
    const typed = result as { type: string; value: unknown };
    if (typed.type === "err") {
      // Handle uint wrapped in type object: { type: "uint", value: "1001" }
      if (typeof typed.value === "object" && typed.value && "value" in typed.value) {
        const innerValue = (typed.value as { value: unknown }).value;
        // Value could be string (from JSON) or number/bigint
        if (typeof innerValue === "string") {
          return parseInt(innerValue, 10);
        }
        if (typeof innerValue === "number" || typeof innerValue === "bigint") {
          return Number(innerValue);
        }
      }
      // Handle direct number value (less common)
      if (typeof typed.value === "number") {
        return typed.value;
      }
    }
  }
  return null;
}

/**
 * Error code descriptions for all registries
 */
export const ERROR_CODES: Record<number, string> = {
  // Identity Registry (1000-1003)
  1000: "Not authorized",
  1001: "Agent not found",
  1002: "Agent already exists",
  1003: "Metadata set failed",

  // Validation Registry (2000-2005)
  2000: "Not authorized",
  2001: "Agent not found",
  2002: "Validation not found",
  2003: "Validation already exists",
  2004: "Invalid validator (cannot be self)",
  2005: "Invalid response score (exceeds 100)",

  // Reputation Registry (3000-3010)
  3000: "Not authorized",
  3001: "Agent not found",
  3002: "Feedback not found",
  3003: "Feedback already revoked",
  3004: "Invalid score (exceeds 100)",
  3005: "Self-feedback not allowed",
  3006: "Invalid index",
  3007: "Signature verification failed",
  3008: "Authorization expired",
  3009: "Index limit exceeded",
  3010: "Empty feedback URI",
};

/**
 * Get human-readable error message
 */
export function getErrorMessage(code: number): string {
  return ERROR_CODES[code] || `Unknown error (code: ${code})`;
}

/**
 * Compute SHA-256 hash
 */
export function computeSha256(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

/**
 * Generate SIP-018 domain hash for reputation registry
 */
export function computeDomainHash(network: ERC8004Network): string {
  const chainId = REPUTATION_DOMAIN.chainId[network];
  // Domain structure: (name, version, chain-id)
  const domainTuple = `(domain (name "${REPUTATION_DOMAIN.name}") (version "${REPUTATION_DOMAIN.version}") (chain-id u${chainId}))`;
  const encoder = new TextEncoder();
  return computeSha256(encoder.encode(domainTuple));
}

/**
 * Generate SIP-018 structured data hash for feedback authorization
 */
export function computeFeedbackAuthHash(params: {
  agentId: number;
  signer: string;
  indexLimit: number;
  expiryBlockHeight: number;
}): string {
  // Structured data for feedback authorization
  const structuredData = `(feedback-auth (agent-id u${params.agentId}) (signer '${params.signer}) (index-limit u${params.indexLimit}) (expiry u${params.expiryBlockHeight}))`;
  const encoder = new TextEncoder();
  return computeSha256(encoder.encode(structuredData));
}

/**
 * Generate full SIP-018 message hash
 */
export function computeSip018MessageHash(
  network: ERC8004Network,
  params: {
    agentId: number;
    signer: string;
    indexLimit: number;
    expiryBlockHeight: number;
  }
): string {
  const domainHash = computeDomainHash(network);
  const structuredDataHash = computeFeedbackAuthHash(params);

  // Final hash: SIP018_PREFIX + domain_hash + structured_data_hash
  const prefixBytes = hexToBytes(SIP018_PREFIX);
  const domainBytes = hexToBytes(domainHash);
  const dataBytes = hexToBytes(structuredDataHash);

  const combined = new Uint8Array(prefixBytes.length + domainBytes.length + dataBytes.length);
  combined.set(prefixBytes, 0);
  combined.set(domainBytes, prefixBytes.length);
  combined.set(dataBytes, prefixBytes.length + domainBytes.length);

  return computeSha256(combined);
}
