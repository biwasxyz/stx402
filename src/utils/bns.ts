import {
  BufferCV,
  ClarityType,
  cvToValue,
  principalCV,
  serializeCV,
  TupleCV,
} from "@stacks/transactions";
import { getFetchOptions, setFetchOptions } from "@stacks/common";
import { bufferToString } from "hono/utils/buffer";

const BNS_CONTRACT_ADDRESS = "SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF";
const BNS_CONTRACT_NAME = "BNS-V2";
const API_URL =
  "https://stacks-node-api.mainnet.stacks.co/v2/contracts/call-read";

// Top-level: Fix stacks.js fetch for Workers (runs once/module)
type StacksRequestInit = RequestInit & { referrerPolicy?: string };
const fetchOptions: StacksRequestInit = getFetchOptions();
delete fetchOptions.referrerPolicy;
setFetchOptions(fetchOptions);

type NameResponse = { name: BufferCV; namespace: BufferCV };
type BnsNameResponse =
  | { type: ClarityType.ResponseErr; value: string }
  | {
      type: ClarityType.ResponseOk;
      value: { type: ClarityType.OptionalSome; value: TupleCV<NameResponse> };
    };

export async function getNameFromAddress(address: string): Promise<string> {
  const addressCV = principalCV(address);
  const serializedAddressCV = serializeCV(addressCV);
  const url = `${API_URL}/${BNS_CONTRACT_ADDRESS}/${BNS_CONTRACT_NAME}/get-primary`;
  const body = {
    arguments: [serializedAddressCV],
    sender: address,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Hiro API error: ${resp.status}`);
  }

  const data = (await resp.json()) as BnsNameResponse;

  if (data.type === ClarityType.ResponseErr) {
    return "";
  }

  if (
    data.type === ClarityType.ResponseOk &&
    data.value?.type === ClarityType.OptionalSome
  ) {
    const tuple = data.value.value as TupleCV<NameResponse>;
    const { name, namespace } = tuple.value;
    const nameBuff = cvToValue(name);
    const namespaceBuff = cvToValue(namespace);

    return `${nameBuff}.${namespaceBuff}`;
  }

  return "";
}
