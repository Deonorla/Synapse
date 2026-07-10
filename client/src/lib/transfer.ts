import { API_BASE_URL } from './config';

export type BalanceInfo = {
  address: string;
  balanceMist: number;
};

export type BalancesResponse = {
  user: BalanceInfo;
  agent: BalanceInfo | null;
};

export type TransferResponse = {
  message: string;
  digest: string;
  from: string;
  to: string;
  amountMist: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export const transferApi = {
  /** Fetch both user and agent balances in one call */
  getBalances: (ownerAddress: string) =>
    request<BalancesResponse>(`/api/transfer/balances?ownerAddress=${encodeURIComponent(ownerAddress)}`),

  /** Transfer SUI from agent wallet to user wallet (server-side signed) */
  agentToUser: (ownerAddress: string, recipientAddress: string, amountMist: number) =>
    request<TransferResponse>('/api/transfer/agent-to-user', {
      method: 'POST',
      body: JSON.stringify({ ownerAddress, recipientAddress, amountMist }),
    }),
};
