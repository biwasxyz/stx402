import { StacksNetworkName } from "@stacks/network";

export function getNetworkFromPrincipal(principal: string): StacksNetworkName {
  if (principal.startsWith("SP") || principal.startsWith("SM")) {
    return "mainnet";
  } else if (principal.startsWith("ST") || principal.startsWith("SN")) {
    return "testnet";
  } else {
    throw new Error("Invalid Stacks address/principal");
  }
}