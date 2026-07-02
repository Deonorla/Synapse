import { api } from './api';

export type SynapseWallet = {
  address: string;
  seedPhrase: string;
  privateKey: string;
  balance: number;
  toggleLoop: boolean;
  interests: string;
  maxBudgetPurchase: number;
};

export type SynapseAgentLog = {
  id: string;
  timestamp: string;
  action: string;
  type: 'info' | 'success' | 'warning' | 'error';
  details?: string;
};

export type SynapseDatasetListing = {
  id: string;
  title: string;
  category: string;
  price: number;
  description: string;
  encryptedContent: string;
  walrusBlobId: string;
  status: 'Listed' | 'Acquired';
  sellerAddress: string;
  encryptionPasswordPlaintext: string;
  createdAt: string;
  acquiredAt?: string;
  txHash?: string;
};

export async function synapseGetMarketplace(): Promise<SynapseDatasetListing[]> {
  const { listings } = await api.listings();

  return (listings ?? [])
    .filter((l) => l.isActive)
    .map((l) => {
      const firstBlob = l.blobIds?.[0] ?? '';
      return {
        id: l.id,
        title: l.title,
        category: 'All',
        price: l.priceMist,
        description: l.description,
        encryptedContent: '',
        walrusBlobId: firstBlob,
        status: 'Listed',
        sellerAddress: l.owner,
        encryptionPasswordPlaintext: '',
        createdAt: new Date(l.createdAt ?? Date.now()).toISOString(),
        txHash: undefined,
      };
    });
}

export async function synapseBuyMarketplace(id: string): Promise<{ receiptId: string }> {
  return api.purchaseDataset(id);
}

export async function synapseGetWalletPseudo(ownerAddress: string = ''): Promise<SynapseWallet> {
  if (!ownerAddress) throw new Error('ownerAddress required');
  const status = await api.agentStatus(ownerAddress);

  return {
    address: status.agentAddress ?? 'Not registered',
    seedPhrase: 'Unavailable in current backend build',
    privateKey: 'Unavailable in current backend build',
    balance: 0,
    toggleLoop: status.isRunning,
    interests: '—',
    maxBudgetPurchase: 0,
  };
}

export async function synapseToggleLoop(toggle: boolean, ownerAddress: string = ''): Promise<SynapseWallet> {
  if (!ownerAddress) throw new Error('ownerAddress required');
  if (toggle) {
    await api.startAgent(ownerAddress);
  } else {
    await api.stopAgent(ownerAddress);
  }
  return synapseGetWalletPseudo(ownerAddress);
}

export async function synapseCommitProfile(_interests: string, _maxBudgetPurchase: number, ownerAddress: string = ''): Promise<SynapseWallet> {
  return synapseGetWalletPseudo(ownerAddress);
}

export async function synapseFetchAgentLogs(ownerAddress: string = ''): Promise<SynapseAgentLog[]> {
  if (!ownerAddress) throw new Error('ownerAddress required');
  const status = await api.agentStatus(ownerAddress);
  const health = status.isRunning ? 'Agent runtime is running.' : 'Agent runtime is stopped.';

  return [
    {
      id: 'synapse-status-1',
      timestamp: new Date().toISOString(),
      action: status.isRunning ? 'STARTED' : 'STOPPED',
      type: status.isRunning ? 'success' : 'warning',
      details: health,
    },
  ];
}

export async function synapseStartAgent(ownerAddress: string = '') {
  if (!ownerAddress) throw new Error('ownerAddress required');
  await api.startAgent(ownerAddress);
}

export async function synapseStopAgent(ownerAddress: string = '') {
  if (!ownerAddress) throw new Error('ownerAddress required');
  await api.stopAgent(ownerAddress);
}

