import { BufferCV, ClarityType, principalCV, TupleCV } from '@stacks/transactions';
import { getFetchOptions, setFetchOptions } from '@stacks/common';

const BNS_CONTRACT_ADDRESS = 'SP2QEZ06AGJ3RKJPBV14SY1V5BBFNAW33D96YPGZF';
const BNS_CONTRACT_NAME = 'BNS-V2';
const API_URL = 'https://stacks-node-api.mainnet.stacks.co/v2/contracts/call-read';

// Top-level: Fix stacks.js fetch for Workers (runs once/module)
type StacksRequestInit = RequestInit & { referrerPolicy?: string };
const fetchOptions: StacksRequestInit = getFetchOptions();
delete fetchOptions.referrerPolicy;
setFetchOptions(fetchOptions);

type NameResponse = { name: BufferCV; namespace: BufferCV };
type BnsNameResponse = 
  | { type: ClarityType.ResponseErr; value: string }
  | { type: ClarityType.ResponseOk; value: { type: ClarityType.OptionalSome; value: TupleCV<NameResponse> } };

function hexToAscii(hexString: string | bigint): string {
  try {
    const hex = typeof hexString === 'bigint' ? hexString.toString(16) : hexString.replace('0x', '');
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return str;
  } catch {
    return '';
  }
}

export async function getNameFromAddress(address: string): Promise<string> {
  const addressCV = principalCV(address);
  const url = `${API_URL}/${BNS_CONTRACT_ADDRESS}/${BNS_CONTRACT_NAME}/get-primary`;
  const body = { 
    arguments: [addressCV.serialize().toString('hex')], 
    sender: address 
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Hiro API error: ${resp.status}`);
  }

  const data = await resp.json() as BnsNameResponse;

  if (data.type === ClarityType.ResponseErr) {
    return '';
  }

  if (data.type === ClarityType.ResponseOk && data.value?.type === ClarityType.OptionalSome) {
    const tuple = data.value.value as TupleCV<NameResponse>;
    const { name, namespace } = tuple.data;
    return `${hexToAscii(name.data)}.${hexToAscii(namespace.data)}`;
  }

  return '';
}
