import { MemWal } from '@mysten-incubation/memwal';
import type { MemWalConfig } from '@mysten-incubation/memwal';

let client: MemWal | null = null;

export function getMemWalClient(): MemWal {
  if (client) return client;

  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL || 'https://relayer.memwal.ai';

  if (!key || !accountId) {
    throw new Error(
      'MemWal not configured.\n' +
      'Set MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID in server/.env\n' +
      'Get these from https://memwal.wal.app'
    );
  }

  client = MemWal.create({ key, accountId, serverUrl });
  return client;
}

export function agentNamespace(agentAddress: string): string {
  return `agent-${agentAddress.slice(2, 10)}`;
}

export function isMemWalConfigured(): boolean {
  return Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID);
}

export function getMemWalConfig(namespace?: string): MemWalConfig {
  return {
    key: process.env.MEMWAL_PRIVATE_KEY ?? '',
    accountId: process.env.MEMWAL_ACCOUNT_ID ?? '',
    serverUrl: process.env.MEMWAL_SERVER_URL ?? 'https://relayer.memwal.ai',
    ...(namespace ? { namespace } : {}),
  };
}
