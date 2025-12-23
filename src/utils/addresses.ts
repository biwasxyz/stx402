import { Address } from "@stacks/transactions";

const MAINNET_MULTI_SIG = 20;
const MAINNET_SINGLE_SIG = 22;
const TESTNET_MULTI_SIG = 21;
const TESTNET_SINGLE_SIG = 26;

export function convertAddressToNetwork(
  principal: string,
  network: "mainnet" | "testnet"
) {
  const addressObj = Address.parse(principal);

  if (network === "mainnet") {
    // if already mainnet, return as-is
    if (
      "version" in addressObj &&
      (addressObj.version === MAINNET_MULTI_SIG ||
        addressObj.version === MAINNET_SINGLE_SIG)
    ) {
      return Address.stringify(addressObj);
    }
    // if multisig convert and return
    if ("version" in addressObj && addressObj.version === TESTNET_MULTI_SIG) {
      addressObj.version = MAINNET_MULTI_SIG;
      return Address.stringify(addressObj);
    }
    // if single sig convert and return
    if ("version" in addressObj && addressObj.version === TESTNET_SINGLE_SIG) {
      addressObj.version = MAINNET_SINGLE_SIG;
      return Address.stringify(addressObj);
    }
  }

  if (network === "testnet") {
    // if already testnet, return as-is
    if (
      "version" in addressObj &&
      (addressObj.version === TESTNET_MULTI_SIG ||
        addressObj.version === TESTNET_SINGLE_SIG)
    ) {
      return Address.stringify(addressObj);
    }
    // if multisig convert and return
    if ("version" in addressObj && addressObj.version === MAINNET_MULTI_SIG) {
      addressObj.version = TESTNET_MULTI_SIG;
      return Address.stringify(addressObj);
    }
    // if single sig convert and return
    if ("version" in addressObj && addressObj.version === MAINNET_SINGLE_SIG) {
      addressObj.version = TESTNET_SINGLE_SIG;
      return Address.stringify(addressObj);
    }
  }
}
